import { Icon } from "@iconify/react";

import { getLibraryStyleConfig } from "@iconcraft/shared";
import type { IconLibraryId, IconStyleId, MatchItem } from "@iconcraft/shared";

import { copySvgToClipboard, downloadSvg } from "../lib/api";

interface MatchResultGridProps {
  library: IconLibraryId;
  style: IconStyleId;
  items: MatchItem[];
  loading: boolean;
  onPreview: (iconName: string) => void;
  onToast: (message: string) => void;
}

function SkeletonCard() {
  return (
    <div className="match-card-skel">
      <div className="skeleton w-full rounded-[10px]" style={{ aspectRatio: "1 / 1" }} />
      <div className="skeleton h-3 w-[72%] rounded" />
      <div className="skeleton h-2.5 w-[56%] rounded" />
    </div>
  );
}

function getSourceMeta(item: MatchItem) {
  if (item.status !== "matched") {
    return { label: "未匹配", className: "source-pill source-pill--unmatched" };
  }

  switch (item.source) {
    case "catalog":
      return { label: "本地词典", className: "source-pill source-pill--catalog" };
    case "llm":
      return { label: "LLM 语义", className: "source-pill source-pill--llm" };
    case "fallback":
      return { label: "本地兜底", className: "source-pill source-pill--fallback" };
    default:
      return { label: "已匹配", className: "source-pill" };
  }
}

export function MatchResultGrid({
  library,
  style,
  items,
  loading,
  onPreview,
  onToast,
}: MatchResultGridProps) {
  const styleConfig = getLibraryStyleConfig(library, style);
  const collection = styleConfig?.collection ?? "lucide";

  if (loading) {
    return (
      <div className="match-grid">
        {Array.from({ length: 5 }, (_, index) => (
          <SkeletonCard key={index} />
        ))}
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="surface rounded-2xl p-6 text-center text-sm text-[#8a8a8a]">
        输入一组词后开始 SVG 匹配。可切换不同开源图标库，未配置模型时会先走当前图标库的本地词典匹配。
      </div>
    );
  }

  return (
    <div className="match-grid">
      {items.map((item) => {
        const matched = item.status === "matched" && item.iconName;
        const iconName = typeof item.iconName === "string" ? item.iconName : null;
        const sourceMeta = getSourceMeta(item);

        return (
          <div
            key={`${item.word}-${item.iconName ?? "unmatched"}`}
            className={`match-card ${matched ? "clickable" : "is-unmatched"}`}
            onClick={() => {
              if (matched && iconName) onPreview(iconName);
            }}
          >
            <div className="match-card-actions">
              {matched ? (
                <>
                  <button
                    className="match-card-action"
                    title="下载 SVG"
                    onClick={async (event) => {
                      event.stopPropagation();
                      if (!iconName) return;
                      await downloadSvg(library, style, iconName);
                      onToast(`已下载 ${iconName}.svg`);
                    }}
                  >
                    <Icon icon="lucide:download" width="14" />
                  </button>
                  <button
                    className="match-card-action"
                    title="复制 SVG"
                    onClick={async (event) => {
                      event.stopPropagation();
                      if (!iconName) return;
                      await copySvgToClipboard(library, style, iconName);
                      onToast("已复制 SVG 代码");
                    }}
                  >
                    <Icon icon="lucide:copy" width="14" />
                  </button>
                </>
              ) : (
                <button
                  className="match-card-action"
                  title="未匹配说明"
                  onClick={(event) => {
                    event.stopPropagation();
                    onToast(item.reason ?? "当前没有安全匹配结果");
                  }}
                >
                  <Icon icon="lucide:help-circle" width="14" />
                </button>
              )}
            </div>

            <div className="match-card-icon">
              {matched && iconName ? (
                <Icon icon={`${collection}:${iconName}`} width="44" />
              ) : (
                <Icon icon="lucide:help-circle" width="44" />
              )}
            </div>

            <div>
              <div className="mb-2 flex justify-center">
                <span className={sourceMeta.className}>{sourceMeta.label}</span>
              </div>
              <div className="match-card-label">{item.word}</div>
              <div className="match-card-name">
                {matched ? `${collection}:${item.iconName}` : "未匹配"}
              </div>
              {!matched ? (
                <div className="mt-2 text-center text-[10.5px] leading-5 text-[#666]">
                  {item.reason ?? "没有找到安全且可信的对应图标"}
                </div>
              ) : null}
            </div>
          </div>
        );
      })}
    </div>
  );
}
