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
    };
  };
}

export interface IconCatalogEntry {
  name: string;
  aliases: string[];
}
