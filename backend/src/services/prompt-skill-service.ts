import type {
  AppSettings,
  PromptSkillParsedResult,
  PromptSkillQuestion,
  PromptSkillSessionStatus,
  PromptSkillSlots,
  PromptSkillTestResponse,
  PromptSkillTurnResponse,
} from "@iconcraft/shared";

const DEFAULT_PROMPT_SKILL_TIMEOUT_MS = 60000;

import { resolveLlmConfig } from "./llm-client.js";

const TEST_OUTPUT_CONTRACT = `你必须只返回一个 JSON 对象，不要 Markdown，不要代码块，不要解释。
JSON 结构必须严格为：
{
  "status": "ready" | "needs_input",
  "followUpQuestions": string[],
  "prompt": string,
  "keywords": string[],
  "variants": string[],
  "usageTips": string[]
}
当必填信息不足时，status 必须为 "needs_input"，prompt 为空字符串，并在 followUpQuestions 中列出需要追问的问题。
当信息足够时，status 必须为 "ready"，followUpQuestions 为空数组，prompt 填入完整可复制的提示词。`;

const TURN_OUTPUT_CONTRACT = `你必须只返回一个 JSON 对象，不要 Markdown，不要代码块，不要解释。
JSON 结构必须严格为：
{
  "status": "collecting" | "confirming" | "ready" | "generated",
  "assistantMessage": string,
  "slots": {
    "sceneType"?: string,
    "location"?: string,
    "scope"?: string,
    "visualStyles"?: string[],
    "colorScheme"?: string,
    "specialRequirements"?: string,
    "targetTool"?: string
  },
  "missingFields": string[],
  "followUpQuestions": [
    {
      "field": string,
      "question": string,
      "type": "single" | "multi" | "text",
      "options"?: string[]
    }
  ],
  "prompt": string | null,
  "keywords": string[],
  "variants": string[],
  "usageTips": string[]
}
你需要先从用户最新回复中抽取并更新 slots，再判断下一步：
- 缺少应用场景类型时，status 为 "collecting"，并追问。
- 信息基本充分但尚未明确确认时，status 为 "confirming"，assistantMessage 需要给出正式、简洁的需求摘要，并询问是否确认生成。
- 用户确认生成或明确要求生成时，status 为 "generated"，prompt 填入完整可复制的提示词。
- followUpQuestions 要尽量结构化，能给选项就给 options。
所有面向用户的文案必须正式、清晰、克制，不使用口语化寒暄。`;

type CompletionMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

function stripCodeFence(text: string) {
  return text
    .trim()
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/, "");
}

function normalizeStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean);
}

function resolvePromptSkillTimeoutMs() {
  const parsed = Number(process.env.PROMPT_SKILL_TIMEOUT_MS);
  if (!Number.isFinite(parsed) || parsed < 10000) {
    return DEFAULT_PROMPT_SKILL_TIMEOUT_MS;
  }
  return Math.min(parsed, 120000);
}

function normalizeSlots(value: unknown): PromptSkillSlots {
  const raw = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  const slots: PromptSkillSlots = {};

  for (const key of [
    "sceneType",
    "location",
    "scope",
    "colorScheme",
    "specialRequirements",
    "targetTool",
  ] as const) {
    if (typeof raw[key] === "string" && raw[key].trim()) {
      slots[key] = raw[key].trim();
    }
  }

  const visualStyles = normalizeStringArray(raw.visualStyles);
  if (visualStyles.length > 0) {
    slots.visualStyles = visualStyles;
  }

  return slots;
}

function normalizeQuestions(value: unknown): PromptSkillQuestion[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const questions: PromptSkillQuestion[] = [];

  for (const item of value) {
    const raw = item && typeof item === "object" ? (item as Record<string, unknown>) : {};
    const type =
      raw.type === "single" || raw.type === "multi" || raw.type === "text" ? raw.type : "text";
    const question = typeof raw.question === "string" ? raw.question.trim() : "";
    if (!question) {
      continue;
    }

    questions.push({
      field: typeof raw.field === "string" && raw.field.trim() ? raw.field.trim() : "general",
      question,
      type,
      options: normalizeStringArray(raw.options),
    });
  }

  return questions;
}

