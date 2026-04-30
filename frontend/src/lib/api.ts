import JSZip from "jszip";

import type {
  AiGenerateRequest,
  AiGenerateResponse,
  AppSettings,
  MatchRequest,
  MatchResponse,
} from "@iconcraft/shared";

import { applySvgExportOptions } from "./svg-export";
import { useSettingsStore } from "../stores/settings-store";

function getSvgExportOptions() {
  const s = useSettingsStore.getState();
  return {
    sizePx: s.exportIconSizePx,
    color: s.exportIconColor,
  };
}

export async function matchWords(input: Omit<MatchRequest, "llm"> & { llm?: Partial<AppSettings> }) {
  const response = await fetch("/api/match", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as { message?: string } | null;
    throw new Error(payload?.message ?? "匹配请求失败");
  }

  return (await response.json()) as MatchResponse;
}

export async function generateAiIcons(input: AiGenerateRequest) {
  const response = await fetch("/api/ai/generate", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as { message?: string } | null;
    throw new Error(payload?.message ?? "AI 生成请求失败");
  }

  return (await response.json()) as AiGenerateResponse;
}

export async function fetchSvgText(library: string, style: string, name: string) {
  const response = await fetch(`/api/icons/${library}/${style}/${name}.svg`);
  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as { message?: string } | null;
    throw new Error(payload?.message ?? "SVG 获取失败");
  }

  return response.text();
}

export async function copySvgToClipboard(library: string, style: string, name: string) {
  const raw = await fetchSvgText(library, style, name);
  const svg = applySvgExportOptions(raw, getSvgExportOptions());
  await navigator.clipboard.writeText(svg);
}

export async function downloadSvg(library: string, style: string, name: string) {
  const raw = await fetchSvgText(library, style, name);
  const svg = applySvgExportOptions(raw, getSvgExportOptions());
  const blob = new Blob([svg], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${name}.svg`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * 打包下载结果：
 * - 把每个图标作为独立 .svg 放进 zip，而不是拼进一个 txt 里；
 * - 单个 SVG 拉取失败不中断整体流程，汇总返回 failures 方便上层提示；
 * - 返回值允许 UI 层判断「全失败」与「部分失败」两种场景。
 */
export interface BundleDownloadResult {
  total: number;
  succeeded: number;
  failures: Array<{ name: string; message: string }>;
}

function sanitizeFileName(name: string) {
  // iconify 图标名一般是 kebab-case 安全字符，这里保守兜底一层，
  // 把所有非字母数字/点/下划线/短横线替换成 "-"，避免个别来源出现非法路径。
  return name.replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-+|-+$/g, "") || "icon";
}

export async function downloadSvgBundle(
  library: string,
  style: string,
  names: string[],
): Promise<BundleDownloadResult> {
  const uniqueNames = [...new Set(names.filter(Boolean))];
  if (uniqueNames.length === 0) {
    return { total: 0, succeeded: 0, failures: [] };
  }

  const results = await Promise.all(
    uniqueNames.map(async (name) => {
      try {
        const svg = await fetchSvgText(library, style, name);
        return { name, svg, ok: true as const };
      } catch (error) {
        return {
          name,
          ok: false as const,
          message: error instanceof Error ? error.message : "未知错误",
        };
      }
    }),
  );

  const zip = new JSZip();
  const folderName = `${library}-${style}`;
  const folder = zip.folder(folderName) ?? zip;

  // 防止极端情况下多个 name 经过 sanitize 后撞名。
  const usedFileNames = new Set<string>();
  const failures: Array<{ name: string; message: string }> = [];
  let succeeded = 0;

  for (const result of results) {
    if (!result.ok) {
      failures.push({ name: result.name, message: result.message });
      continue;
    }

    let baseName = sanitizeFileName(result.name);
    let fileName = `${baseName}.svg`;
    let dedupeIndex = 1;
    while (usedFileNames.has(fileName)) {
      dedupeIndex += 1;
      fileName = `${baseName}-${dedupeIndex}.svg`;
    }
    usedFileNames.add(fileName);
    const opts = getSvgExportOptions();
    const processed = applySvgExportOptions(result.svg, opts);
    folder.file(fileName, processed);
    succeeded += 1;
  }

  if (succeeded === 0) {
    throw new Error(
      failures[0]?.message
        ? `SVG 获取失败：${failures[0].message}`
        : "SVG 获取失败",
    );
  }

  const blob = await zip.generateAsync({
    type: "blob",
    compression: "DEFLATE",
    compressionOptions: { level: 6 },
  });

  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `iconcraft-${folderName}-${uniqueNames.length}.zip`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);

  return {
    total: uniqueNames.length,
    succeeded,
    failures,
  };
}
