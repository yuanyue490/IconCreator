import { useMemo, useRef, useState } from "react";

import { Icon } from "@iconify/react";
import type { Ai3dIconPresetsConfig, Ai3dIconStyleConfig, AiImageAspectRatio, AiImageResolution } from "@iconcraft/shared";
import presetsConfigJson from "@iconcraft/shared/config/ai-3d-icon-presets.json";

import { AiHistorySection } from "./ai-history-section";
import { generateAiIcons } from "../lib/api";
import type { AiGenerationHistorySession } from "../stores/ai-generation-history-store";
import { useAiGenerationHistoryStore } from "../stores/ai-generation-history-store";
import { getAiStylesCatalog, useAiPromptStyleStore } from "../stores/ai-prompt-style-store";

const presetsConfig = presetsConfigJson as Ai3dIconPresetsConfig;

const RESOLUTION_OPTIONS: AiImageResolution[] = ["1K", "2K", "4K"];
const RATIO_OPTIONS: AiImageAspectRatio[] = ["1:1", "16:9", "9:16", "4:3", "3:4"];

function applyStyleVars(template: Ai3dIconStyleConfig, values: { object: string; color: string; material: string }) {
  const replacements: Record<string, string> = {
    [template.vars.object]: values.object.trim() || template.vars.object,
    [template.vars.color]: values.color.trim() || template.vars.color,
    [template.vars.material]: values.material.trim() || template.vars.material,
  };

  let prompt = template.prompt;
  let negativePrompt = template.negative;
  for (const [token, value] of Object.entries(replacements)) {
    prompt = prompt.split(token).join(value);
    negativePrompt = negativePrompt.split(token).join(value);
  }
  return { prompt, negativePrompt };
}

