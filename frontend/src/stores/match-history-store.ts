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
  restoreSession: (session: MatchHistorySession, index: number) => void;
  removeSession: (sessionId: string) => void;
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
      restoreSession: (session, index) =>
        set((state) => {
          const nextSessions = [...state.sessions];
          const safeIndex = Math.max(0, Math.min(index, nextSessions.length));
          nextSessions.splice(safeIndex, 0, session);
          return {
            sessions: nextSessions
              .filter((current, currentIndex, list) =>
                list.findIndex((candidate) => candidate.id === current.id) === currentIndex,
              )
              .slice(0, MAX_HISTORY_SESSIONS),
          };
        }),
      removeSession: (sessionId) =>
        set((state) => ({
          sessions: state.sessions.filter((s) => s.id !== sessionId),
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
