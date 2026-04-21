import { create } from "zustand";
import { persist } from "zustand/middleware";

import type { AppSettings } from "@iconcraft/shared";

type SettingsState = AppSettings & {
  setField: <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => void;
  reset: () => void;
};

const DEFAULT_SYSTEM_PROMPT = [
  "You are an icon matching assistant.",
  "Please perform a fuzzy search for a similar icon name for each user word.",
  "You must only choose icon names from the provided catalog.",
  "If there is no good match, return null.",
  "Return JSON only, no markdown.",
  'Output format: {"matches":[{"word":"...", "iconName":"..." | null, "reason":"..."}]}',
].join(" ");

function buildDefaultSettings(): AppSettings {
  // 安全边界：apiKey 只允许在开发模式下预置。
  // 生产构建时 import.meta.env.DEV 为 false，Vite 会在编译期剔除 false 分支，
  // 从而保证 VITE_DEFAULT_LLM_API_KEY 的真实值不会被打进前端 JS。
  const devPresetApiKey = import.meta.env.DEV
    ? import.meta.env.VITE_DEFAULT_LLM_API_KEY?.trim() ?? ""
    : "";

  return {
    baseURL: import.meta.env.VITE_DEFAULT_LLM_BASE_URL?.trim() ?? "",
    apiKey: devPresetApiKey,
    model: import.meta.env.VITE_DEFAULT_LLM_MODEL?.trim() ?? "",
    systemPrompt:
      import.meta.env.VITE_DEFAULT_LLM_SYSTEM_PROMPT?.trim() || DEFAULT_SYSTEM_PROMPT,
  };
}

const defaultSettings = buildDefaultSettings();

function shouldUseFreshDefaults(persisted: Partial<AppSettings>) {
  const baseURL = persisted.baseURL?.trim() ?? "";
  const model = persisted.model?.trim() ?? "";

  return (
    !baseURL ||
    !model ||
    baseURL.includes("minimax") ||
    model.toLowerCase().includes("minimax") ||
    model === "zai-org/GLM-5.1"
  );
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      ...defaultSettings,
      setField: (key, value) => set((state) => ({ ...state, [key]: value })),
      reset: () => set(defaultSettings),
    }),
    {
      name: "iconcraft-settings",
      version: 5,
      partialize: ({ baseURL, apiKey, model, systemPrompt }) => ({
        baseURL,
        apiKey,
        model,
        systemPrompt,
      }),
      migrate: (persistedState) => {
        const persisted = (persistedState ?? {}) as Partial<AppSettings>;

        if (shouldUseFreshDefaults(persisted)) {
          return defaultSettings;
        }

        return {
          ...defaultSettings,
          ...persisted,
          baseURL: persisted.baseURL?.trim() || defaultSettings.baseURL,
          apiKey: persisted.apiKey?.trim() || defaultSettings.apiKey,
          model: persisted.model?.trim() || defaultSettings.model,
          systemPrompt: persisted.systemPrompt?.trim() || defaultSettings.systemPrompt,
        };
      },
    },
  ),
);