export function AiGenerateSection({
  onToast,
}: {
  onToast: (message: string, options?: { actionLabel?: string; onAction?: () => void }) => void;
}) {
  const [objectName, setObjectName] = useState("摄像头");
  const [selectedColorId, setSelectedColorId] = useState(presetsConfig.colors[0]?.id ?? "");
  const [selectedMaterialId, setSelectedMaterialId] = useState(presetsConfig.materials[0]?.id ?? "");
  const [customColor, setCustomColor] = useState("");
  const [customMaterial, setCustomMaterial] = useState("");
  const [resolution, setResolution] = useState<AiImageResolution>("2K");
  const [aspectRatio, setAspectRatio] = useState<AiImageAspectRatio>("1:1");
  const [loading, setLoading] = useState(false);
  const [promptPreviewOpen, setPromptPreviewOpen] = useState(false);

  const aiSessions = useAiGenerationHistoryStore((state) => state.sessions);
  const addAiSession = useAiGenerationHistoryStore((state) => state.addSession);
  const restoreAiSession = useAiGenerationHistoryStore((state) => state.restoreSession);
  const removeAiSession = useAiGenerationHistoryStore((state) => state.removeSession);
  const selectedStyleId = useAiPromptStyleStore((state) => state.selectedStyleId);
  const setSelectedStyleId = useAiPromptStyleStore((state) => state.setSelectedStyleId);
  const pendingDeletedAiSessionRef = useRef<{
    session: AiGenerationHistorySession;
    index: number;
  } | null>(null);

  const stylesCatalog = getAiStylesCatalog();
  const activeVariant =
    stylesCatalog.styles.find((s) => s.id === selectedStyleId) ?? stylesCatalog.styles[0];

  const selectedColor = presetsConfig.colors.find((item) => item.id === selectedColorId) ?? presetsConfig.colors[0];
  const selectedMaterial =
    presetsConfig.materials.find((item) => item.id === selectedMaterialId) ?? presetsConfig.materials[0];
  const colorPhrase = customColor.trim() || selectedColor?.phrase || "";
  const materialPhrase = customMaterial.trim() || selectedMaterial?.phrase || "";
  const filledPrompts = useMemo(
    () =>
      activeVariant
        ? applyStyleVars(activeVariant, { object: objectName, color: colorPhrase, material: materialPhrase })
        : { prompt: "", negativePrompt: "" },
    [activeVariant, objectName, colorPhrase, materialPhrase],
  );

  async function handleGenerate() {
    if (!objectName.trim()) {
      onToast("先输入要生成的物体");
      return;
    }
    if (!colorPhrase || !materialPhrase) {
      onToast("请选择主色和材质");
      return;
    }

    setLoading(true);
    try {
      const response = await generateAiIcons({
        object: objectName.trim(),
        colorPhrase,
        materialPhrase,
        prompt: filledPrompts.prompt,
        negativePrompt: filledPrompts.negativePrompt,
        resolution,
        aspectRatio,
        count: 2,
      });

      addAiSession({
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        createdAt: Date.now(),
        styleId: activeVariant?.id,
        styleLabel: activeVariant?.label,
        objectName: objectName.trim(),
        colorLabel:
          customColor.trim() ||
          presetsConfig.colors.find((c) => c.id === selectedColorId)?.label ||
          "",
        materialLabel:
          customMaterial.trim() ||
          presetsConfig.materials.find((m) => m.id === selectedMaterialId)?.label ||
          "",
        resolution,
        aspectRatio,
        prompt: filledPrompts.prompt,
        negativePrompt: filledPrompts.negativePrompt,
        images: response.images.map((img) => ({ url: img.url, b64Json: img.b64Json })),
        meta: response.meta,
      });
      onToast(`已生成 ${response.images.length} 张候选`);
    } catch (error) {
      onToast(error instanceof Error ? error.message : "AI 生成失败");
    } finally {
      setLoading(false);
    }
  }

  async function handleCopyPrompt() {
    const text = `[Positive]\n${filledPrompts.prompt}\n\n[Negative]\n${filledPrompts.negativePrompt}`;
    await navigator.clipboard.writeText(text);
    onToast("已复制提示词");
  }

  function handleRemoveAiSession(session: AiGenerationHistorySession) {
    const index = aiSessions.findIndex((item) => item.id === session.id);
    if (index < 0) return;
    pendingDeletedAiSessionRef.current = { session, index };
    removeAiSession(session.id);
    onToast("已删除该组", {
      actionLabel: "撤销",
      onAction: () => {
        const pending = pendingDeletedAiSessionRef.current;
        if (!pending || pending.session.id !== session.id) return;
        restoreAiSession(pending.session, pending.index);
        pendingDeletedAiSessionRef.current = null;
        onToast("已恢复该组");
      },
    });
  }

  const hasAiHistory = aiSessions.length > 0;

  return (
    <div className="ai-generate">
      <section className="surface-raised rounded-[20px] p-5">
        <div className="ai-generate__header">
          <div>
            <div className="ai-generate__eyebrow">AI 3D 图标生成</div>
            <h2 className="ai-generate__title">把一个业务对象变成 2 张可选图标（效果测试中）</h2>
          </div>
          <button
            className="btn-subtle inline-flex h-8 items-center gap-1.5 rounded-md px-3 text-[12.5px]"
            onClick={() => void handleCopyPrompt()}
            type="button"
          >
            <Icon icon="lucide:copy" width="14" />
            复制提示词
          </button>
        </div>

        <div className="mt-4 grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="space-y-4">
            <label className="ai-field">
              <span className="ai-field__label">生成物体</span>
              <input
                className="field-input text-[15px]"
                value={objectName}
                onChange={(event) => setObjectName(event.target.value)}
                placeholder="如：数据看板、告警铃、云服务器"
              />
            </label>

            <div>
              <div className="ai-field__label mb-2">提示词风格</div>
              <div className="flex flex-wrap gap-2">
                {stylesCatalog.styles.map((variant) => (
                  <button
                    key={variant.id}
                    type="button"
                    className={`chip${variant.id === activeVariant?.id ? " is-active" : ""}`}
                    title={variant.description ?? variant.label}
                    onClick={() => setSelectedStyleId(variant.id)}
                  >
                    {variant.label}
                  </button>
                ))}
              </div>
              {activeVariant?.description ? (
                <p className="mt-2 text-[12px] leading-relaxed text-[#8a8a8a]">{activeVariant.description}</p>
              ) : null}
            </div>

            <div>
              <div className="ai-field__label mb-2">主色调</div>
              <div className="ai-color-grid">
                {presetsConfig.colors.map((color) => (
                  <button
                    key={color.id}
                    type="button"
                    className={`ai-color-swatch${selectedColorId === color.id ? " is-active" : ""}`}
                    style={{ backgroundColor: color.swatch }}
                    title={`${color.label} · ${color.phrase}`}
                    aria-label={color.label}
                    onClick={() => {
                      setSelectedColorId(color.id);
                      setCustomColor("");
                    }}
                  />
                ))}
              </div>
              <input
                className="field-input mt-3 text-sm"
                value={customColor}
                onChange={(event) => setCustomColor(event.target.value)}
                placeholder="可选：自定义主色描述，会覆盖色板"
              />
            </div>

            <div>
              <div className="ai-field__label mb-2">材质</div>
              <div className="ai-material-grid">
                {presetsConfig.materials.map((material) => (
                  <button
                    key={material.id}
                    type="button"
                    className={`ai-material-card${selectedMaterialId === material.id ? " is-active" : ""}`}
                    title={material.phrase}
                    onClick={() => {
                      setSelectedMaterialId(material.id);
                      setCustomMaterial("");
                    }}
                  >
                    <span>{material.label}</span>
                  </button>
                ))}
              </div>
              <input
                className="field-input mt-3 text-sm"
                value={customMaterial}
                onChange={(event) => setCustomMaterial(event.target.value)}
                placeholder="可选：自定义材质描述，会覆盖材质卡"
              />
            </div>
          </div>

          <aside className="ai-generate__summary">
            <div className="ai-summary-card">
              <div className="ai-field__label">输出</div>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <select
                  className="ai-select"
                  value={resolution}
                  onChange={(event) => setResolution(event.target.value as AiImageResolution)}
                >
                  {RESOLUTION_OPTIONS.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>
                <select
                  className="ai-select"
                  value={aspectRatio}
                  onChange={(event) => setAspectRatio(event.target.value as AiImageAspectRatio)}
                >
                  {RATIO_OPTIONS.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>
              </div>
              <div className="ai-summary-line">
                <span>数量</span>
                <strong>2 张</strong>
              </div>
              <div className="ai-summary-line">
                <span>预设色 / 材质</span>
                <strong>{selectedColor?.label} / {selectedMaterial?.label}</strong>
              </div>
              <div className="ai-summary-line">
                <span>提示词模板</span>
                <strong>{activeVariant?.label ?? "—"}</strong>
              </div>
            </div>

            <button
              className="btn-primary mt-4 inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg px-5 text-[13.5px]"
              onClick={() => void handleGenerate()}
              disabled={loading}
              type="button"
            >
              <Icon icon={loading ? "lucide:loader-circle" : "lucide:sparkles"} width="16" />
              {loading ? "生成中..." : "生成 2 张"}
            </button>
          </aside>
        </div>

        <div className="ai-prompt-preview">
          <button
            aria-expanded={promptPreviewOpen}
            className="ai-prompt-preview__toggle"
            onClick={() => setPromptPreviewOpen((open) => !open)}
            type="button"
          >
            <span>
              <span className="ai-field__label">提示词预览</span>
              <span className="ai-prompt-preview__hint">生成前可展开检查最终 Positive / Negative</span>
            </span>
            <Icon icon={promptPreviewOpen ? "lucide:chevron-up" : "lucide:chevron-down"} width="16" />
          </button>

          {promptPreviewOpen ? (
            <div className="ai-prompt-preview__body">
              <div>
                <div className="ai-prompt-preview__label">Positive</div>
                <pre>{filledPrompts.prompt}</pre>
              </div>
              <div>
                <div className="ai-prompt-preview__label">Negative</div>
                <pre>{filledPrompts.negativePrompt}</pre>
              </div>
            </div>
          ) : null}
        </div>
      </section>

      <section className="mt-6">
        {loading ? (
          <div className="match-session match-session--loading">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="mb-1 text-[11px] uppercase tracking-[0.2em] text-[#5a5a5a]">正在生成</div>
                <div className="match-session__query" title={objectName.trim()}>
                  {objectName.trim() || "…"}
                </div>
              </div>
              <div className="inline-flex items-center gap-2 text-sm text-[#8a8a8a]">
                <Icon icon="lucide:loader-circle" width="15" />
                正在请求模型
              </div>
            </div>
            <div className="ai-result-grid">
              <div className="ai-result-card skeleton" />
              <div className="ai-result-card skeleton" />
            </div>
          </div>
        ) : null}

        {hasAiHistory ? (
          <div className="match-session-list">
            {aiSessions.map((session) => (
              <AiHistorySection
                key={session.id}
                session={session}
                onDelete={handleRemoveAiSession}
                onToast={onToast}
              />
            ))}
          </div>
        ) : null}

        {!loading && !hasAiHistory ? (
          <div className="ai-empty-state">
            <Icon icon="lucide:sparkles" width="18" />
            <span>选择对象、主色和材质后开始生成；结果会保留在下方历史，最多 10 组。</span>
          </div>
        ) : null}
      </section>
    </div>
  );
}