function normalizeTurnStatus(value: unknown): PromptSkillSessionStatus {
  if (value === "confirming" || value === "ready" || value === "generated") {
    return value;
  }
  return "collecting";
}

function parsePromptSkillResult(raw: string): PromptSkillParsedResult {
  const parsed = JSON.parse(stripCodeFence(raw)) as {
    status?: unknown;
    followUpQuestions?: unknown;
    prompt?: unknown;
    keywords?: unknown;
    variants?: unknown;
    usageTips?: unknown;
  };

  const status = parsed.status === "needs_input" ? "needs_input" : "ready";

  return {
    status,
    followUpQuestions: normalizeStringArray(parsed.followUpQuestions),
    prompt: typeof parsed.prompt === "string" ? parsed.prompt.trim() : "",
    keywords: normalizeStringArray(parsed.keywords),
    variants: normalizeStringArray(parsed.variants),
    usageTips: normalizeStringArray(parsed.usageTips),
  };
}

async function requestCompletion(input: {
  llm?: Partial<AppSettings>;
  messages: CompletionMessage[];
  temperature?: number;
}) {
  const startedAt = Date.now();
  const resolved = resolveLlmConfig(input.llm);
  const baseURL = resolved.baseURL.replace(/\/+$/, "");
  const requestUrl = baseURL ? `${baseURL}/chat/completions` : null;
  const timeoutMs = resolvePromptSkillTimeoutMs();

  if (!requestUrl || !resolved.model) {
    return {
      ok: false as const,
      raw: "",
      error: "需求生成服务暂未配置，请联系管理员处理。",
      meta: {
        requestUrl,
        model: resolved.model || null,
        durationMs: Date.now() - startedAt,
        upstreamStatus: null,
      },
    };
  }

  let timeout: ReturnType<typeof setTimeout> | undefined;

  try {
    const controller = new AbortController();
    timeout = setTimeout(() => controller.abort(), timeoutMs);
    const response = await fetch(requestUrl, {
      method: "POST",
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        ...(resolved.apiKey ? { Authorization: `Bearer ${resolved.apiKey}` } : {}),
      },
      body: JSON.stringify({
        model: resolved.model,
        temperature: input.temperature ?? 0.2,
        response_format: { type: "json_object" },
        messages: input.messages,
      }),
    });
    clearTimeout(timeout);
    timeout = undefined;

    const upstreamStatus = response.status;
    const body = await response.text();

    if (!response.ok) {
      return {
        ok: false as const,
        raw: body,
        error: `需求生成服务返回异常，请稍后重试。`,
        meta: {
          requestUrl,
          model: resolved.model,
          durationMs: Date.now() - startedAt,
          upstreamStatus,
        },
      };
    }

    const payload = JSON.parse(body) as {
      choices?: Array<{ message?: { content?: string | null } }>;
    };

    return {
      ok: true as const,
      raw: payload.choices?.[0]?.message?.content?.trim() ?? body,
      error: null,
      meta: {
        requestUrl,
        model: resolved.model,
        durationMs: Date.now() - startedAt,
        upstreamStatus,
      },
    };
  } catch (error) {
    if (timeout) {
      clearTimeout(timeout);
    }
    const isAbortError = error instanceof Error && error.name === "AbortError";
    return {
      ok: false as const,
      raw: "",
      error: isAbortError
        ? `需求生成超过 ${Math.round(timeoutMs / 1000)} 秒未返回，请稍后重试。`
        : error instanceof Error
          ? error.message
          : "需求生成服务连接失败，请稍后重试。",
      meta: {
        requestUrl,
        model: resolved.model || null,
        durationMs: Date.now() - startedAt,
        upstreamStatus: null,
      },
    };
  }
}

