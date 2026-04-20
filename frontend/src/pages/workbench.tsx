import { useMemo, useRef, useState } from "react";

import { Icon } from "@iconify/react";
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
  // dev-only: 调试面板开发期默认折叠，正式版发布前删除整块 UI。
  const [debugOpen, setDebugOpen] = useState(false);

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

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-[#fafafa]">
      <header className="flex h-12 items-center justify-between border-b border-white/5 px-6">
        <div className="flex items-center gap-3">
          <div className="flex h-7 w-7 items-center justify-center rounded-md bg-white text-sm font-semibold text-black">
            I
          </div>
          <div className="text-sm font-semibold">IconCraft</div>
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
          <a
            href="https://iconify.design/"
            target="_blank"
            rel="noreferrer"
            className="btn-subtle inline-flex h-8 items-center gap-1.5 rounded-md px-3 text-[12.5px]"
          >
            <Icon icon="lucide:library-big" width="14" />
            Iconify
          </a>
        </div>
      </header>

      <main className="mx-auto max-w-[920px] px-6 pb-20 pt-10">
        <section className="mb-8 text-center">
          <div className="hero-banner mx-auto">
            <div className="hero-overlay" />
            <div className="hero-caption">
              <div className="hero-caption-title">IconCraft</div>
              <div className="hero-caption-sub">SVG 图标匹配 MVP · 多开源图标库可切换</div>
            </div>
          </div>

          <div className="mt-6 flex justify-center">
            <div className="mode-seg">
              <button className="is-disabled" disabled>
                <Icon icon="lucide:sparkles" width="15" />
                AI 生成
              </button>
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
            输入一组中文词语，系统会优先通过本地词典精确匹配，再结合你配置的大模型做语义补全，
            最终返回当前图标库下可复制、可下载的 SVG 图标。
          </p>
        </section>

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
              placeholder="输入一组词（空格 / 逗号 / 换行分隔），如：吃 住 行 游 购 娱"
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
              <span className="text-xs text-[#5a5a5a]">
                {hasLlmConfig
                  ? "已启用语义匹配"
                  : "未配置模型，将先使用当前图标库的本地词典匹配"}
              </span>
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
              <button
                className="btn-ghost h-8 rounded-lg px-3 text-sm"
                onClick={() => void handleMatch()}
              >
                重新匹配
              </button>
              <button
                className="btn-primary h-8 rounded-lg px-3 text-sm"
                onClick={async () => {
                  const names = items
                    .filter((item) => item.status === "matched" && item.iconName)
                    .map((item) => item.iconName as string);
                  await downloadSvgBundle(resultLibrary, resultStyle, names);
                  showToast("已导出当前匹配组");
                }}
                disabled={items.every((item) => item.status !== "matched")}
              >
                导出当前组
              </button>
            </div>
          </div>

          <div className="surface mb-4 rounded-2xl p-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[11px] uppercase tracking-[0.22em] text-[#5a5a5a]">
                命中来源
              </span>
              <span className="source-pill source-pill--catalog">本地词典 {sourceSummary.catalog}</span>
              <span className="source-pill source-pill--llm">LLM 语义 {sourceSummary.llm}</span>
              <span className="source-pill source-pill--fallback">本地兜底 {sourceSummary.fallback}</span>
              <span className="source-pill source-pill--unmatched">未匹配 {sourceSummary.unmatched}</span>
            </div>
            <div className="mt-3 text-sm leading-6 text-[#8a8a8a]">
              当前处理顺序：先查本地词典；词典未命中且已配置模型时，再交给 LLM 做语义匹配；
              若模型结果不存在或不可信，再走本地兜底；仍然失败则标记为未匹配，不会强行硬猜。
            </div>
          </div>

          <div className="surface mb-4 rounded-2xl p-4">
            <button
              className="flex w-full items-center justify-between text-left"
              onClick={() => setDebugOpen((value) => !value)}
            >
              <div>
                <div className="text-[11px] uppercase tracking-[0.22em] text-[#5a5a5a]">
                  请求调试
                </div>
                <div className="mt-1 text-sm text-[#a0a0a0]">
                  查看本次是否真的发起了 LLM 请求、用了哪个模型、上游是否成功返回。
                </div>
              </div>
              <Icon icon={debugOpen ? "lucide:chevron-up" : "lucide:chevron-down"} width="16" />
            </button>

            {debugOpen ? (
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                <div className="debug-item">
                  <div className="debug-item-label">LLM 配置可用</div>
                  <div className="debug-item-value">
                    {meta.debug.llm.enabledByConfig ? "是" : "否"}
                  </div>
                </div>
                <div className="debug-item">
                  <div className="debug-item-label">本次尝试请求</div>
                  <div className="debug-item-value">
                    {meta.debug.llm.attempted ? "是" : "否"}
                  </div>
                </div>
                <div className="debug-item">
                  <div className="debug-item-label">实际模型</div>
                  <div className="debug-item-value">{meta.debug.llm.model ?? "未提供"}</div>
                </div>
                <div className="debug-item">
                  <div className="debug-item-label">上游状态码</div>
                  <div className="debug-item-value">
                    {meta.debug.llm.upstreamStatus ?? "无"}
                  </div>
                </div>
                <div className="debug-item">
                  <div className="debug-item-label">已带 Authorization</div>
                  <div className="debug-item-value">
                    {meta.debug.llm.authHeaderPresent ? "是" : "否"}
                  </div>
                </div>
                <div className="debug-item md:col-span-2">
                  <div className="debug-item-label">请求地址</div>
                  <div className="debug-item-value break-all">
                    {meta.debug.llm.requestUrl ?? "未发起请求"}
                  </div>
                </div>
                <div className="debug-item md:col-span-2">
                  <div className="debug-item-label">请求结果</div>
                  <div className="debug-item-value">
                    {meta.debug.llm.success
                      ? "LLM 请求成功并返回可解析 JSON"
                      : meta.debug.llm.error ?? "当前未触发 LLM 请求"}
                  </div>
                </div>
                <div className="debug-item md:col-span-2">
                  <div className="debug-item-label">上游响应正文</div>
                  <div className="debug-item-value whitespace-pre-wrap break-all">
                    {meta.debug.llm.upstreamBody ?? "无"}
                  </div>
                </div>
              </div>
            ) : null}
          </div>

          <MatchResultGrid
            library={resultLibrary}
            style={resultStyle}
            items={items}
            loading={loading}
            onPreview={(iconName) => setPreviewIcon(iconName)}
            onToast={showToast}
          />
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
