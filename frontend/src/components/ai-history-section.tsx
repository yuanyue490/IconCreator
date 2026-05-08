import { useState } from "react";

import { Icon } from "@iconify/react";

import { downloadAiHistoryZip } from "../lib/ai-history-export";
import type { AiGenerationHistorySession } from "../stores/ai-generation-history-store";

interface AiHistorySectionProps {
  session: AiGenerationHistorySession;
  onDelete: (session: AiGenerationHistorySession) => void;
  onToast: (message: string, options?: { actionLabel?: string; onAction?: () => void }) => void;
}

function formatTimestamp(timestamp: number) {
  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(timestamp);
}

function imageSrc(img: AiGenerationHistorySession["images"][0]) {
  return img.url ?? (img.b64Json ? `data:image/png;base64,${img.b64Json}` : "");
}

function downloadImage(img: AiGenerationHistorySession["images"][0], filename: string) {
  const src = imageSrc(img);
  if (!src) return;
  const link = document.createElement("a");
  link.href = src;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

async function copyImageToClipboard(img: AiGenerationHistorySession["images"][0]) {
  const src = imageSrc(img);
  if (!src || !navigator.clipboard || !("ClipboardItem" in window)) {
    throw new Error("当前浏览器不支持复制图片");
  }
  const response = await fetch(src);
  const blob = await response.blob();
  await navigator.clipboard.write([new ClipboardItem({ [blob.type || "image/png"]: blob })]);
}

export function AiHistorySection({ session, onDelete, onToast }: AiHistorySectionProps) {
  const [exporting, setExporting] = useState(false);

  async function handleCopyPrompt() {
    const text = `主体提示词\n${session.prompt}\n\n规避内容\n${session.negativePrompt}`;
    await navigator.clipboard.writeText(text);
    onToast("已复制提示词");
  }

  async function handleExportZip() {
    setExporting(true);
    try {
      await downloadAiHistoryZip(session.images, session.objectName);
      onToast("已导出 ZIP");
    } catch (error) {
      onToast(error instanceof Error ? error.message : "打包失败");
    } finally {
      setExporting(false);
    }
  }

  const durationSec = (session.meta.durationMs / 1000).toFixed(1);

  return (
    <div className="match-session">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="match-session__header">
            <div className="match-session__query" title={session.objectName}>
              {session.objectName}
            </div>
            <span className="match-session__time">{formatTimestamp(session.createdAt)}</span>
          </div>
          <div className="match-session__meta">
            <span>
              {session.colorLabel} / {session.materialLabel}
            </span>
            {session.styleLabel ? (
              <>
                <span className="match-session__meta-sep">·</span>
                <span title="生成时选用的提示词风格">{session.styleLabel}</span>
              </>
            ) : null}
            <span className="match-session__meta-sep">·</span>
            <span>
              {session.resolution} · {session.aspectRatio}
            </span>
            <span className="match-session__meta-sep">·</span>
            <span>{session.images.length} 张候选</span>
            <span className="match-session__meta-sep">·</span>
            <span className="font-mono text-[11px] text-[#8a8a8a]">
              {session.meta.model} · {session.meta.size}
            </span>
            <span className="match-session__meta-sep">·</span>
            <span>{durationSec}s</span>
          </div>
        </div>

        <div className="match-session__actions">
          <button
            type="button"
            className="btn-ghost inline-flex h-8 items-center gap-1.5 rounded-lg px-3 text-sm"
            onClick={() => void handleExportZip()}
            disabled={exporting}
          >
            <Icon icon={exporting ? "lucide:loader-circle" : "lucide:archive"} width="14" />
            {exporting ? "打包中..." : "导出这组"}
          </button>
          <button
            type="button"
            className="btn-ghost inline-flex h-8 items-center gap-1.5 rounded-lg px-3 text-sm"
            onClick={() => void handleCopyPrompt()}
          >
            <Icon icon="lucide:copy" width="14" />
            复制提示词
          </button>
          <button
            type="button"
            className="btn-ghost btn-ghost--danger inline-flex h-8 items-center gap-1.5 rounded-lg px-3 text-sm"
            onClick={() => onDelete(session)}
            disabled={exporting}
            aria-label="删除本条 AI 生成记录"
          >
            <Icon icon="lucide:trash-2" width="14" />
            删除
          </button>
        </div>
      </div>

      <div className="ai-result-grid">
        {session.images.map((image, index) => (
          <article className="ai-result-card" key={`${session.id}-${index}`}>
            {imageSrc(image) ? (
              <img alt={`${session.objectName} 候选 ${index + 1}`} src={imageSrc(image)} />
            ) : (
              <div className="flex items-center justify-center p-6 text-center text-[12px] text-[#6a6a6a]">
                无效或已过期的候选图
              </div>
            )}
            <div className="ai-result-actions">
              <button
                className="match-card-action"
                type="button"
                title="下载"
                disabled={!imageSrc(image)}
                onClick={() => downloadImage(image, `${session.objectName || "icon"}-${index + 1}.png`)}
              >
                <Icon icon="lucide:download" width="14" />
              </button>
              <button
                className="match-card-action"
                type="button"
                title="复制图片"
                disabled={!imageSrc(image)}
                onClick={() =>
                  copyImageToClipboard(image)
                    .then(() => onToast("已复制图片"))
                    .catch((error) =>
                      onToast(error instanceof Error ? error.message : "复制图片失败"),
                    )
                }
              >
                <Icon icon="lucide:copy" width="14" />
              </button>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
