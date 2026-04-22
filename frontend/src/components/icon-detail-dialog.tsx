import { useEffect, useMemo, useState } from "react";

import { Icon } from "@iconify/react";
import { getLibraryStyleConfig } from "@iconcraft/shared";
import type { IconLibraryId, IconStyleId } from "@iconcraft/shared";

import { copySvgToClipboard, downloadSvg, fetchSvgText } from "../lib/api";
import { applySvgExportOptions } from "../lib/svg-export";
import { useSettingsStore } from "../stores/settings-store";

interface IconDetailDialogProps {
  library: IconLibraryId;
  style: IconStyleId;
  iconName: string | null;
  open: boolean;
  onClose: () => void;
  onToast: (message: string) => void;
}

export function IconDetailDialog({
  library,
  style,
  iconName,
  open,
  onClose,
  onToast,
}: IconDetailDialogProps) {
  const [svgText, setSvgText] = useState("");
  const [loading, setLoading] = useState(false);
  const exportIconSizePx = useSettingsStore((s) => s.exportIconSizePx);
  const exportIconColor = useSettingsStore((s) => s.exportIconColor);
  const styleConfig = getLibraryStyleConfig(library, style);
  const collection = styleConfig?.collection ?? "lucide";

  const exportOptions = useMemo(
    () => ({ sizePx: exportIconSizePx, color: exportIconColor }),
    [exportIconColor, exportIconSizePx],
  );

  const displaySvg = useMemo(() => {
    if (!svgText) {
      return "";
    }
    return applySvgExportOptions(svgText, exportOptions);
  }, [exportOptions, svgText]);

  const previewIconPx = Math.min(120, Math.max(32, exportIconSizePx * 2));

  useEffect(() => {
    if (!open || !iconName) return;

    let cancelled = false;
    setLoading(true);
    fetchSvgText(library, style, iconName)
      .then((svg) => {
        if (!cancelled) setSvgText(svg);
      })
      .catch((error: Error) => {
        if (!cancelled) {
          setSvgText("");
          onToast(error.message);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [iconName, library, onToast, open, style]);

  if (!open || !iconName) return null;

  return (
    <>
      <button className="dialog-backdrop" onClick={onClose} aria-label="关闭图标详情弹窗" />
      <div className="dialog-panel surface-elevated p-5">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div className="min-w-0 pr-1">
            <div className="text-lg font-semibold">{iconName}</div>
            <div className="mt-1 text-sm text-[#8a8a8a]">
              {collection}: 预览与下方代码与「设置」中的导出边长、单色一致
            </div>
          </div>
          <button
            type="button"
            className="btn-subtle inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
            onClick={onClose}
            aria-label="关闭"
          >
            <Icon icon="lucide:x" width="16" height="16" />
          </button>
        </div>

        <div className="grid min-w-0 gap-5 md:grid-cols-[240px_1fr]">
          <div className="surface min-w-0 rounded-2xl p-5">
            <div
              className="flex aspect-square items-center justify-center rounded-xl bg-[#0e0e0e]"
              style={{ color: exportIconColor }}
            >
              <Icon icon={`${collection}:${iconName}`} width={previewIconPx} height={previewIconPx} />
            </div>
          </div>

          <div className="flex min-h-[280px] min-w-0 flex-col">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-xs uppercase tracking-[0.22em] text-[#5a5a5a]">SVG 代码</span>
              <div className="flex gap-2">
                <button
                  className="btn-ghost h-8 rounded-lg px-3 text-sm"
                  onClick={async () => {
                    await copySvgToClipboard(library, style, iconName);
                    onToast("已复制 SVG 代码");
                  }}
                >
                  复制
                </button>
                <button
                  className="btn-primary h-8 rounded-lg px-3 text-sm"
                  onClick={async () => {
                    await downloadSvg(library, style, iconName);
                    onToast(`已下载 ${iconName}.svg`);
                  }}
                >
                  下载
                </button>
              </div>
            </div>

            <pre className="dialog-svg-code surface min-h-0 flex-1 rounded-2xl p-4 text-xs leading-6 text-[#a0a0a0]">
              {loading ? "正在加载 SVG..." : displaySvg || "暂无 SVG 内容"}
            </pre>
          </div>
        </div>
      </div>
    </>
  );
}
