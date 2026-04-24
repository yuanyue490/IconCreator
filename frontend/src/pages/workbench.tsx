import { useEffect, useMemo, useRef, useState } from "react";

import { Icon } from "@iconify/react";
import { BorderBeam } from "border-beam";
import {
  DEFAULT_MATCH_LIBRARY,
  DEFAULT_MATCH_STYLE,
  ICON_LIBRARIES,
  getLibraryConfig,
  type IconLibraryId,
  type IconStyleId,
} from "@iconcraft/shared";

import { MatchHistorySection } from "../components/match-history-section";
import { IconDetailDialog } from "../components/icon-detail-dialog";
import { MatchResultGrid } from "../components/match-result-grid";
import { SettingsDialog } from "../components/settings-dialog";
import { EXPORT_SIZE_PRESETS, isPresetSize } from "../lib/export-appearance";
import { downloadSvgBundle, matchWords } from "../lib/api";
import type { MatchHistorySession } from "../stores/match-history-store";
import { useMatchHistoryStore } from "../stores/match-history-store";
import { useSettingsStore } from "../stores/settings-store";

function parseWords(raw: string) {
  return raw
    .split(/[\s,，、\n]+/)
    .map((word) => word.trim())
    .filter(Boolean)
    .slice(0, 20);
}

type ToastState = {
  id: number;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
};

