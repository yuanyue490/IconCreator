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
} from "./icon-catalog.js";
import { canUseLlm, requestLlmMatches } from "./llm-client.js";

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
  const debug = {
    llm: {
      enabledByConfig: canUseLlm(request.llm),
      attempted: false,
      requestUrl: null as string | null,
      model: request.llm?.model?.trim() || null,
      authHeaderPresent: Boolean(request.llm?.apiKey?.trim()),
      upstreamStatus: null as number | null,
      success: false,
      error: null as string | null,
      upstreamBody: null as string | null,
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
