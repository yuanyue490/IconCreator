import type { AiGenerateRequest, AiGenerateResponse, AiGeneratedImage } from "@iconcraft/shared";

type UpstreamImageItem = {
  url?: string | null;
  b64_json?: string | null;
  b64Json?: string | null;
  revised_prompt?: string | null;
  revisedPrompt?: string | null;
};

const DEFAULT_IMAGE_BASE_URL = "https://ark.cn-beijing.volces.com/api/v3";
const DEFAULT_IMAGE_MODEL = "doubao-seedream-4-5-251128";

const SIZE_TABLE: Record<AiGenerateRequest["resolution"], Record<AiGenerateRequest["aspectRatio"], string>> = {
  "1K": {
    "1:1": "1024x1024",
    "16:9": "1024x576",
    "9:16": "576x1024",
    "4:3": "1024x768",
    "3:4": "768x1024",
  },
  "2K": {
    "1:1": "2048x2048",
    "16:9": "2048x1152",
    "9:16": "1152x2048",
    "4:3": "2048x1536",
    "3:4": "1536x2048",
  },
  "4K": {
    "1:1": "4096x4096",
    "16:9": "3840x2160",
    "9:16": "2160x3840",
    "4:3": "4096x3072",
    "3:4": "3072x4096",
  },
};

function pickEnv(...keys: string[]) {
  for (const key of keys) {
    const value = process.env[key]?.trim();
    if (value) return value;
  }
  return "";
}

function resolveImageConfig() {
  const baseURL = pickEnv("AI_IMAGE_BASE_URL", "SEEDREAM_BASE_URL", "ARK_IMAGE_BASE_URL");
  const apiKey = pickEnv("AI_IMAGE_API_KEY", "SEEDREAM_API_KEY", "ARK_API_KEY", "VOLCENGINE_API_KEY");
  const model = pickEnv("AI_IMAGE_MODEL", "SEEDREAM_MODEL", "ARK_IMAGE_MODEL") || DEFAULT_IMAGE_MODEL;

  return {
    baseURL: (baseURL || DEFAULT_IMAGE_BASE_URL).replace(/\/+$/, ""),
    apiKey,
    model,
  };
}

function normalizeImages(data: unknown): AiGeneratedImage[] {
  const payload = data as { data?: UpstreamImageItem[]; images?: UpstreamImageItem[] };
  const list = Array.isArray(payload.data)
    ? payload.data
    : Array.isArray(payload.images)
      ? payload.images
      : [];

  return list
    .map((item, index) => ({
      id: `ai-${Date.now()}-${index}`,
      url: typeof item.url === "string" && item.url.trim() ? item.url : null,
      b64Json:
        typeof item.b64_json === "string"
          ? item.b64_json
          : typeof item.b64Json === "string"
            ? item.b64Json
            : null,
      revisedPrompt:
        typeof item.revised_prompt === "string"
          ? item.revised_prompt
          : typeof item.revisedPrompt === "string"
            ? item.revisedPrompt
            : null,
    }))
    .filter((item) => item.url || item.b64Json);
}

export function imageSizeForRequest(input: Pick<AiGenerateRequest, "resolution" | "aspectRatio">) {
  return SIZE_TABLE[input.resolution][input.aspectRatio];
}

async function requestImageBatch(input: AiGenerateRequest, config: ReturnType<typeof resolveImageConfig>, size: string, count: number) {
  const response = await fetch(`${config.baseURL}/images/generations`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify({
      model: config.model,
      prompt: input.prompt,
      n: count,
      size,
      response_format: "url",
      sequential_image_generation: count > 1 ? "auto" : "disabled",
      sequential_image_generation_options: {
        max_images: count,
      },
      watermark: false,
    }),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(
      body
        ? `AI 生图接口返回 ${response.status}：${body.slice(0, 500)}`
        : `AI 生图接口返回 ${response.status}`,
    );
  }

  return normalizeImages(await response.json());
}

export async function generateAiImages(input: AiGenerateRequest): Promise<AiGenerateResponse> {
  const start = Date.now();
  const config = resolveImageConfig();

  if (!config.apiKey) {
    throw new Error("AI_IMAGE_API_KEY 未配置，请先在后端环境变量中配置火山方舟/Seedream API Key。");
  }

  const size = imageSizeForRequest(input);
  let images = await requestImageBatch(input, config, size, input.count);

  // Seedream 4.5 的组图能力同时受 n 与 sequential_image_generation_options 影响；
  // 若上游/接入点仍只回单张，这里再按缺口补请求，保证产品侧稳定拿到 2 张候选。
  while (images.length < input.count) {
    const missing = input.count - images.length;
    const extraImages = await requestImageBatch(input, config, size, missing);
    images = [...images, ...extraImages];
    if (extraImages.length === 0) break;
  }
  images = images.slice(0, input.count);

  if (images.length === 0) {
    throw new Error("AI 生图接口未返回可用图片。");
  }

  return {
    images,
    meta: {
      model: config.model,
      size,
      count: images.length,
      durationMs: Date.now() - start,
    },
  };
}
