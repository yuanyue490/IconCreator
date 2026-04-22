import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import type { IconLibraryId, IconStyleId, MatchItem } from "@iconcraft/shared";

const MAX_HISTORY_SESSIONS = 10;

export interface MatchHistorySession {
  id: string;
  createdAt: number;
  queryText: string;
  library: IconLibraryId;
  style: IconStyleId;
  items: MatchItem[];
  meta: {
    total: number;
    matched: number;
    durationMs: number;
    usedLlm: boolean;
    llmAttempted: boolean;
    llmSuccess: boolean;
    llmModel: string | null;
    llmError: string | null;
  };
}

type MatchHistoryState = {
  sessions: MatchHistorySession[];
  addSession: (session: MatchHistorySession) => void;
  clearSessions: () => void;
};

export const useMatchHistoryStore = create<MatchHistoryState>()(
  persist(
    (set) => ({
      sessions: [],
      addSession: (session) =>
        set((state) => ({
          sessions: [session, ...state.sessions].slice(0, MAX_HISTORY_SESSIONS),
        })),
      clearSessions: () => set({ sessions: [] }),
    }),
    {
      name: "iconcraft-match-history",
      version: 1,
      storage: createJSONStorage(() => localStorage),
      partialize: ({ sessions }) => ({ sessions }),
    },
  ),
);
