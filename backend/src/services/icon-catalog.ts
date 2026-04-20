import heroiconsOutlineCatalogJson from "@iconcraft/shared/config/icon-catalog/heroicons-outline.json" with { type: "json" };
import heroiconsSolidCatalogJson from "@iconcraft/shared/config/icon-catalog/heroicons-solid.json" with { type: "json" };
import lucideCatalogJson from "@iconcraft/shared/config/icon-catalog/lucide.json" with { type: "json" };
import phosphorDuotoneCatalogJson from "@iconcraft/shared/config/icon-catalog/ph-duotone.json" with { type: "json" };
import phosphorRegularCatalogJson from "@iconcraft/shared/config/icon-catalog/ph-regular.json" with { type: "json" };
import tablerCatalogJson from "@iconcraft/shared/config/icon-catalog/tabler.json" with { type: "json" };

import type { IconCatalogEntry, IconLibraryId, IconStyleId } from "@iconcraft/shared";

const lucideCatalog = lucideCatalogJson as IconCatalogEntry[];
const heroiconsOutlineCatalog = heroiconsOutlineCatalogJson as IconCatalogEntry[];
const heroiconsSolidCatalog = heroiconsSolidCatalogJson as IconCatalogEntry[];
const phosphorRegularCatalog = phosphorRegularCatalogJson as IconCatalogEntry[];
const phosphorDuotoneCatalog = phosphorDuotoneCatalogJson as IconCatalogEntry[];
const tablerCatalog = tablerCatalogJson as IconCatalogEntry[];

function normalizeToken(value: string) {
  return value.trim().toLowerCase().replace(/[\s_\-]+/g, "");
}

function buildAliasMap(entries: IconCatalogEntry[]) {
  const aliasMap = new Map<string, string>();

  for (const entry of entries) {
    aliasMap.set(normalizeToken(entry.name), entry.name);
    for (const alias of entry.aliases) {
      aliasMap.set(normalizeToken(alias), entry.name);
    }
  }

  return aliasMap;
}

function buildCatalogIndex(entries: IconCatalogEntry[]) {
  return {
    entries,
    aliasMap: buildAliasMap(entries),
    nameSet: new Set(entries.map((entry) => entry.name)),
  };
}

const catalogIndexMap = {
  "lucide:linear": buildCatalogIndex(lucideCatalog),
  "heroicons:linear": buildCatalogIndex(heroiconsOutlineCatalog),
  "heroicons:solid": buildCatalogIndex(heroiconsSolidCatalog),
  "ph:regular": buildCatalogIndex(phosphorRegularCatalog),
  "ph:duotone": buildCatalogIndex(phosphorDuotoneCatalog),
  "tabler:linear": buildCatalogIndex(tablerCatalog),
} as const;

function getCatalogIndex(library: IconLibraryId, style: IconStyleId) {
  const key = `${library}:${style}` as keyof typeof catalogIndexMap;
  return catalogIndexMap[key] ?? null;
}

export function getCatalog(library: IconLibraryId, style: IconStyleId) {
  const catalogIndex = getCatalogIndex(library, style);
  if (!catalogIndex) {
    throw new Error(`Unsupported icon library/style: ${library}/${style}`);
  }

  return catalogIndex.entries;
}

export function hasIconName(library: IconLibraryId, style: IconStyleId, name: string) {
  return getCatalogIndex(library, style)?.nameSet.has(name) ?? false;
}

export function exactCatalogMatch(library: IconLibraryId, style: IconStyleId, word: string) {
  return getCatalogIndex(library, style)?.aliasMap.get(normalizeToken(word)) ?? null;
}

export function fallbackCatalogMatch(library: IconLibraryId, style: IconStyleId, word: string) {
  const catalog = getCatalogIndex(library, style)?.entries;
  if (!catalog) return null;

  const normalizedWord = normalizeToken(word);
  if (!normalizedWord) return null;

  let best: { score: number; name: string } | null = null;

  for (const entry of catalog) {
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
