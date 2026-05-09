import { useEffect, useState, type FormEvent } from "react";

import { Icon } from "@iconify/react";
import type { PromptSkillImageConfigResponse } from "@iconcraft/shared";

import { fetchPromptSkillImageConfig } from "../lib/api";
import { EXPORT_SIZE_PRESETS, isPresetSize } from "../lib/export-appearance";
import { useSettingsStore } from "../stores/settings-store";

interface SettingsDialogProps {
  open: boolean;
  onClose: () => void;
}

function cleanImageModelName(value: string | undefined) {
  return (
    value
      ?.replace(/\\n|\\r/g, "\n")
      .split(/\r?\n/)
      .map((item) => item.trim())
      .find((item) => item && !item.includes("=") && !item.includes("_API_KEY")) ?? ""
  );
}

export function SettingsDialog({ open, onClose }: SettingsDialogProps) {
  const {
    baseURL,
    apiKey,
    model,
    systemPrompt,
    exportIconSizePx,
    exportIconColor,
    digitalTwinImageModel,
    setField,
    reset,
  } = useSettingsStore();
  const [imageConfig, setImageConfig] = useState<PromptSkillImageConfigResponse | null>(null);
  const [imageConfigLoading, setImageConfigLoading] = useState(false);
  const [imageConfigError, setImageConfigError] = useState("");

  useEffect(() => {
    if (!open) return;

    let ignore = false;

    async function loadImageConfig() {
      setImageConfigLoading(true);
      setImageConfigError("");
      try {
        const config = await fetchPromptSkillImageConfig();
        if (ignore) return;
        setImageConfig(config);
        if (!digitalTwinImageModel && config.configured) {
          setField(
            "digitalTwinImageModel",
            cleanImageModelName(config.modelOptions[0]) || cleanImageModelName(config.model),
          );
        }
      } catch (error) {
        if (ignore) return;
        setImageConfigError(error instanceof Error ? error.message : "图片生成服务状态获取失败");
      } finally {
        if (!ignore) {
          setImageConfigLoading(false);
        }
      }
    }

    void loadImageConfig();

    return () => {
      ignore = true;
    };
  }, [digitalTwinImageModel, open, setField]);

  if (!open) return null;

  const safeExportSize = isPresetSize(exportIconSizePx) ? exportIconSizePx : 24;
  const safeExportColor = /^#[0-9a-fA-F]{6}$/.test(exportIconColor)
    ? exportIconColor
    : "#fafafa";
  const configModelOptions = [...new Set((imageConfig?.modelOptions ?? []).map(cleanImageModelName).filter(Boolean))];
  const configModel = cleanImageModelName(imageConfig?.model);
  const digitalTwinModelValue = digitalTwinImageModel || configModelOptions[0] || configModel || "";
  const digitalTwinModelOptions = configModelOptions.length
    ? configModelOptions
    : digitalTwinModelValue
      ? [digitalTwinModelValue]
      : [];
  const imageConfigWarning =
    imageConfig?.warning ||
    ((imageConfig?.model && !configModel) || (imageConfig?.modelOptions ?? []).some((item) => !cleanImageModelName(item))
      ? "图片模型配置格式异常，请检查服务端环境变量。"
      : "");

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
            <div className="text-lg font-semibold">高级设置</div>
            <div className="mt-1 text-sm text-[#8a8a8a]">
              按功能分别调整生成、匹配与数字孪生相关设置。
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
          <section className="rounded-2xl bg-[#101010] p-4 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.06)]">
            <div className="mb-1 text-sm font-semibold text-[#f0f0f0]">AI 生成</div>
            <p className="text-xs leading-5 text-[#777]">
              图标图片生成服务由服务端统一配置；分辨率、比例、主色和材质在 AI 生成面板内选择。
            </p>
          </section>

          <section className="space-y-4 rounded-2xl bg-[#101010] p-4 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.06)]">
            <div>
              <div className="mb-1 text-sm font-semibold text-[#f0f0f0]">SVG 匹配</div>
              <p className="text-xs leading-5 text-[#777]">
                用于一组词到同风格 SVG 图标的语义匹配，以及 SVG 预览、复制和导出的外观。
              </p>
            </div>

            <label className="block">
              <div className="mb-2 text-sm text-[#a0a0a0]">服务地址</div>
              <input
                className="field-input"
                value={baseURL}
                onChange={(event) => setField("baseURL", event.target.value)}
                placeholder="https://api.openai.com/v1"
              />
            </label>

            <label className="block">
              <div className="mb-2 text-sm text-[#a0a0a0]">访问密钥</div>
              <input
                className="field-input"
                type="password"
                value={apiKey}
                onChange={(event) => setField("apiKey", event.target.value)}
                placeholder="sk-..."
              />
            </label>

            <label className="block">
              <div className="mb-2 text-sm text-[#a0a0a0]">模型名称</div>
              <input
                className="field-input"
                value={model}
                onChange={(event) => setField("model", event.target.value)}
                placeholder="gpt-4o-mini / deepseek-chat / kimi-k2"
              />
            </label>

            <label className="block">
              <div className="mb-2 text-sm text-[#a0a0a0]">匹配规则</div>
              <textarea
                className="field-input min-h-[150px] resize-y leading-6"
                value={systemPrompt}
                onChange={(event) => setField("systemPrompt", event.target.value)}
                placeholder="在这里微调图标匹配规则"
              />
              <div className="mt-2 text-xs leading-5 text-[#6f6f6f]">
                这些内容仅保存在当前浏览器本地，用于调整图标匹配的偏好与约束。
              </div>
            </label>

            <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
              <label className="block">
                <div className="mb-2 text-sm text-[#a0a0a0]">SVG 边长</div>
                <select
                  className="field-input"
                  value={safeExportSize}
                  onChange={(event) =>
                    setField("exportIconSizePx", Number.parseInt(event.target.value, 10) || 24)
                  }
                >
                  {EXPORT_SIZE_PRESETS.map((px) => (
                    <option value={px} key={px}>
                      {px}px
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <div className="mb-2 text-sm text-[#a0a0a0]">SVG 颜色</div>
                <div className="grid grid-cols-[44px_minmax(0,1fr)] gap-2">
                  <input
                    type="color"
                    className="h-10 w-11 rounded-lg border border-white/8 bg-[#111] p-1"
                    value={safeExportColor}
                    onChange={(event) => setField("exportIconColor", event.target.value)}
                    aria-label="SVG 颜色"
                  />
                  <input
                    className="field-input"
                    value={exportIconColor}
                    onChange={(event) => setField("exportIconColor", event.target.value)}
                    placeholder="#fafafa"
                    spellCheck={false}
                  />
                </div>
              </label>
            </div>
          </section>

          <section className="space-y-4 rounded-2xl bg-[#101010] p-4 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.06)]">
            <div>
              <div className="mb-1 text-sm font-semibold text-[#f0f0f0]">数字孪生</div>
              <p className="text-xs leading-5 text-[#777]">
                用于数字孪生参考图生成。比例、画幅和场景要求请写入提示词。
              </p>
            </div>

            <label className="block">
              <div className="mb-2 text-sm text-[#a0a0a0]">图片模型</div>
              {digitalTwinModelOptions.length > 1 ? (
                <select
                  className="field-input"
                  value={digitalTwinModelValue}
                  onChange={(event) => setField("digitalTwinImageModel", event.target.value)}
                  disabled={imageConfigLoading}
                >
                  {digitalTwinModelOptions.map((item) => (
                    <option value={item} key={item}>
                      {item}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  className="field-input"
                  value={
                    imageConfigLoading
                      ? "读取中..."
                      : digitalTwinModelValue || (imageConfig?.configured ? "服务端默认模型" : "服务未就绪")
                  }
                  readOnly
                />
              )}
              <div className="mt-2 text-xs leading-5 text-[#6f6f6f]">
                {imageConfigError
                  ? imageConfigError
                  : imageConfigWarning
                    ? imageConfigWarning
                  : imageConfig?.configured
                    ? "模型列表由服务端配置。只有配置了多个可用模型时，这里才会出现可切换选项。"
                    : "图片生成服务暂未就绪，请联系管理员处理。"}
              </div>
            </label>
          </section>

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