export async function testPromptSkill(input: {
  skillMarkdown: string;
  userInput: string;
  llm?: Partial<AppSettings>;
}): Promise<PromptSkillTestResponse> {
  const completion = await requestCompletion({
    llm: input.llm,
    temperature: 0.2,
    messages: [
      {
        role: "system",
        content: [
          "你是一个严格执行 Skill 的提示词生成助手。",
          "你需要理解用户提供的 Skill Markdown，并按其中的步骤、词库和模板工作。",
          TEST_OUTPUT_CONTRACT,
        ].join("\n\n"),
      },
      {
        role: "system",
        content: `Skill Markdown:\n\n${input.skillMarkdown}`,
      },
      {
        role: "user",
        content: `用户输入：\n${input.userInput}`,
      },
    ],
  });

  if (!completion.ok) {
    return {
      ok: false,
      parsed: null,
      raw: completion.raw,
      error: completion.error,
      meta: completion.meta,
    };
  }

  try {
    return {
      ok: true,
      parsed: parsePromptSkillResult(completion.raw),
      raw: completion.raw,
      error: null,
      meta: completion.meta,
    };
  } catch (error) {
    return {
      ok: false,
      parsed: null,
      raw: completion.raw,
      error: error instanceof Error ? error.message : "Prompt skill JSON parse failed.",
      meta: completion.meta,
    };
  }
}

export async function runPromptSkillTurn(input: {
  skillMarkdown: string;
  userMessage: string;
  session: {
    status: PromptSkillSessionStatus;
    slots: PromptSkillSlots;
    messages: Array<{ role: "user" | "assistant"; content: string }>;
  };
  llm?: Partial<AppSettings>;
}): Promise<PromptSkillTurnResponse> {
  const recentMessages = input.session.messages.slice(-8);
  const completion = await requestCompletion({
    llm: input.llm,
    temperature: 0.2,
    messages: [
      {
        role: "system",
        content: [
          "你是一个提示词 Skill 协同助手，负责需求澄清、信息确认与最终提示词生成。",
          "你必须严格遵循用户提供的 Skill Markdown，不得脱离 Skill 的领域、步骤和模板。",
          TURN_OUTPUT_CONTRACT,
        ].join("\n\n"),
      },
      {
        role: "system",
        content: `Skill Markdown:\n\n${input.skillMarkdown}`,
      },
      {
        role: "system",
        content: `当前会话状态：\n${JSON.stringify(
          {
            status: input.session.status,
            slots: input.session.slots,
          },
          null,
          2,
        )}`,
      },
      ...recentMessages,
      {
        role: "user",
        content: input.userMessage,
      },
    ],
  });

  if (!completion.ok) {
    return {
      ok: false,
      status: input.session.status,
      assistantMessage: "",
      slots: input.session.slots,
      missingFields: [],
      followUpQuestions: [],
      prompt: null,
      keywords: [],
      variants: [],
      usageTips: [],
      raw: completion.raw,
      error: completion.error,
      meta: completion.meta,
    };
  }

  try {
    const parsed = JSON.parse(stripCodeFence(completion.raw)) as {
      status?: unknown;
      assistantMessage?: unknown;
      slots?: unknown;
      missingFields?: unknown;
      followUpQuestions?: unknown;
      prompt?: unknown;
      keywords?: unknown;
      variants?: unknown;
      usageTips?: unknown;
    };

    const status = normalizeTurnStatus(parsed.status);
    const prompt = typeof parsed.prompt === "string" && parsed.prompt.trim() ? parsed.prompt.trim() : null;

    return {
      ok: true,
      status: prompt && status !== "collecting" && status !== "confirming" ? "generated" : status,
      assistantMessage:
        typeof parsed.assistantMessage === "string" && parsed.assistantMessage.trim()
          ? parsed.assistantMessage.trim()
          : "已更新需求信息。",
      slots: normalizeSlots(parsed.slots),
      missingFields: normalizeStringArray(parsed.missingFields),
      followUpQuestions: normalizeQuestions(parsed.followUpQuestions),
      prompt,
      keywords: normalizeStringArray(parsed.keywords),
      variants: normalizeStringArray(parsed.variants),
      usageTips: normalizeStringArray(parsed.usageTips),
      raw: completion.raw,
      error: null,
      meta: completion.meta,
    };
  } catch (error) {
    return {
      ok: false,
      status: input.session.status,
      assistantMessage: "",
      slots: input.session.slots,
      missingFields: [],
      followUpQuestions: [],
      prompt: null,
      keywords: [],
      variants: [],
      usageTips: [],
      raw: completion.raw,
      error: error instanceof Error ? error.message : "Prompt skill turn JSON parse failed.",
      meta: completion.meta,
    };
  }
}
