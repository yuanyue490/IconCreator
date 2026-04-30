import JSZip from "jszip";

import type { AiGenerationHistoryImage } from "../stores/ai-generation-history-store";

function imageSrc(image: AiGenerationHistoryImage): string {
  return image.url ?? (image.b64Json ? `data:image/png;base64,${image.b64Json}` : "");
}

function sanitizeSegment(name: string) {
  return name.replace(/[^a-zA-Z0-9._\u4e00-\u9fff-]+/g, "-").replace(/^-+|-+$/g, "") || "ai-icon";
}

/** 将一次 AI 生成的多张图打成 ZIP，与 SVG 匹配的「导出这组」体验对齐 */
export async function downloadAiHistoryZip(images: AiGenerationHistoryImage[], objectLabel: string) {
  const valid = images.map((img, index) => ({ img, index })).filter(({ img }) => Boolean(imageSrc(img)));
  if (valid.length === 0) {
    throw new Error("没有可打包的图片（链接可能失效且缺少本地快照）");
  }

  const folder = sanitizeSegment(objectLabel.trim() || "ai-icons");
  const zip = new JSZip();
  const root = zip.folder(folder) ?? zip;

  for (const { img, index } of valid) {
    const src = imageSrc(img);
    const response = await fetch(src);
    if (!response.ok) {
      throw new Error(`拉取候选图 ${index + 1} 失败`);
    }
    const blob = await response.blob();
    const ext =
      blob.type === "image/jpeg" ? "jpg" : blob.type === "image/webp" ? "webp" : "png";
    root.file(`candidate-${index + 1}.${ext}`, blob);
  }

  const out = await zip.generateAsync({
    type: "blob",
    compression: "DEFLATE",
    compressionOptions: { level: 6 },
  });

  const url = URL.createObjectURL(out);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${folder}-${valid.length}-icons.zip`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
