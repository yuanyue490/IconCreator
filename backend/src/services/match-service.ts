import type {
  MatchItem,
  MatchRequest,
  MatchResponse,
} from "@iconcraft/shared";

import {
  exactCatalogMatch,
  fallbackCatalogMatch,
  getCatalog,
  hasIconName,
  keywordNameMatch,
} from "./icon-catalog.js";
import {
  canUseLlm,
  requestKeywordExpansion,
  requestLlmMatches,
  resolveLlmConfig,
} from "./llm-client.js";

function createUnmatched(word: string, reason?: string): MatchItem {
  return {
    word,
    status: "unmatched",
    iconName: null,
    source: null,
    reason,
  };
}

export async function matchIcons(request: MatchRequest): Promise<MatchResponse> {
  const startedAt = Date.now();
  const catalog = getCatalog(request.library, request.style);
  const resolvedItems = new Array<MatchItem>(request.words.length);
  const unresolved: Array<{ word: string; index: number }> = [];
  // 合并「前端配置 + 服务端兜底」后再产出 debug，
  // 让前端调试面板里 authHeaderPresent / model 反映真实发起请求时的状态。
  const resolvedLlm = resolveLlmConfig(request.llm);
  const debug: MatchResponse["meta"]["debug"] = {
    llm: {
      enabledByConfig: canUseLlm(request.llm),
      attempted: false,
      requestUrl: null,
      model: resolvedLlm.model || null,
      authHeaderPresent: Boolean(resolvedLlm.apiKey),
      upstreamStatus: null,
      success: false,
      error: null,
      upstreamBody: null,
    },
  };

  request.words.forEach((word: string, index: number) => {
    const exact = exactCatalogMatch(request.library, request.style, word);
    if (exact) {
      resolvedItems[index] = {
        word,
        status: "matched",
        iconName: exact,
        source: "catalog",
      };
      return;
    }

    unresolved.push({ word, index });
    resolvedItems[index] = createUnmatched(word);
  });

  const usedLlm = unresolved.length > 0 && canUseLlm(request.llm);

  if (unresolved.length > 0 && usedLlm) {
    const llmResult = await requestLlmMatches({
      words: unresolved.map((item) => item.word),
      catalog,
      llm: request.llm,
    });

    debug.llm = llmResult.debug;

    if (llmResult.matches) {
      for (const unresolvedItem of unresolved) {
        const fromLlm = llmResult.matches.find((item) => item.word === unresolvedItem.word);
        const iconName = fromLlm?.iconName;
        if (iconName && hasIconName(request.library, request.style, iconName)) {
          resolvedItems[unresolvedItem.index] = {
            word: unresolvedItem.word,
            status: "matched",
            iconName,
            source: "llm",
            reason: fromLlm?.reason,
          };
        }
      }
    }
  }

  // 新增一步：对前两级全部 miss 的词，调一次「LLM 关键词扩展」+「全量名字字面匹配」。
  // 这条路解决「用户词在精选词典里没有对应别名、但 Iconify 全量名字里其实存在」的场景，
  // 典型例子：中文「火」→ LLM 给出 ["fire","flame","burn"] → 在 names.json 里命中 flame。
  const stillUnresolved = unresolved.filter(
    ({ index }) => resolvedItems[index].status !== "matched",
  );
  if (stillUnresolved.length > 0 && canUseLlm(request.llm)) {
    const keywordDebug = await requestKeywordExpansion({
      words: stillUnresolved.map((item) => item.word),
      llm: request.llm,
    });
    debug.keyword = {
      attempted: keywordDebug.attempted,
      success: keywordDebug.success,
      requestUrl: keywordDebug.requestUrl,
      upstreamStatus: keywordDebug.upstreamStatus,
      error: keywordDebug.error,
      expansions: keywordDebug.expansions,
    };

    if (keywordDebug.success && keywordDebug.expansions) {
      for (const { word, index } of stillUnresolved) {
        const keywords = keywordDebug.expansions[word];
        if (!keywords?.length) continue;

        const matchedName = keywordNameMatch(request.library, request.style, keywords);
        if (matchedName && hasIconName(request.library, request.style, matchedName)) {
          resolvedItems[index] = {
            word,
            status: "matched",
            iconName: matchedName,
            // 复用 "llm" 来源，UI 不必为这条分支新增样式；reason 里说明是关键词扩展路径。
            source: "llm",
            reason: `Matched via LLM keyword expansion: ${keywords.slice(0, 5).join(", ")}`,
          };
        }
      }
    }
  }

  unresolved.forEach(({ word, index }) => {
    if (resolvedItems[index].status === "matched") {
      return;
    }

    const fallback = fallbackCatalogMatch(request.library, request.style, word);
    if (fallback) {
      resolvedItems[index] = {
        word,
        status: "matched",
        iconName: fallback,
        source: "fallback",
        reason: "Matched by local fallback catalog.",
      };
      return;
    }

    resolvedItems[index] = createUnmatched(
      word,
      usedLlm
        ? "No safe catalog match found after LLM + fallback."
        : "No exact local match found. Add LLM config for semantic matching.",
    );
  });

  return {
    library: request.library,
    style: request.style,
    items: resolvedItems,
    meta: {
      total: resolvedItems.length,
      matched: resolvedItems.filter((item) => item.status === "matched").length,
      durationMs: Date.now() - startedAt,
      usedLlm,
      debug,
    },
  };
}
