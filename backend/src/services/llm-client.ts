import type { AppSettings, IconCatalogEntry } from "@iconcraft/shared";

const DEFAULT_SYSTEM_PROMPT = [
  "You are an icon matching assistant.",
  "Please perform a fuzzy search for a similar icon name for each user word.",
  "You must only choose icon names from the provided catalog.",
  "If there is no good match, return null.",
  "Return JSON only, no markdown.",
  'Output format: {"matches":[{"word":"...", "iconName":"..." | null, "reason":"..."}]}',
].join(" ");

function stripCodeFence(text: string) {
  return text
    .trim()
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/, "");
}

/**
 * 合并「前端传入的配置」与「服务器环境变量兜底」。
 * - 前端字段非空则优先；否则回退到 process.env。
 * - 这是把「站长密钥只放服务器、浏览器看不到」落地的关键：
 *   生产环境只需配置 LLM_* 环境变量，用户不填 apiKey 也能用，
 *   且密钥只驻留在后端进程里。
 */
export function resolveLlmConfig(llm?: Partial<AppSettings>): AppSettings {
  const pick = (value: string | undefined, fallback: string | undefined) =>
    value?.trim() || fallback?.trim() || "";

  return {
    baseURL: pick(llm?.baseURL, process.env.LLM_BASE_URL),
    apiKey: pick(llm?.apiKey, process.env.LLM_API_KEY),
    model: pick(llm?.model, process.env.LLM_MODEL),
    systemPrompt: pick(llm?.systemPrompt, process.env.LLM_SYSTEM_PROMPT),
    // 与 shared `AppSettings` 对齐；匹配请求体不会传这些前端设置，仅占位满足类型
    exportIconSizePx: 24,
    exportIconColor: "#fafafa",
    digitalTwinImageModel: "",
  };
}

function hasLlmConfig(llm?: Partial<AppSettings>) {
  const resolved = resolveLlmConfig(llm);
  return Boolean(resolved.baseURL && resolved.model);
}

export function canUseLlm(llm?: Partial<AppSettings>) {
  return hasLlmConfig(llm);
}

export interface LlmDebugInfo {
  enabledByConfig: boolean;
  attempted: boolean;
  requestUrl: string | null;
  model: string | null;
  authHeaderPresent: boolean;
  upstreamStatus: number | null;
  success: boolean;
  error: string | null;
  upstreamBody: string | null;
}

export interface LlmMatchResult {
  matches: Array<{
    word: string;
    iconName: string | null;
    reason: string;
  }> | null;
  debug: LlmDebugInfo;
}

export async function requestLlmMatches(input: {
  words: string[];
  catalog: IconCatalogEntry[];
  llm?: Partial<AppSettings>;
}): Promise<LlmMatchResult> {
  const { words, catalog, llm } = input;
  const enabledByConfig = hasLlmConfig(llm);

  if (!enabledByConfig) {
    return {
      matches: null,
      debug: {
        enabledByConfig,
        attempted: false,
        requestUrl: null,
        model: null,
        authHeaderPresent: false,
        upstreamStatus: null,
        success: false,
        error: "LLM config missing: baseURL or model is empty.",
        upstreamBody: null,
      },
    };
  }

  const resolved = resolveLlmConfig(llm);
  const baseURL = resolved.baseURL.replace(/\/+$/, "");
  const model = resolved.model;
  const apiKey = resolved.apiKey;
  const authHeaderPresent = Boolean(apiKey);
  const requestUrl = `${baseURL}/chat/completions`;

  const systemPrompt = resolved.systemPrompt || DEFAULT_SYSTEM_PROMPT;

  const candidateLines = catalog
    .map((entry) => `${entry.name}: ${entry.aliases.join(", ")}`)
    .join("\n");

  try {
    const response = await fetch(requestUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
      },
      body: JSON.stringify({
        model,
        temperature: 0,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: systemPrompt },
          {
            role: "user",
            content: [
              `words: ${JSON.stringify(words)}`,
              "catalog:",
              candidateLines,
            ].join("\n"),
          },
        ],
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text().catch(() => "");
      return {
        matches: null,
        debug: {
          enabledByConfig,
          attempted: true,
          requestUrl,
          model: model || null,
          authHeaderPresent,
          upstreamStatus: response.status,
          success: false,
          error: `LLM request failed with ${response.status}`,
          upstreamBody: errorBody ? errorBody.slice(0, 1200) : null,
        },
      };
    }

    const payload = (await response.json()) as {
      choices?: Array<{ message?: { content?: string | null } }>;
    };

    const content = payload.choices?.[0]?.message?.content;
    if (!content) {
      throw new Error("LLM response content is empty");
    }

    const parsed = JSON.parse(stripCodeFence(content)) as {
      matches?: Array<{
        word?: string;
        iconName?: string | null;
        reason?: string;
      }>;
    };

    if (!parsed || !Array.isArray(parsed.matches)) {
      throw new Error("LLM response JSON shape is invalid");
    }

    return {
      matches: parsed.matches.map((item) => ({
        word: typeof item.word === "string" ? item.word : "",
        iconName: typeof item.iconName === "string" ? item.iconName : null,
        reason: typeof item.reason === "string" ? item.reason : "",
      })),
      debug: {
        enabledByConfig,
        attempted: true,
        requestUrl,
        model: model || null,
        authHeaderPresent,
        upstreamStatus: response.status,
        success: true,
        error: null,
        upstreamBody: null,
      },
    };
  } catch (error) {
    return {
      matches: null,
      debug: {
        enabledByConfig,
        attempted: true,
        requestUrl,
        model: model || null,
        authHeaderPresent,
        upstreamStatus: null,
        success: false,
        error: error instanceof Error ? error.message : "Unknown LLM error",
        upstreamBody: null,
      },
    };
  }
}

