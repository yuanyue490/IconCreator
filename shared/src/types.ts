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

/** 本地 JSON 配置的 3D 图标生图风格（vars 占位符与 prompt 中的 token 对应） */
export interface Ai3dIconStyleConfig {
  type: string;
  vars: {
    object: string;
    color: string;
  };
  prompt: string;
}

/** 多套提示词模板中的一套（供前端整体风格切换） */
export interface Ai3dIconStyleVariant extends Ai3dIconStyleConfig {
  id: string;
  label: string;
  /** 简短说明，仅 UI 辅助 */
  description?: string;
}

/** `shared/config/ai-3d-icon-styles.json` 根结构 */
export interface Ai3dIconStylesCatalog {
  version: number;
  styles: Ai3dIconStyleVariant[];
}

/** 主色调预置：`phrase` 将写入 prompt 中的 {主色调} 占位；`swatch` 仅 UI 示意 */
export interface Ai3dColorPreset {
  id: string;
  label: string;
  phrase: string;
  swatch: string;
}

export interface Ai3dIconPresetsConfig {
  version: number;
  colors: Ai3dColorPreset[];
}

export interface AppSettings {
  baseURL: string;
  apiKey: string;
  model: string;
  systemPrompt: string;
  /** 导出/复制时的 SVG 边长（px），不含 @2x 倍率 */
  exportIconSizePx: number;
  /** 单色：作用于 SVG 根 `color` 及 `currentColor` 链；与列表/弹窗里 Icon 预览一致 */
  exportIconColor: string;
  /** 数字孪生图片生成使用的模型；为空时使用后端默认模型 */
  digitalTwinImageModel: string;
}

export type AiImageResolution = "1K" | "2K" | "4K";

export type AiImageAspectRatio = "1:1" | "16:9" | "9:16" | "4:3" | "3:4";

export interface AiGenerateRequest {
  object: string;
  colorPhrase: string;
  prompt: string;
  resolution: AiImageResolution;
  aspectRatio: AiImageAspectRatio;
  count: 2;
}

export interface AiGeneratedImage {
  id: string;
  url: string | null;
  b64Json: string | null;
  revisedPrompt?: string | null;
}

export interface AiGenerateResponse {
  images: AiGeneratedImage[];
  meta: {
    model: string;
    size: string;
    count: number;
    durationMs: number;
  };
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

export type PromptSkillStatus = "ready" | "needs_input";

export type PromptSkillSessionStatus = "collecting" | "confirming" | "ready" | "generated";

export type PromptSkillQuestionType = "single" | "multi" | "text";

export interface PromptSkillQuestion {
  field: string;
  question: string;
  type: PromptSkillQuestionType;
  options?: string[];
}

export interface PromptSkillSlots {
  sceneType?: string;
  location?: string;
  scope?: string;
  visualStyles?: string[];
  colorScheme?: string;
  specialRequirements?: string;
  targetTool?: string;
}

export interface PromptSkillChatMessage {
  role: "user" | "assistant";
  content: string;
}

export interface PromptSkillParsedResult {
  status: PromptSkillStatus;
  followUpQuestions: string[];
  prompt: string;
  keywords: string[];
  variants: string[];
  usageTips: string[];
}

export interface PromptSkillTestRequest {
  skillMarkdown: string;
  userInput: string;
  llm?: Partial<AppSettings>;
}

export interface PromptSkillTestResponse {
  ok: boolean;
  parsed: PromptSkillParsedResult | null;
  raw: string;
  error: string | null;
  meta: {
    requestUrl: string | null;
    model: string | null;
    durationMs: number;
    upstreamStatus: number | null;
    usedJsonFormatFallback?: boolean;
  };
}

export interface PromptSkillTurnRequest {
  skillMarkdown: string;
  userMessage: string;
  session: {
    status: PromptSkillSessionStatus;
    slots: PromptSkillSlots;
    messages: PromptSkillChatMessage[];
  };
  llm?: Partial<AppSettings>;
}

export interface PromptSkillTurnResponse {
  ok: boolean;
  status: PromptSkillSessionStatus;
  assistantMessage: string;
  slots: PromptSkillSlots;
  missingFields: string[];
  followUpQuestions: PromptSkillQuestion[];
  prompt: string | null;
  keywords: string[];
  variants: string[];
  usageTips: string[];
  raw: string;
  error: string | null;
  meta: {
    requestUrl: string | null;
    model: string | null;
    durationMs: number;
    upstreamStatus: number | null;
    usedJsonFormatFallback?: boolean;
  };
}

export type PromptSkillImageModel = string;

export type PromptSkillImageResponseFormat = "url" | "b64_json";

export interface PromptSkillGeneratedImage {
  id: string;
  url: string | null;
  b64Json: string | null;
  revisedPrompt?: string | null;
}

export interface PromptSkillImageGenerateRequest {
  prompt: string;
  model?: PromptSkillImageModel;
  responseFormat?: PromptSkillImageResponseFormat;
}

export interface PromptSkillImageGenerateResponse {
  images: PromptSkillGeneratedImage[];
  meta: {
    model: string;
    responseFormat: PromptSkillImageResponseFormat;
    count: number;
    durationMs: number;
  };
}

export interface PromptSkillImageConfigResponse {
  configured: boolean;
  providerName: string;
  model: string;
  modelOptions: string[];
  timeoutMs: number;
  missing: string[];
  warning?: string;
}
