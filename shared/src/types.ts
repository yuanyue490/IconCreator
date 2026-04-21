export type IconLibraryId = "lucide" | "heroicons" | "ph" | "tabler";

export type IconStyleId = "linear" | "solid" | "regular" | "duotone";

export type MatchSource = "catalog" | "llm" | "fallback";

export type MatchStatus = "matched" | "unmatched";

export interface PromptPreset {
  id: string;
  label: string;
  promptFragment: string;
  order: number;
}

export interface AppSettings {
  baseURL: string;
  apiKey: string;
  model: string;
  systemPrompt: string;
}

export interface MatchRequest {
  words: string[];
  library: IconLibraryId;
  style: IconStyleId;
  llm?: Partial<AppSettings>;
}

export interface MatchItem {
  word: string;
  status: MatchStatus;
  iconName: string | null;
  source: MatchSource | null;
  reason?: string;
}

export interface MatchResponse {
  library: IconLibraryId;
  style: IconStyleId;
  items: MatchItem[];
  meta: {
    total: number;
    matched: number;
    durationMs: number;
    usedLlm: boolean;
    debug: {
      llm: {
        enabledByConfig: boolean;
        attempted: boolean;
        requestUrl: string | null;
        model: string | null;
        authHeaderPresent: boolean;
        upstreamStatus: number | null;
        success: boolean;
        error: string | null;
        upstreamBody: string | null;
      };
      /**
       * 可选：LLM 关键词扩展 + 全量名字字面匹配的调试信息。
       * 仅在精选词典 + 常规 LLM 都 miss 且允许调用 LLM 时才会填充。
       */
      keyword?: {
        attempted: boolean;
        success: boolean;
        requestUrl: string | null;
        upstreamStatus: number | null;
        error: string | null;
        expansions: Record<string, string[]> | null;
      };
    };
  };
}

export interface IconCatalogEntry {
  name: string;
  aliases: string[];
}