export function WorkbenchPage() {
  const [mode, setMode] = useState<"ai" | "match">("match");
  const [matchInput, setMatchInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [selectedLibrary, setSelectedLibrary] = useState<IconLibraryId>(DEFAULT_MATCH_LIBRARY);
  const [selectedStyle, setSelectedStyle] = useState<IconStyleId>(DEFAULT_MATCH_STYLE);
  const [toast, setToast] = useState<ToastState | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [previewTarget, setPreviewTarget] = useState<{
    library: IconLibraryId;
    style: IconStyleId;
    iconName: string;
  } | null>(null);
  const [exportingSessionId, setExportingSessionId] = useState<string | null>(null);
  /** 本次请求提交时的查询文案，避免加载中与输入框联动 */
  const [matchInFlightLabel, setMatchInFlightLabel] = useState<string | null>(null);

  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  const settings = useSettingsStore();
  const sessions = useMatchHistoryStore((state) => state.sessions);
  const addSession = useMatchHistoryStore((state) => state.addSession);
  const restoreSession = useMatchHistoryStore((state) => state.restoreSession);
  const removeSession = useMatchHistoryStore((state) => state.removeSession);
  const selectedLibraryConfig = getLibraryConfig(selectedLibrary);
  const toastTimerRef = useRef<number | null>(null);
  const pendingDeletedSessionRef = useRef<{ session: MatchHistorySession; index: number } | null>(null);

  const wordCount = useMemo(() => parseWords(matchInput).length, [matchInput]);
  const hasLlmConfig = Boolean(settings.baseURL.trim() && settings.model.trim());
  const hasHistory = sessions.length > 0;
  const safeExportSize = isPresetSize(settings.exportIconSizePx) ? settings.exportIconSizePx : 24;

  useEffect(() => {
    return () => {
      if (toastTimerRef.current !== null) {
        window.clearTimeout(toastTimerRef.current);
      }
    };
  }, []);

  function dismissToast() {
    if (toastTimerRef.current !== null) {
      window.clearTimeout(toastTimerRef.current);
      toastTimerRef.current = null;
    }
    setToast(null);
  }

  function showToast(message: string, options?: Pick<ToastState, "actionLabel" | "onAction">) {
    if (toastTimerRef.current !== null) {
      window.clearTimeout(toastTimerRef.current);
    }
    if (!options?.actionLabel) {
      pendingDeletedSessionRef.current = null;
    }

    setToast({
      id: Date.now(),
      message,
      actionLabel: options?.actionLabel,
      onAction: options?.onAction,
    });

    const hasAction = Boolean(options?.actionLabel && options?.onAction);
    toastTimerRef.current = window.setTimeout(() => {
      if (hasAction) {
        pendingDeletedSessionRef.current = null;
      }
      setToast(null);
      toastTimerRef.current = null;
    }, hasAction ? 3600 : 2200);
  }

  async function handleMatch() {
    const words = parseWords(matchInput);
    if (words.length === 0) {
      showToast("先输入一组要匹配的词");
      return;
    }

    const submittedLabel = words.join("、");
    setMatchInFlightLabel(submittedLabel);
    setLoading(true);
    try {
      const response = await matchWords({
        words,
        library: selectedLibrary,
        style: selectedStyle,
        llm: hasLlmConfig
          ? {
              baseURL: settings.baseURL,
              apiKey: settings.apiKey,
              model: settings.model,
              systemPrompt: settings.systemPrompt,
            }
          : undefined,
      });

      addSession({
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        createdAt: Date.now(),
        queryText: submittedLabel,
        library: response.library,
        style: response.style,
        items: response.items,
        meta: {
          total: response.meta.total,
          matched: response.meta.matched,
          durationMs: response.meta.durationMs,
          usedLlm: response.meta.usedLlm,
          llmAttempted: response.meta.debug.llm.attempted,
          llmSuccess: response.meta.debug.llm.success,
          llmModel: (response.meta.debug.llm.model ?? settings.model.trim()) || null,
          llmError: response.meta.debug.llm.error,
        },
      });
      showToast(response.meta.usedLlm ? "已完成语义匹配" : "已完成本地词典匹配");
    } catch (error) {
      showToast(error instanceof Error ? error.message : "匹配失败");
    } finally {
      setLoading(false);
      setMatchInFlightLabel(null);
    }
  }

  function autoResize(value: string) {
    setMatchInput(value);
    const element = inputRef.current;
    if (!element) return;
    element.style.height = "auto";
    element.style.height = `${Math.min(element.scrollHeight, 220)}px`;
  }

  function handleLibraryChange(nextLibrary: IconLibraryId) {
    const nextLibraryConfig = getLibraryConfig(nextLibrary);
    const nextStyle = nextLibraryConfig?.styles[0]?.id ?? DEFAULT_MATCH_STYLE;
    setSelectedLibrary(nextLibrary);
    setSelectedStyle(nextStyle);
  }

  async function handleExportBundle(session: MatchHistorySession) {
    const names = session.items
      .filter((item) => item.status === "matched" && item.iconName)
      .map((item) => item.iconName as string);

    if (names.length === 0) {
      showToast("当前没有可导出的图标");
      return;
    }

    setExportingSessionId(session.id);
    try {
      const result = await downloadSvgBundle(session.library, session.style, names);
      if (result.failures.length === 0) {
        showToast(`已导出 ${result.succeeded} 个图标到 ZIP`);
      } else {
        showToast(
          `已导出 ${result.succeeded}/${result.total} 个，${result.failures.length} 个失败`,
        );
      }
    } catch (error) {
      showToast(error instanceof Error ? error.message : "打包失败");
    } finally {
      setExportingSessionId(null);
    }
  }

  function handleRemoveSession(session: MatchHistorySession) {
    const index = sessions.findIndex((item) => item.id === session.id);
    if (index < 0) {
      return;
    }

    pendingDeletedSessionRef.current = { session, index };
    removeSession(session.id);
    if (exportingSessionId === session.id) {
      setExportingSessionId(null);
    }
    showToast("已删除该组", {
      actionLabel: "撤销",
      onAction: () => {
        const pendingDelete = pendingDeletedSessionRef.current;
        if (!pendingDelete || pendingDelete.session.id !== session.id) {
          return;
        }

        restoreSession(pendingDelete.session, pendingDelete.index);
        pendingDeletedSessionRef.current = null;
        showToast("已恢复该组");
      },
    });
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-[#fafafa]">
      <header className="flex h-12 items-center justify-between border-b border-white/5 px-6">
        <div className="flex items-center gap-3">
          <div className="flex h-7 w-7 items-center justify-center rounded-md bg-white text-sm font-semibold text-black">
            厨
          </div>
          <div className="text-sm font-semibold">图标大厨</div>
          <div className="text-[11px] text-[#5a5a5a]">v0.2 Beta</div>
        </div>

        <div className="flex items-center gap-1">
          <button
            className="btn-subtle inline-flex h-8 items-center gap-1.5 rounded-md px-3 text-[12.5px]"
            onClick={() => setSettingsOpen(true)}
          >
            <Icon icon="lucide:settings-2" width="14" />
            配置
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-[920px] px-6 pb-20 pt-10">
        <section className="mb-8 text-center">
          <div className="hero-banner mx-auto">
            <div className="hero-overlay" />
            <div className="hero-caption">
              <div className="hero-caption-title">图标大厨</div>
              <div className="hero-caption-sub">SVG图标聚合匹配搜索 · 多开源图标库可切换</div>
            </div>
          </div>

          <div className="mt-6 flex justify-center">
            <div className="mode-seg">
              <span
                className="mode-seg-soon"
                tabIndex={0}
                aria-label="AI 生成功能即将上线"
              >
                <span className="mode-seg-soon__bubble" role="tooltip">
                  即将上线
                </span>
                <button className="is-disabled" type="button" disabled>
                  <Icon icon="lucide:sparkles" width="15" />
                  AI 生成
                </button>
              </span>
              <button
                className={mode === "match" ? "is-active" : ""}
                onClick={() => setMode("match")}
              >
                <Icon icon="lucide:globe" width="15" />
                SVG匹配
              </button>
            </div>
          </div>

          <p className="mt-3 text-sm leading-6 text-[#a0a0a0]">
            输入一组词语，系统会通过本地结合大模型做语义匹配，返回当前图标库下可复制、可下载的 SVG 图标。
          </p>
        </section>

        <BorderBeam size="md" colorVariant="ocean" duration={4} strength={0.3}>
        <section className="surface-raised rounded-[20px] p-5">
          <div className="input-shell px-4 py-3">
            <textarea
              ref={inputRef}
              className="input-area text-[15px] leading-[1.5]"
              rows={2}
              value={matchInput}
              onChange={(event) => autoResize(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
                  event.preventDefault();
                  void handleMatch();
                }
              }}
              placeholder="输入一组词（空格 / 逗号 / 换行分隔），如：首页 管理 安防 监控"
            />
          </div>

          <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[11.5px] uppercase tracking-[0.2em] text-[#5a5a5a]">图标库</span>
              <select
                className="h-9 rounded-lg border border-white/8 bg-[#111] px-3 text-sm text-[#f5f5f5] outline-none transition focus:border-white/20"
                value={selectedLibrary}
                onChange={(event) => handleLibraryChange(event.target.value as IconLibraryId)}
              >
                {ICON_LIBRARIES.map((library) => (
                  <option key={library.id} value={library.id}>
                    {library.label}
                  </option>
                ))}
              </select>
              <select
                className="h-9 rounded-lg border border-white/8 bg-[#111] px-3 text-sm text-[#f5f5f5] outline-none transition focus:border-white/20"
                value={selectedStyle}
                onChange={(event) => setSelectedStyle(event.target.value as IconStyleId)}
              >
                {(selectedLibraryConfig?.styles ?? []).map((style) => (
                  <option key={style.id} value={style.id}>
                    {style.label}
                  </option>
                ))}
              </select>
              <span className="text-xs text-[#5a5a5a]">当前词数 {wordCount}/20</span>
            </div>

            <button
              className="btn-primary inline-flex h-9 items-center gap-2 rounded-lg px-5 text-[13.5px]"
              onClick={() => void handleMatch()}
              disabled={loading}
            >
              <Icon icon={loading ? "lucide:loader-circle" : "lucide:rocket"} width="15" />
              {loading ? "匹配中..." : "开始匹配"}
            </button>
          </div>
        </section>
        </BorderBeam>

        <div
          className="workbench-export-tuning"
          role="group"
          aria-label="SVG 导出与预览外观"
        >
          <span className="workbench-export-tuning__title">全局样式修改</span>
          <span className="workbench-export-tuning__k">大小</span>
          <select
            className="workbench-export-tuning__select"
            value={safeExportSize}
            onChange={(event) =>
              settings.setField("exportIconSizePx", Number.parseInt(event.target.value, 10) || 24)
            }
            aria-label="导出与预览的图标边长（像素）"
          >
            {EXPORT_SIZE_PRESETS.map((px) => (
              <option key={px} value={px}>
                {px}px
              </option>
            ))}
          </select>
          <span className="workbench-export-tuning__k">颜色</span>
          <input
            type="color"
            className="workbench-export-tuning__color"
            value={
              /^#[0-9a-fA-F]{6}$/.test(settings.exportIconColor)
                ? settings.exportIconColor
                : "#fafafa"
            }
            onChange={(event) => settings.setField("exportIconColor", event.target.value)}
            aria-label="图标单色"
          />
          <input
            type="text"
            className="workbench-export-tuning__hex"
            value={settings.exportIconColor}
            onChange={(event) => settings.setField("exportIconColor", event.target.value)}
            placeholder="#fafafa"
            spellCheck={false}
            aria-label="颜色十六进制"
          />
        </div>

        <section className="mt-6">
          {loading ? (
            <div className="match-session match-session--loading">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="mb-1 text-[11px] uppercase tracking-[0.2em] text-[#5a5a5a]">
                    正在匹配
                  </div>
                  <div className="match-session__query" title={matchInFlightLabel ?? ""}>
                    {matchInFlightLabel ?? "…"}
                  </div>
                </div>
                <div className="inline-flex items-center gap-2 text-sm text-[#8a8a8a]">
                  <Icon icon="lucide:loader-circle" width="15" />
                  正在生成新结果组
                </div>
              </div>
              <MatchResultGrid
                library={selectedLibrary}
                style={selectedStyle}
                items={[]}
                loading
                onPreview={() => undefined}
                onToast={showToast}
              />
            </div>
          ) : null}

          {hasHistory ? (
            <div className="match-session-list">
              {sessions.map((session) => (
                <MatchHistorySection
                  key={session.id}
                  session={session}
                  exporting={exportingSessionId === session.id}
                  onExport={(currentSession) => void handleExportBundle(currentSession)}
                  onDelete={handleRemoveSession}
                  onPreview={(currentSession, iconName) =>
                    setPreviewTarget({
                      library: currentSession.library,
                      style: currentSession.style,
                      iconName,
                    })
                  }
                  onToast={showToast}
                />
              ))}
            </div>
          ) : (
            <MatchResultGrid
              library={selectedLibrary}
              style={selectedStyle}
              items={[]}
              loading={false}
              onPreview={() => undefined}
              onToast={showToast}
            />
          )}
        </section>
      </main>

      <SettingsDialog open={settingsOpen} onClose={() => setSettingsOpen(false)} />
      <IconDetailDialog
        library={previewTarget?.library ?? DEFAULT_MATCH_LIBRARY}
        style={previewTarget?.style ?? DEFAULT_MATCH_STYLE}
        iconName={previewTarget?.iconName ?? null}
        open={Boolean(previewTarget)}
        onClose={() => setPreviewTarget(null)}
        onToast={showToast}
      />

      {toast ? (
        <div className="toast" key={toast.id} role="status" aria-live="polite">
          <span>{toast.message}</span>
          {toast.actionLabel && toast.onAction ? (
            <button
              type="button"
              className="toast__action"
              onClick={() => {
                dismissToast();
                toast.onAction?.();
              }}
            >
              {toast.actionLabel}
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
