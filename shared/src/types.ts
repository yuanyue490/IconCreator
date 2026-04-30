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

/** 本地 JSON 配置的 3D 图标生图风格（vars 占位符与 prompt/negative 中的 token 对应） */
export interface Ai3dIconStyleConfig {
  type: string;
  vars: {
    object: string;
    color: string;
    material: string;
  };
  prompt: string;
  negative: string;
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

/** 材质预置：`thumb` 为相对站点根的路径，后期可换为实拍/渲染材质图 */
export interface Ai3dMaterialPreset {
  id: string;
  label: string;
  phrase: string;
  thumb: string;
}

export interface Ai3dIconPresetsConfig {
  version: number;
  colors: Ai3dColorPreset[];
  materials: Ai3dMaterialPreset[];
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
}

export type AiImageResolution = "1K" | "2K" | "4K";

export type AiImageAspectRatio = "1:1" | "16:9" | "9:16" | "4:3" | "3:4";

export interface AiGenerateRequest {
  object: string;
  colorPhrase: string;
  materialPhrase: string;
  prompt: string;
  negativePrompt: string;
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
