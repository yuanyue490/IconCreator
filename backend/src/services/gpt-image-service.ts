import type {
  PromptSkillImageConfigResponse,
  PromptSkillGeneratedImage,
  PromptSkillImageGenerateRequest,
  PromptSkillImageGenerateResponse,
} from "@iconcraft/shared";

type UpstreamImageItem = {
  url?: string | null;
  b64_json?: string | null;
  b64Json?: string | null;
  revised_prompt?: string | null;
  revisedPrompt?: string | null;
};

const DEFAULT_GPT_IMAGE_BASE_URL = "https://api.apiyi.com/v1";
const DEFAULT_GPT_IMAGE_MODEL = "gpt-image-2-all";
const DEFAULT_GPT_IMAGE_PROVIDER_NAME = "API易";
const DEFAULT_GPT_IMAGE_TIMEOUT_MS = 120000;

export class PromptSkillImageError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
    public readonly code: string,
  ) {
    super(message);
    this.name = "PromptSkillImageError";
  }
}

function pickEnv(...keys: string[]) {
  for (const key of keys) {
    const value = process.env[key]?.trim();
    if (value) return value;
  }
  return "";
}

function parseModelOptions(value: string, fallback: string) {
  const options = value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

  return [...new Set([fallback, ...options])];
}

function sanitizeImageModelName(value: string) {
  return value
    .replace(/\\n|\\r/g, "\n")
    .split(/\r?\n/)
    .map((item) => item.trim())
    .find((item) => item && !item.includes("=") && !item.includes("_API_KEY")) ?? "";
}

function parseTimeoutMs(value: string) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 10000) {
    return DEFAULT_GPT_IMAGE_TIMEOUT_MS;
  }
  return Math.min(parsed, 300000);
}

function resolveGptImageConfig() {
  const baseURL =
    pickEnv("APIYI_IMAGE_BASE_URL", "GPT_IMAGE_BASE_URL", "N1N_IMAGE_BASE_URL") ||
    DEFAULT_GPT_IMAGE_BASE_URL;
  const apiKey = pickEnv("APIYI_IMAGE_API_KEY", "GPT_IMAGE_API_KEY", "N1N_IMAGE_API_KEY");
  const rawModel =
    pickEnv("APIYI_IMAGE_MODEL", "GPT_IMAGE_MODEL", "N1N_IMAGE_MODEL") || DEFAULT_GPT_IMAGE_MODEL;
  const model = sanitizeImageModelName(rawModel) || DEFAULT_GPT_IMAGE_MODEL;
  const providerName =
    pickEnv("APIYI_IMAGE_PROVIDER_NAME", "GPT_IMAGE_PROVIDER_NAME", "N1N_IMAGE_PROVIDER_NAME") ||
    DEFAULT_GPT_IMAGE_PROVIDER_NAME;
  const modelOptions = parseModelOptions(
    pickEnv("APIYI_IMAGE_MODEL_OPTIONS", "GPT_IMAGE_MODEL_OPTIONS", "N1N_IMAGE_MODEL_OPTIONS"),
    model,
  )
    .map(sanitizeImageModelName)
    .filter(Boolean);
  const timeoutMs = parseTimeoutMs(
    pickEnv("APIYI_IMAGE_TIMEOUT_MS", "GPT_IMAGE_TIMEOUT_MS", "N1N_IMAGE_TIMEOUT_MS"),
  );

  return {
    baseURL: baseURL.replace(/\/+$/, ""),
    apiKey,
    model,
    providerName,
    modelOptions: modelOptions.length ? [...new Set(modelOptions)] : [model],
    timeoutMs,
    configWarning:
      rawModel !== model
        ? "图片模型配置格式异常，已自动使用第一行有效模型名。请检查服务端环境变量。"
        : "",
  };
}

