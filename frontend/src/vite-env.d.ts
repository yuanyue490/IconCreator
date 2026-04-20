/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_DEFAULT_LLM_BASE_URL?: string;
  readonly VITE_DEFAULT_LLM_API_KEY?: string;
  readonly VITE_DEFAULT_LLM_MODEL?: string;
  readonly VITE_DEFAULT_LLM_SYSTEM_PROMPT?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
