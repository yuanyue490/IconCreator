import heroiconsLinearAliasesJson from "@iconcraft/shared/config/icon-catalog/heroicons/linear/aliases.json" with { type: "json" };
import heroiconsLinearNamesJson from "@iconcraft/shared/config/icon-catalog/heroicons/linear/names.json" with { type: "json" };
import heroiconsSolidAliasesJson from "@iconcraft/shared/config/icon-catalog/heroicons/solid/aliases.json" with { type: "json" };
import heroiconsSolidNamesJson from "@iconcraft/shared/config/icon-catalog/heroicons/solid/names.json" with { type: "json" };
import lucideLinearAliasesJson from "@iconcraft/shared/config/icon-catalog/lucide/linear/aliases.json" with { type: "json" };
import lucideLinearNamesJson from "@iconcraft/shared/config/icon-catalog/lucide/linear/names.json" with { type: "json" };
import phDuotoneAliasesJson from "@iconcraft/shared/config/icon-catalog/ph/duotone/aliases.json" with { type: "json" };
import phDuotoneNamesJson from "@iconcraft/shared/config/icon-catalog/ph/duotone/names.json" with { type: "json" };
import phRegularAliasesJson from "@iconcraft/shared/config/icon-catalog/ph/regular/aliases.json" with { type: "json" };
import phRegularNamesJson from "@iconcraft/shared/config/icon-catalog/ph/regular/names.json" with { type: "json" };
import tablerLinearAliasesJson from "@iconcraft/shared/config/icon-catalog/tabler/linear/aliases.json" with { type: "json" };
import tablerLinearNamesJson from "@iconcraft/shared/config/icon-catalog/tabler/linear/names.json" with { type: "json" };

import type { IconCatalogEntry, IconLibraryId, IconStyleId } from "@iconcraft/shared";

/**
 * 目录采用双层结构：
 *  - aliases.json：人工精选的小词典，带中英同义词，负责「用户词 → 图标名」的高质量命中，
 *    同时作为 LLM 候选清单（控制 prompt 体积）。
 *  - names.json：Iconify 官方的全量图标名，负责「图标名本身是否有效」的裁决，
 *    让 `flame`、`fire` 这种库里存在但别名表没收录的名字也能走通直连/LLM 返回。
 */
interface LibraryCatalog {
  aliases: IconCatalogEntry[];
  names: string[];
}

const CATALOGS: Record<`${IconLibraryId}:${IconStyleId}`, LibraryCatalog> = {
  "lucide:linear": {
    aliases: lucideLinearAliasesJson as IconCatalogEntry[],
    names: lucideLinearNamesJson as string[],
  },
  "heroicons:linear": {
    aliases: heroiconsLinearAliasesJson as IconCatalogEntry[],
    names: heroiconsLinearNamesJson as string[],
  },
  "heroicons:solid": {
    aliases: heroiconsSolidAliasesJson as IconCatalogEntry[],
    names: heroiconsSolidNamesJson as string[],
  },
  "ph:regular": {
    aliases: phRegularAliasesJson as IconCatalogEntry[],
    names: phRegularNamesJson as string[],
  },
  "ph:duotone": {
    aliases: phDuotoneAliasesJson as IconCatalogEntry[],
    names: phDuotoneNamesJson as string[],
  },
  "tabler:linear": {
    aliases: tablerLinearAliasesJson as IconCatalogEntry[],
    names: tablerLinearNamesJson as string[],
  },
};

function normalizeToken(value: string) {
  return value.trim().toLowerCase().replace(/[\s_\-]+/g, "");
}

/**
 * 构建「词 → 规范图标名」映射表：
 *  1) 先写入别名表的所有 name 与 aliases（精选数据优先，覆盖旧名/同义词）；
 *  2) 再把全量名字的每个 name 本身加入（仅当别名表还没占用该 key 时），
 *     这样用户直接输入图标名（如 `flame`）也能直连命中。
 */
function buildAliasMap(aliases: IconCatalogEntry[], fullNames: string[]) {
  const map = new Map<string, string>();

  for (const entry of aliases) {
    map.set(normalizeToken(entry.name), entry.name);
    for (const alias of entry.aliases) {
      map.set(normalizeToken(alias), entry.name);
    }
  }

  for (const name of fullNames) {
    const key = normalizeToken(name);
    if (!key) continue;
    if (!map.has(key)) {
      map.set(key, name);
    }
  }

  return map;
}

function buildCatalogIndex({ aliases, names }: LibraryCatalog) {
  const nameSet = new Set<string>(names);
  // 别名表里少数历史名（如 lucide 的 home）可能已不在 Iconify 全量名单中，
  // 仍保留它们以兼容既有词典条目，请求时由 SVG 代理决定能否取到。
  for (const entry of aliases) {
    nameSet.add(entry.name);
  }

  return {
    aliases,
    aliasMap: buildAliasMap(aliases, names),
    nameSet,
  };
}

const catalogIndexMap = Object.fromEntries(
  Object.entries(CATALOGS).map(([key, catalog]) => [key, buildCatalogIndex(catalog)] as const),
) as Record<keyof typeof CATALOGS, ReturnType<typeof buildCatalogIndex>>;

