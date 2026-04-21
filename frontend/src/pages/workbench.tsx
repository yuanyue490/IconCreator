import { useMemo, useRef, useState } from "react";

import { Icon } from "@iconify/react";
import { BorderBeam } from "border-beam";
import {
  DEFAULT_MATCH_LIBRARY,
  DEFAULT_MATCH_STYLE,
  ICON_LIBRARIES,
  getLibraryConfig,
  getLibraryStyleConfig,
  type IconLibraryId,
  type IconStyleId,
  type MatchItem,
  type MatchResponse,
} from "@iconcraft/shared";

import { IconDetailDialog } from "../components/icon-detail-dialog";
import { MatchResultGrid } from "../components/match-result-grid";
import { SettingsDialog } from "../components/settings-dialog";
import { downloadSvgBundle, matchWords } from "../lib/api";
import { useSettingsStore } from "../stores/settings-store";

const defaultMeta: MatchResponse["meta"] = {
  matched: 0,
  total: 0,
  durationMs: 0,
  usedLlm: false,
  debug: {
    llm: {
      enabledByConfig: false,
      attempted: false,
      requestUrl: null,
      model: null,
      authHeaderPresent: false,
      upstreamStatus: null,
      success: false,
      error: null,
      upstreamBody: null,
    },
  },
};

function parseWords(raw: string) {
  return raw
    .split(/[\s,，、\n]+/)
    .map((word) => word.trim())
    .filter(Boolean)
    .slice(0, 20);
}

