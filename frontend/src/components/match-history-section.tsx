import { Icon } from "@iconify/react";
import { getLibraryConfig, getLibraryStyleConfig } from "@iconcraft/shared";

import { MatchResultGrid } from "./match-result-grid";
import type { MatchHistorySession } from "../stores/match-history-store";

interface MatchHistorySectionProps {
  session: MatchHistorySession;
  exporting: boolean;
  onExport: (session: MatchHistorySession) => void;
  onPreview: (session: MatchHistorySession, iconName: string) => void;
  onToast: (message: string) => void;
}

function buildSourceSummary(session: MatchHistorySession) {
  return session.items.reduce(
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
}

function buildCompactSummary(session: MatchHistorySession, unmatched: number) {
  return unmatched > 0
    ? `处理 ${session.meta.total} 个词，命中 ${session.meta.matched} 个，未匹配 ${unmatched} 个`
    : `处理 ${session.meta.total} 个词，命中 ${session.meta.matched} 个`;
}

function buildCompactStats(summary: ReturnType<typeof buildSourceSummary>) {
  const stats: Array<{ key: string; label: string; tone?: "llm" | "fallback" | "unmatched" }> = [];

  if (summary.catalog > 0) {
    stats.push({ key: "catalog", label: `词典 ${summary.catalog}` });
  }
  if (summary.llm > 0) {
    stats.push({ key: "llm", label: `LLM ${summary.llm}`, tone: "llm" });
  }
  if (summary.fallback > 0) {
    stats.push({ key: "fallback", label: `兜底 ${summary.fallback}`, tone: "fallback" });
  }
  if (summary.unmatched > 0) {
    stats.push({ key: "unmatched", label: `未匹配 ${summary.unmatched}`, tone: "unmatched" });
  }

  return stats;
}

function buildPipelineLabel(session: MatchHistorySession) {
  return session.meta.usedLlm ? "词典 + LLM" : "仅词典";
}

function buildFeedbackText(session: MatchHistorySession) {
  const modelName = session.meta.llmModel?.trim() || "未识别模型";

  if (!session.meta.llmAttempted) {
    return "";
  }

  if (session.meta.llmSuccess) {
    return `反馈：语义匹配请求成功（模型：${modelName}）。`;
  }

  return `反馈：语义匹配请求未成功（模型：${modelName}，${session.meta.llmError ?? "未知原因"}）。`;
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

export function MatchHistorySection({
  session,
  exporting,
  onExport,
  onPreview,
  onToast,
}: MatchHistorySectionProps) {
  const sourceSummary = buildSourceSummary(session);
  const compactStats = buildCompactStats(sourceSummary);
  const compactSummary = buildCompactSummary(session, sourceSummary.unmatched);
  const feedbackText = buildFeedbackText(session);
  const libraryConfig = getLibraryConfig(session.library);
  const styleConfig = getLibraryStyleConfig(session.library, session.style);

  return (
    <div className="match-session">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="match-session__header">
            <div className="match-session__query" title={session.queryText}>
              {session.queryText}
            </div>
            <span className="match-session__time">{formatTimestamp(session.createdAt)}</span>
          </div>
          <div className="match-session__meta">
            <span className="font-medium">
              {libraryConfig?.label ?? "未知图标库"} · {styleConfig?.label ?? "默认风格"}
            </span>
            <span className="text-[#5a5a5a]">·</span>
            <span className="font-medium">
              命中 {session.meta.matched}/{session.meta.total}
            </span>
            <span className="text-[#5a5a5a]">·</span>
            <span className="font-mono text-[#a0a0a0]">{session.meta.durationMs} ms</span>
            <span className="text-[#5a5a5a]">·</span>
            <span className="font-mono text-[#a0a0a0]">{buildPipelineLabel(session)}</span>
            <span className="text-[#5a5a5a]">·</span>
            <span className="match-info__text">{compactSummary}</span>
            {compactStats.map((stat) => (
              <span key={stat.key} className={`match-stat${stat.tone ? ` match-stat--${stat.tone}` : ""}`}>
                {stat.label}
              </span>
            ))}
            <span className="info-tooltip" tabIndex={0} role="button" aria-label="查看匹配流程说明">
              <Icon icon="lucide:circle-help" width="13" />
              <span className="info-tooltip__bubble">
                处理顺序：先查本地词典；词典未命中且已配置模型时，再交给 LLM 做语义匹配；若模型结果不存在或不可信，再走本地兜底；仍然失败则标记为未匹配，不会强行硬猜。
              </span>
            </span>
          </div>
        </div>

        <div className="match-session__actions">
          <button
            className="btn-ghost inline-flex h-8 items-center gap-1.5 rounded-lg px-3 text-sm"
            onClick={() => onExport(session)}
            disabled={exporting}
          >
            <Icon icon={exporting ? "lucide:loader-circle" : "lucide:archive"} width="14" />
            {exporting ? "打包中..." : "导出这组"}
          </button>
        </div>
      </div>

      <MatchResultGrid
        library={session.library}
        style={session.style}
        items={session.items}
        loading={false}
        onPreview={(iconName) => onPreview(session, iconName)}
        onToast={onToast}
      />
      {feedbackText ? <p className="match-feedback mt-6">{feedbackText}</p> : null}
    </div>
  );
}
