import type { Ai3dIconStylesCatalog } from "@iconcraft/shared";

import stylesCatalogJson from "@iconcraft/shared/config/ai-3d-icon-styles.json";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

const catalog = stylesCatalogJson as Ai3dIconStylesCatalog;
const FALLBACK_STYLE_ID = catalog.styles[0]?.id ?? "b-end-dashboard";

function isKnownStyleId(id: string | undefined): id is string {
  return Boolean(id && catalog.styles.some((s) => s.id === id));
}

type AiPromptStyleState = {
  selectedStyleId: string;
  setSelectedStyleId: (id: string) => void;
};

export const useAiPromptStyleStore = create<AiPromptStyleState>()(
  persist(
    (set) => ({
      selectedStyleId: FALLBACK_STYLE_ID,
      setSelectedStyleId: (id) => {
        if (!catalog.styles.some((s) => s.id === id)) return;
        set({ selectedStyleId: id });
      },
    }),
    {
      name: "iconcraft-ai-prompt-style",
      version: 1,
      storage: createJSONStorage(() => localStorage),
      migrate: (persisted) => {
        const p = persisted as { selectedStyleId?: string };
        return {
          selectedStyleId: isKnownStyleId(p.selectedStyleId) ? p.selectedStyleId! : FALLBACK_STYLE_ID,
        };
      },
      partialize: (state) => ({ selectedStyleId: state.selectedStyleId }),
    },
  ),
);

/** 运行时解析当前选中的模板（与 JSON 同源） */
export function getAiStylesCatalog(): Ai3dIconStylesCatalog {
  return catalog;
}

export function getDefaultAiStyleId(): string {
  return FALLBACK_STYLE_ID;
}