export function WorkbenchPage() {
  const [mode, setMode] = useState<"ai" | "match">("match");
  const [matchInput, setMatchInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<MatchItem[]>([]);
  const [meta, setMeta] = useState<MatchResponse["meta"]>(defaultMeta);
  const [selectedLibrary, setSelectedLibrary] = useState<IconLibraryId>(DEFAULT_MATCH_LIBRARY);
  const [selectedStyle, setSelectedStyle] = useState<IconStyleId>(DEFAULT_MATCH_STYLE);
  const [resultLibrary, setResultLibrary] = useState<IconLibraryId>(DEFAULT_MATCH_LIBRARY);
  const [resultStyle, setResultStyle] = useState<IconStyleId>(DEFAULT_MATCH_STYLE);
  const [toast, setToast] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [previewIcon, setPreviewIcon] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  const settings = useSettingsStore();
  const selectedLibraryConfig = getLibraryConfig(selectedLibrary);
  const selectedStyleConfig = getLibraryStyleConfig(selectedLibrary, selectedStyle);
  const resultLibraryConfig = getLibraryConfig(resultLibrary);
  const resultStyleConfig = getLibraryStyleConfig(resultLibrary, resultStyle);

  const wordCount = useMemo(() => parseWords(matchInput).length, [matchInput]);
  const hasLlmConfig = Boolean(settings.baseURL.trim() && settings.model.trim());
  const sourceSummary = useMemo(() => {
    return items.reduce(
      (acc, item) => {
        if (item.status !== "matched") {
          acc.unmatched += 1;
          return acc;
        }

        if (item.source === "catalog") acc.catalog += 1;
        else if (item.source === "llm") acc.llm += 1;
        else if (item.source === "fallback") acc.fallback += 1;
        return acc;
      },
      { catalog: 0, llm: 0, fallback: 0, unmatched: 0 },
    );
  }, [items]);
  const hasMatchResult = meta.total > 0;
  const hasMatchedIcons = useMemo(
    () => items.some((item) => item.status === "matched" && Boolean(item.iconName)),
    [items],
  );
  const matchSummaryText = useMemo(() => {
    if (!hasMatchResult) {
      return "";
    }

    const unmatchedText =
      sourceSummary.unmatched > 0 ? `，仍有 ${sourceSummary.unmatched} 个未匹配` : "，全部已匹配";
    const llmText = meta.usedLlm
      ? "已启用语义扩展（LLM）补充命中。"
      : "本次仅使用本地词典与本地兜底。";

    return `本次共处理 ${meta.total} 个词，命中 ${meta.matched} 个${unmatchedText}。${llmText}`;
  }, [hasMatchResult, meta.matched, meta.total, meta.usedLlm, sourceSummary.unmatched]);
  const requestFeedbackText = useMemo(() => {
    const modelName = (meta.debug.llm.model ?? settings.model.trim()) || "未识别模型";
    if (!hasMatchResult) return "";
    if (!meta.usedLlm) return "反馈：本次未触发语义匹配（LLM），仅使用本地匹配链路。";
    if (!meta.debug.llm.attempted) return `反馈：已启用语义匹配（模型：${modelName}），但本次无需发起请求。`;
    if (meta.debug.llm.success) return `反馈：语义匹配请求成功（模型：${modelName}）。`;
    return `反馈：语义匹配请求未成功（模型：${modelName}，${meta.debug.llm.error ?? "未知原因"}）。`;
  }, [
    hasMatchResult,
    meta.debug.llm.attempted,
    meta.debug.llm.error,
    meta.debug.llm.model,
    meta.debug.llm.success,
    meta.usedLlm,
    settings.model,
  ]);

  function showToast(message: string) {
    setToast(message);
    window.clearTimeout((showToast as typeof showToast & { timer?: number }).timer);
    (showToast as typeof showToast & { timer?: number }).timer = window.setTimeout(() => {
      setToast(null);
    }, 2200);
  }

  async function handleMatch() {
    const words = parseWords(matchInput);
    if (words.length === 0) {
      showToast("先输入一组要匹配的词");
      return;
    }

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

      setItems(response.items);
      setMeta(response.meta);
      setResultLibrary(response.library);
      setResultStyle(response.style);
      showToast(response.meta.usedLlm ? "已完成语义匹配" : "已完成本地词典匹配");
    } catch (error) {
      showToast(error instanceof Error ? error.message : "匹配失败");
    } finally {
      setLoading(false);
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

  async function handleExportBundle() {
    const names = items
      .filter((item) => item.status === "matched" && item.iconName)
      .map((item) => item.iconName as string);

    if (names.length === 0) {
      showToast("当前没有可导出的图标");
      return;
    }

    setExporting(true);
    try {
      const result = await downloadSvgBundle(resultLibrary, resultStyle, names);
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
      setExporting(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-[#fafafa]">
      <header className="flex h-12 items-center justify-between border-b border-white/5 px-6">
        <div className="flex items-center gap-3">
          <div className="flex h-7 w-7 items-center justify-center rounded-md bg-white text-sm font-semibold text-black">
            厨
          </div>
          <div className="text-sm font-semibold">图标大厨</div>
          <div className="text-[11px] text-[#5a5a5a]">v0.1 MVP</div>
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
                <Icon icon="lucide:layers" width="15" />
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
              <span className="chip is-active">
                {selectedLibraryConfig?.label ?? "未知图标库"} · {selectedStyleConfig?.label ?? "默认风格"}
              </span>
              <span className="text-xs text-[#5a5a5a]">当前词数 {wordCount}/20</span>
            </div>

            <button
              className="btn-primary inline-flex h-9 items-center gap-2 rounded-lg px-5 text-[13.5px]"
              onClick={() => void handleMatch()}
              disabled={loading}
            >
              <Icon icon={loading ? "lucide:loader-circle" : "lucide:layers"} width="15" />
              {loading ? "匹配中..." : "开始匹配"}
            </button>
          </div>
        </section>
        </BorderBeam>

        <section className="mt-6">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2 text-[12.5px]">
              <span className="text-[#5a5a5a]">来源</span>
              <span className="font-medium">
                {resultLibraryConfig?.label ?? "未知图标库"} · {resultStyleConfig?.label ?? "默认风格"}
              </span>
              <span className="text-[#5a5a5a]">·</span>
              <span className="text-[#5a5a5a]">匹配</span>
              <span className="font-medium">
                {meta.matched}/{meta.total}
              </span>
              <span className="text-[#5a5a5a]">·</span>
              <span className="text-[#5a5a5a]">耗时</span>
              <span className="font-mono text-[#a0a0a0]">{meta.durationMs} ms</span>
              <span className="text-[#5a5a5a]">·</span>
              <span className="font-mono text-[#a0a0a0]">
                {meta.usedLlm ? "catalog -> LLM -> fallback" : "catalog only"}
              </span>
            </div>

            <div className="flex items-center gap-2">
              {hasMatchedIcons ? (
                <button
                  className="btn-primary inline-flex h-8 items-center gap-1.5 rounded-lg px-3 text-sm"
                  onClick={() => void handleExportBundle()}
                  disabled={exporting}
                >
                  <Icon
                    icon={exporting ? "lucide:loader-circle" : "lucide:archive"}
                    width="14"
                  />
                  {exporting ? "打包中..." : "导出全部"}
                </button>
              ) : null}
            </div>
          </div>

          {hasMatchResult ? (
            <div className="match-info mb-4 rounded-2xl px-1 py-1">
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <span className="text-[11px] uppercase tracking-[0.22em] text-[#5a5a5a]">
                  匹配说明
                </span>
                <span
                  className="info-tooltip"
                  tabIndex={0}
                  role="button"
                  aria-label="查看匹配处理顺序说明"
                >
                  <Icon icon="lucide:circle-help" width="13" />
                  <span className="info-tooltip__bubble">
                    处理顺序：先查本地词典；词典未命中且已配置模型时，再交给 LLM 做语义匹配；
                    若模型结果不存在或不可信，再走本地兜底；仍然失败则标记为未匹配，不会强行硬猜。
                  </span>
                </span>
              </div>
              <p className="match-info__text">{matchSummaryText}</p>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <span className="source-pill source-pill--catalog">本地词典 {sourceSummary.catalog}</span>
                <span className="source-pill source-pill--llm">LLM 语义 {sourceSummary.llm}</span>
                <span className="source-pill source-pill--fallback">本地兜底 {sourceSummary.fallback}</span>
                <span className="source-pill source-pill--unmatched">未匹配 {sourceSummary.unmatched}</span>
              </div>
            </div>
          ) : null}

          <MatchResultGrid
            library={resultLibrary}
            style={resultStyle}
            items={items}
            loading={loading}
            onPreview={(iconName) => setPreviewIcon(iconName)}
            onToast={showToast}
          />
          {hasMatchResult ? <p className="match-feedback mt-6">{requestFeedbackText}</p> : null}
        </section>
      </main>

      <SettingsDialog open={settingsOpen} onClose={() => setSettingsOpen(false)} />
      <IconDetailDialog
        library={resultLibrary}
        style={resultStyle}
        iconName={previewIcon}
        open={Boolean(previewIcon)}
        onClose={() => setPreviewIcon(null)}
        onToast={showToast}
      />

      {toast ? <div className="toast">{toast}</div> : null}
    </div>
  );
}