function getCatalogIndex(library: IconLibraryId, style: IconStyleId) {
  const key = `${library}:${style}` as keyof typeof catalogIndexMap;
  return catalogIndexMap[key] ?? null;
}

/**
 * 返回精选别名词条，用于 LLM prompt 候选清单。
 * 注意：刻意不返回全量名字，避免 prompt 膨胀。
 */
export function getCatalog(library: IconLibraryId, style: IconStyleId) {
  const catalogIndex = getCatalogIndex(library, style);
  if (!catalogIndex) {
    throw new Error(`Unsupported icon library/style: ${library}/${style}`);
  }

  return catalogIndex.aliases;
}

/**
 * 返回图标库全量名字数量，方便上层判断库规模（例如决定要不要提示 LLM 收敛）。
 */
export function getCatalogSize(library: IconLibraryId, style: IconStyleId) {
  return getCatalogIndex(library, style)?.nameSet.size ?? 0;
}

/**
 * 校验「某个图标名是否合法」：命中精选表的 name 或 Iconify 全量名单都算合法。
 * 用于：
 *  - 代理接口在回源 Iconify 前拒绝不存在的名字；
 *  - LLM 返回的名字做最终 gatekeeper。
 */
export function hasIconName(library: IconLibraryId, style: IconStyleId, name: string) {
  return getCatalogIndex(library, style)?.nameSet.has(name) ?? false;
}

/**
 * 直连命中：先查精选别名表，再兜底到全量名字（支持 `flame` 这类未被词典覆盖的合法名）。
 */
export function exactCatalogMatch(library: IconLibraryId, style: IconStyleId, word: string) {
  return getCatalogIndex(library, style)?.aliasMap.get(normalizeToken(word)) ?? null;
}

/**
 * 根据一组英文关键词（通常由 LLM 对用户词扩展得出），在全量名字里找最佳命中。
 *
 * 评分分三级，级别越小越优先；同级内按「关键词在数组中越靠前越优先 → 名字越短越优先」裁决：
 *   - 1 级：关键词与 name 规范化后完全相等          （如 "flame" 命中 "flame"）
 *   - 2 级：关键词等于 name 拆 `- _` 后的某个 token （如 "rocket" 命中 "rocket-launch"）
 *   - 3 级：关键词是 name 的子串                    （如 "fire" 子串命中 "fire-extinguisher"）
 *
 * 这个函数只负责字面匹配，不做任何语义推理；语义推理由上游的 LLM 关键词扩展承担，
 * 从而避免在 prompt 里塞入庞大的全量名字清单。
 */
export function keywordNameMatch(
  library: IconLibraryId,
  style: IconStyleId,
  keywords: string[],
): string | null {
  const index = getCatalogIndex(library, style);
  if (!index) return null;

  const normalizedKws = keywords.map(normalizeToken).filter((kw) => kw.length > 0);
  if (normalizedKws.length === 0) return null;

  const names = [...index.nameSet];

  const pickShortest = (
    matches: string[],
  ): string | null => {
    if (matches.length === 0) return null;
    let best = matches[0];
    for (let i = 1; i < matches.length; i++) {
      if (matches[i].length < best.length) best = matches[i];
    }
    return best;
  };

  // 一级：完全相等，任何一个关键词命中都算高质量，直接按关键词顺序取第一个。
  for (const kw of normalizedKws) {
    const hits = names.filter((name) => normalizeToken(name) === kw);
    const pick = pickShortest(hits);
    if (pick) return pick;
  }

  // 二级：name 拆 token 后精确相等。
  for (const kw of normalizedKws) {
    const hits = names.filter((name) =>
      name.split(/[-_\s]+/).some((token) => normalizeToken(token) === kw),
    );
    const pick = pickShortest(hits);
    if (pick) return pick;
  }

  // 三级：子串包含。最宽，留到最后。
  for (const kw of normalizedKws) {
    const hits = names.filter((name) => normalizeToken(name).includes(kw));
    const pick = pickShortest(hits);
    if (pick) return pick;
  }

  return null;
}

/**
 * 子串相似兜底：只在精选别名表里搜。
 * 全量名字不参与此路径——否则 `error`→`horror`、`info`→`information-circle` 这类伪命中会爆炸。
 */
export function fallbackCatalogMatch(library: IconLibraryId, style: IconStyleId, word: string) {
  const aliases = getCatalogIndex(library, style)?.aliases;
  if (!aliases) return null;

  const normalizedWord = normalizeToken(word);
  if (!normalizedWord) return null;

  let best: { score: number; name: string } | null = null;

  for (const entry of aliases) {
    const candidates = [entry.name, ...entry.aliases];
    for (const candidate of candidates) {
      const normalizedCandidate = normalizeToken(candidate);
      if (!normalizedCandidate) continue;

      const exactContain =
        normalizedCandidate.includes(normalizedWord) ||
        normalizedWord.includes(normalizedCandidate);

      if (!exactContain) continue;

      const lengthDelta = Math.abs(normalizedCandidate.length - normalizedWord.length);
      const score = lengthDelta;

      if (!best || score < best.score) {
        best = { score, name: entry.name };
      }
    }
  }

  return best?.name ?? null;
}
