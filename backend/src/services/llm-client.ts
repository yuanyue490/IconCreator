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

function hasLlmConfig(llm?: Partial<AppSettings>) {
  return Boolean(llm?.baseURL && llm?.model);
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

  const baseURL = llm?.baseURL?.replace(/\/+$/, "");
  const model = llm?.model?.trim();
  const apiKey = llm?.apiKey?.trim();
  const authHeaderPresent = Boolean(apiKey);
  const requestUrl = `${baseURL}/chat/completions`;

  const systemPrompt = llm?.systemPrompt?.trim() || DEFAULT_SYSTEM_PROMPT;

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
          model: model ?? null,
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
        model: model ?? null,
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
        model: model ?? null,
        authHeaderPresent,
        upstreamStatus: null,
        success: false,
        error: error instanceof Error ? error.message : "Unknown LLM error",
        upstreamBody: null,
      },
    };
  }
}
