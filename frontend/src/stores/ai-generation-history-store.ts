import type { AiGenerateResponse, AiImageAspectRatio, AiImageResolution } from "@iconcraft/shared";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

const MAX_HISTORY_SESSIONS = 10;

/** 单条入库可序列化快照（远端 URL 可能过期；若上游返回 base64 则更耐存） */
export interface AiGenerationHistoryImage {
  url: string | null;
  b64Json: string | null;
}

export interface AiGenerationHistorySession {
  id: string;
  createdAt: number;
  objectName: string;
  colorLabel: string;
  materialLabel: string;
  resolution: AiImageResolution;
  aspectRatio: AiImageAspectRatio;
  prompt: string;
  negativePrompt: string;
  images: AiGenerationHistoryImage[];
  meta: AiGenerateResponse["meta"];
  /** 生成时选用的提示词风格（早期记录可能没有） */
  styleId?: string;
  styleLabel?: string;
}

type AiGenerationHistoryState = {
  sessions: AiGenerationHistorySession[];
  addSession: (session: AiGenerationHistorySession) => void;
  restoreSession: (session: AiGenerationHistorySession, index: number) => void;
  removeSession: (sessionId: string) => void;
  clearSessions: () => void;
};

export const useAiGenerationHistoryStore = create<AiGenerationHistoryState>()(
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
      name: "iconcraft-ai-generation-history",
      version: 1,
      storage: createJSONStorage(() => localStorage),
      partialize: ({ sessions }) => ({ sessions }),
    },
  ),
);