export function getPromptSkillImageConfig(): PromptSkillImageConfigResponse {
  const config = resolveGptImageConfig();

  return {
    configured: Boolean(config.apiKey),
    providerName: config.providerName,
    model: config.model,
    modelOptions: config.modelOptions,
    timeoutMs: config.timeoutMs,
    missing: config.apiKey ? [] : ["APIYI_IMAGE_API_KEY"],
    warning: config.configWarning,
  };
}

function normalizeImages(data: unknown): PromptSkillGeneratedImage[] {
  const payload = data as {
    data?: UpstreamImageItem[];
    images?: UpstreamImageItem[];
  };
  const list = Array.isArray(payload.data)
    ? payload.data
    : Array.isArray(payload.images)
      ? payload.images
      : [];

  return list
    .map((item, index) => ({
      id: `skill-image-${Date.now()}-${index}`,
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

export async function generatePromptSkillImages(
  input: PromptSkillImageGenerateRequest,
): Promise<PromptSkillImageGenerateResponse> {
  const startedAt = Date.now();
  const config = resolveGptImageConfig();
  const model = input.model?.trim() || config.model;

  if (!config.apiKey) {
    throw new PromptSkillImageError(
      "图片生成服务暂未就绪，请联系管理员处理。",
      503,
      "IMAGE_API_KEY_MISSING",
    );
  }

  let response: Response;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), config.timeoutMs);

  try {
    response = await fetch(`${config.baseURL}/images/generations`, {
      method: "POST",
      signal: controller.signal,
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify({
        model,
        prompt: input.prompt,
        response_format: input.responseFormat,
      }),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (error instanceof Error && error.name === "AbortError") {
      throw new PromptSkillImageError(
        `图片生成超过 ${Math.round(config.timeoutMs / 1000)} 秒未返回，请稍后重试或缩短提示词。`,
        504,
        "IMAGE_TIMEOUT",
      );
    }
    if (message.toLowerCase().includes("fetch failed")) {
      throw new PromptSkillImageError(
        "图片生成服务连接中断，请稍后重试。",
        504,
        "IMAGE_UPSTREAM_DISCONNECTED",
      );
    }
    throw new PromptSkillImageError(
      message || "图片生成服务连接失败，请稍后重试。",
      502,
      "IMAGE_UPSTREAM_FAILED",
    );
  } finally {
    clearTimeout(timeout);
  }

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    let upstreamMessage = "";
    try {
      const payload = JSON.parse(body) as {
        error?: { message?: string; code?: string | null };
        message?: string;
      };
      upstreamMessage = payload.error?.message ?? payload.message ?? "";
    } catch {
      upstreamMessage = body.slice(0, 500);
    }

    if (response.status === 401) {
      throw new PromptSkillImageError(
        "图片生成服务鉴权失败，请联系管理员处理。",
        401,
        "IMAGE_API_KEY_INVALID",
      );
    }

    if (response.status === 429) {
      throw new PromptSkillImageError(
        upstreamMessage || "图片模型请求过于频繁或额度预扣不足，请稍后重试。",
        429,
        "IMAGE_RATE_LIMITED",
      );
    }

    if (response.status === 403 && upstreamMessage.includes("quota")) {
      throw new PromptSkillImageError(
        "图片生成服务额度不足，请联系管理员处理。",
        403,
        "IMAGE_QUOTA_INSUFFICIENT",
      );
    }

    throw new PromptSkillImageError(
      upstreamMessage
        ? `图片生成服务返回异常：${upstreamMessage}`
        : "图片生成服务返回异常，请稍后重试。",
      response.status >= 500 ? 502 : response.status,
      "IMAGE_UPSTREAM_ERROR",
    );
  }

  const images = normalizeImages(await response.json()).slice(0, 1);
  if (images.length === 0) {
    throw new PromptSkillImageError(
      "图片生成服务未返回可用图片，请稍后重试或调整提示词。",
      502,
      "IMAGE_EMPTY_RESULT",
    );
  }

  return {
    images,
    meta: {
      model,
      responseFormat: input.responseFormat ?? "url",
      count: images.length,
      durationMs: Date.now() - startedAt,
    },
  };
}