/** 用于描述 LLM 关键词扩展调用的调试信息。 */
export interface LlmKeywordDebugInfo {
  attempted: boolean;
  success: boolean;
  requestUrl: string | null;
  upstreamStatus: number | null;
  error: string | null;
  expansions: Record<string, string[]> | null;
}

const KEYWORD_EXPAND_SYSTEM_PROMPT = [
  "You expand user terms into English keywords that are commonly used in icon library names.",
  "For each input word, return 3 to 8 concise keywords.",
  "Keywords must be lowercase, either a single English word or short hyphenated phrase.",
  "Prefer nouns and concrete imagery (e.g. for 火 return fire, flame, burn, heat).",
  "Return JSON only, no markdown.",
  'Output format: {"expansions":[{"word":"...","keywords":["...","..."]}]}.',
].join(" ");

/**
 * 将用户输入的词（中文或其他语言）扩展为英文关键词集合，
 * 供上游用这些关键词在图标全量名字里做字面匹配，从而
 * 打通「火 → flame」这类精选词典没覆盖、但 Iconify 里存在的语义桥。
 *
 * 与 requestLlmMatches 的关键差异：
 *  - prompt 中不带图标候选清单，体积固定且与图标库规模无关；
 *  - 输出只含英文关键词，不直接输出图标名；
 *  - 只有在精选词典 + 常规 LLM 匹配都 miss 后才会被调用，成本可控。
 */
export async function requestKeywordExpansion(input: {
  words: string[];
  llm?: Partial<AppSettings>;
}): Promise<LlmKeywordDebugInfo> {
  const { words, llm } = input;

  if (!hasLlmConfig(llm) || words.length === 0) {
    return {
      attempted: false,
      success: false,
      requestUrl: null,
      upstreamStatus: null,
      error: words.length === 0 ? null : "LLM config missing for keyword expansion.",
      expansions: null,
    };
  }

  const resolved = resolveLlmConfig(llm);
  const baseURL = resolved.baseURL.replace(/\/+$/, "");
  const requestUrl = `${baseURL}/chat/completions`;
  const apiKey = resolved.apiKey;

  try {
    const response = await fetch(requestUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
      },
      body: JSON.stringify({
        model: resolved.model,
        temperature: 0,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: KEYWORD_EXPAND_SYSTEM_PROMPT },
          { role: "user", content: `words: ${JSON.stringify(words)}` },
        ],
      }),
    });

    if (!response.ok) {
      return {
        attempted: true,
        success: false,
        requestUrl,
        upstreamStatus: response.status,
        error: `Keyword expansion failed with ${response.status}`,
        expansions: null,
      };
    }

    const payload = (await response.json()) as {
      choices?: Array<{ message?: { content?: string | null } }>;
    };
    const content = payload.choices?.[0]?.message?.content;
    if (!content) {
      throw new Error("Keyword expansion response is empty");
    }

    const parsed = JSON.parse(stripCodeFence(content)) as {
      expansions?: Array<{ word?: string; keywords?: unknown }>;
    };

    const expansions: Record<string, string[]> = {};
    if (parsed && Array.isArray(parsed.expansions)) {
      for (const item of parsed.expansions) {
        if (typeof item?.word !== "string") continue;
        const list = Array.isArray(item.keywords)
          ? item.keywords.filter((kw): kw is string => typeof kw === "string" && kw.length > 0)
          : [];
        if (list.length > 0) {
          expansions[item.word] = list;
        }
      }
    }

    return {
      attempted: true,
      success: true,
      requestUrl,
      upstreamStatus: response.status,
      error: null,
      expansions,
    };
  } catch (error) {
    return {
      attempted: true,
      success: false,
      requestUrl,
      upstreamStatus: null,
      error: error instanceof Error ? error.message : "Unknown keyword expansion error",
      expansions: null,
    };
  }
}
