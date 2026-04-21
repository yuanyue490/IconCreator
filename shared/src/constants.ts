import type { IconLibraryId, IconStyleId } from "./types.js";

export interface IconLibraryStyleOption {
  id: IconStyleId;
  label: string;
  collection: string;
}

export interface IconLibraryOption {
  id: IconLibraryId;
  label: string;
  styles: IconLibraryStyleOption[];
}

export const ICON_LIBRARIES: IconLibraryOption[] = [
  {
    id: "lucide",
    label: "Lucide",
    styles: [{ id: "linear", label: "线性", collection: "lucide" }],
  },
  {
    id: "heroicons",
    label: "Heroicons",
    styles: [
      { id: "linear", label: "线性", collection: "heroicons-outline" },
      { id: "solid", label: "填充", collection: "heroicons-solid" },
    ],
  },
  {
    id: "ph",
    label: "Phosphor",
    styles: [
      { id: "regular", label: "常规", collection: "ph" },
      { id: "duotone", label: "双色", collection: "ph" },
    ],
  },
  {
    id: "tabler",
    label: "Tabler",
    styles: [{ id: "linear", label: "线性", collection: "tabler" }],
  },
];

export function getLibraryConfig(libraryId: IconLibraryId) {
  return ICON_LIBRARIES.find((library) => library.id === libraryId) ?? null;
}

export function getLibraryStyleConfig(libraryId: IconLibraryId, styleId: IconStyleId) {
  const library = getLibraryConfig(libraryId);
  if (!library) return null;

  return library.styles.find((style) => style.id === styleId) ?? null;
}

export function isSupportedLibraryStyle(libraryId: IconLibraryId, styleId: IconStyleId) {
  return getLibraryStyleConfig(libraryId, styleId) !== null;
}

export const MATCH_LIMIT = 20;

export const DEFAULT_MATCH_LIBRARY: IconLibraryId = "lucide";

export const DEFAULT_MATCH_STYLE: IconStyleId = "linear";
