import type { FormEvent } from "react";

import { Icon } from "@iconify/react";

import { useSettingsStore } from "../stores/settings-store";

interface SettingsDialogProps {
  open: boolean;
  onClose: () => void;
}

export function SettingsDialog({ open, onClose }: SettingsDialogProps) {
  const { baseURL, apiKey, model, systemPrompt, setField, reset } = useSettingsStore();

  if (!open) return null;

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    onClose();
  }

  return (
    <>
      <button className="dialog-backdrop" onClick={onClose} aria-label="关闭设置弹窗" />
      <div className="dialog-panel surface-elevated p-5">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div className="min-w-0 pr-1">
            <div className="text-lg font-semibold">设置</div>
            <div className="mt-1 text-sm text-[#8a8a8a]">
              此处可修改接入自己的模型，也可以调整默认的SVG模型匹配提示词
            </div>
          </div>
          <button
            type="button"
            className="btn-subtle inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
            onClick={onClose}
            aria-label="关闭"
          >
            <Icon icon="lucide:x" width="16" height="16" />
          </button>
        </div>

        <form className="space-y-4" onSubmit={handleSubmit}>
          <label className="block">
            <div className="mb-2 text-sm text-[#a0a0a0]">Base URL</div>
            <input
              className="field-input"
              value={baseURL}
              onChange={(event) => setField("baseURL", event.target.value)}
              placeholder="https://api.openai.com/v1"
            />
          </label>

          <label className="block">
            <div className="mb-2 text-sm text-[#a0a0a0]">API Key</div>
            <input
              className="field-input"
              type="password"
              value={apiKey}
              onChange={(event) => setField("apiKey", event.target.value)}
              placeholder="sk-..."
            />
          </label>

          <label className="block">
            <div className="mb-2 text-sm text-[#a0a0a0]">Model</div>
            <input
              className="field-input"
              value={model}
              onChange={(event) => setField("model", event.target.value)}
              placeholder="gpt-4o-mini / deepseek-chat / kimi-k2"
            />
          </label>

          <label className="block">
            <div className="mb-2 text-sm text-[#a0a0a0]">System Prompt</div>
            <textarea
              className="field-input min-h-[180px] resize-y leading-6"
              value={systemPrompt}
              onChange={(event) => setField("systemPrompt", event.target.value)}
              placeholder="在这里微调图标匹配的大模型 system prompt"
            />
            <div className="mt-2 text-xs leading-5 text-[#6f6f6f]">
              该配置仅保存在当前浏览器本地。你可以在这里微调匹配策略、约束返回格式、收紧或放宽图标选择规则。
            </div>
          </label>

          <div className="flex items-center justify-between gap-3 pt-2">
            <button
              type="button"
              className="btn-subtle h-9 rounded-lg px-3 text-sm"
              onClick={reset}
            >
              还原配置
            </button>
            <button type="submit" className="btn-primary h-9 rounded-lg px-4 text-sm">
              保存
            </button>
          </div>
        </form>
      </div>
    </>
  );
}
