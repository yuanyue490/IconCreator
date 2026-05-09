import { useEffect, useMemo, useState } from "react";

import { Icon } from "@iconify/react";
import type {
  PromptSkillChatMessage,
  PromptSkillImageConfigResponse,
  PromptSkillQuestion,
  PromptSkillImageGenerateResponse,
  PromptSkillSessionStatus,
  PromptSkillSlots,
  PromptSkillTurnResponse,
} from "@iconcraft/shared";

import { fetchPromptSkillImageConfig, generatePromptSkillImages, runPromptSkillTurn } from "../lib/api";
import { DEFAULT_DIGITAL_TWIN_SKILL } from "../lib/default-digital-twin-skill";
import { useSettingsStore } from "../stores/settings-store";

interface SkillLabSectionProps {
  onToast: (message: string) => void;
}

const INITIAL_MESSAGE =
  "我想制作一个上海浦东智慧城市数字孪生大屏，采用蓝黑科技风，需要呈现道路交通流、楼宇能耗、告警事件和动态数据流。";

const SLOT_LABELS: Array<{ key: keyof PromptSkillSlots; label: string }> = [
  { key: "sceneType", label: "应用场景" },
  { key: "location", label: "地理范围" },
  { key: "scope", label: "展示范围" },
  { key: "visualStyles", label: "视觉风格" },
  { key: "colorScheme", label: "色彩方案" },
  { key: "specialRequirements", label: "特殊要求" },
  { key: "targetTool", label: "目标工具" },
];

type QuestionAnswerDraft = {
  selected: string[];
  custom: string;
};

function slotText(value: string | string[] | undefined) {
  if (Array.isArray(value)) {
    return value.length ? value.join("、") : "待补充";
  }
  return value?.trim() || "待补充";
}

function statusLabel(status: PromptSkillSessionStatus) {
  if (status === "collecting") return "需求梳理";
  if (status === "confirming") return "等待确认";
  if (status === "ready") return "可生成";
  return "已生成";
}

async function writeClipboardText(text: string) {
  if (navigator.clipboard?.writeText && window.isSecureContext) {
    await navigator.clipboard.writeText(text);
    return;
  }

  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.left = "-9999px";
  textarea.style.top = "0";
  document.body.appendChild(textarea);
  textarea.focus();
  textarea.select();

  try {
    const copied = document.execCommand("copy");
    if (!copied) {
      throw new Error("复制命令未被浏览器接受");
    }
  } finally {
    document.body.removeChild(textarea);
  }
}

export function SkillLabSection({ onToast }: SkillLabSectionProps) {
  const [skillMarkdown, setSkillMarkdown] = useState(DEFAULT_DIGITAL_TWIN_SKILL);
  const [input, setInput] = useState(INITIAL_MESSAGE);
  const [messages, setMessages] = useState<PromptSkillChatMessage[]>([]);
  const [slots, setSlots] = useState<PromptSkillSlots>({});
  const [status, setStatus] = useState<PromptSkillSessionStatus>("collecting");
  const [latest, setLatest] = useState<PromptSkillTurnResponse | null>(null);
  const [sourcePrompt, setSourcePrompt] = useState("");
  const [editablePrompt, setEditablePrompt] = useState("");
  const [questionAnswers, setQuestionAnswers] = useState<Record<string, QuestionAnswerDraft>>({});
  const [imageLoading, setImageLoading] = useState(false);
  const [imageConfigLoading, setImageConfigLoading] = useState(false);
  const [imageConfig, setImageConfig] = useState<PromptSkillImageConfigResponse | null>(null);
  const [imageResult, setImageResult] = useState<PromptSkillImageGenerateResponse | null>(null);
  const [imageError, setImageError] = useState("");
  const [sentPrompt, setSentPrompt] = useState("");
  const [previewImage, setPreviewImage] = useState<{ src: string; alt: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const settings = useSettingsStore();

  const canSubmit = useMemo(
    () => Boolean(skillMarkdown.trim() && input.trim()),
    [input, skillMarkdown],
  );

  useEffect(() => {
    if (!previewImage) return;

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setPreviewImage(null);
      }
    }

    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [previewImage]);

  useEffect(() => {
    let ignore = false;

    async function loadImageConfig() {
      setImageConfigLoading(true);
      try {
        const config = await fetchPromptSkillImageConfig();
        if (ignore) return;
        setImageConfig(config);
        if (!config.configured) {
          setImageError("图片生成服务暂未就绪，请联系管理员处理。");
        } else {
          setImageError("");
        }
      } catch (error) {
        if (ignore) return;
        setImageError(error instanceof Error ? error.message : "图片生成服务状态获取失败");
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
  }, []);

  async function submitTurn(message: string) {
    const content = message.trim();
    if (!content) return;
    if (!skillMarkdown.trim()) {
      onToast("需求生成服务暂未就绪，请稍后重试");
      return;
    }

    const nextMessages: PromptSkillChatMessage[] = [...messages, { role: "user", content }];
    setMessages(nextMessages);
    setInput("");
    setLoading(true);

    try {
      const response = await runPromptSkillTurn({
        skillMarkdown,
        userMessage: content,
        session: {
          status,
          slots,
          messages,
        },
        llm: {
          baseURL: settings.baseURL,
          apiKey: settings.apiKey,
          model: settings.model,
          systemPrompt: settings.systemPrompt,
        },
      });

      setLatest(response);
      setImageResult(null);
      setSentPrompt("");
      setQuestionAnswers({});
      setStatus(response.status);
      setSlots(response.slots);
      if (response.prompt) {
        setSourcePrompt(response.prompt);
        setEditablePrompt(response.prompt);
      }
      setMessages([...nextMessages, { role: "assistant", content: response.assistantMessage }]);
      onToast(response.status === "generated" ? "提示词已生成" : "需求信息已更新");
    } catch (error) {
      setMessages(messages);
      onToast(error instanceof Error ? error.message : "需求处理失败，请稍后重试");
    } finally {
      setLoading(false);
    }
  }

  function resetSession() {
    setMessages([]);
    setSlots({});
    setStatus("collecting");
    setLatest(null);
    setSourcePrompt("");
    setEditablePrompt("");
    setImageResult(null);
    setSentPrompt("");
    setQuestionAnswers({});
    setInput(INITIAL_MESSAGE);
  }

  function questionKey(question: PromptSkillQuestion, index: number) {
    return `${question.field}:${index}:${question.question}`;
  }

  function isCustomOption(option: string) {
    return option.includes("自定义") || option.includes("其他");
  }

  function questionOptions(question: PromptSkillQuestion) {
    const options = question.options ?? [];
    if (question.type === "text") {
      return options;
    }
    return options.some(isCustomOption) ? options : [...options, "自定义"];
  }

  function updateQuestionOption(question: PromptSkillQuestion, index: number, option: string) {
    const key = questionKey(question, index);
    setQuestionAnswers((current) => {
      const draft = current[key] ?? { selected: [], custom: "" };
      const selected =
        question.type === "multi"
          ? draft.selected.includes(option)
            ? draft.selected.filter((item) => item !== option)
            : [...draft.selected, option]
          : [option];

      return {
        ...current,
        [key]: {
          ...draft,
          selected,
        },
      };
    });
  }

  function updateQuestionCustom(question: PromptSkillQuestion, index: number, value: string) {
    const key = questionKey(question, index);
    setQuestionAnswers((current) => ({
      ...current,
      [key]: {
        selected: current[key]?.selected ?? [],
        custom: value,
      },
    }));
  }

  function buildFollowUpAnswer() {
    const questions = latest?.followUpQuestions ?? [];
    const lines: string[] = [];

    for (const [index, question] of questions.entries()) {
      const draft = questionAnswers[questionKey(question, index)];
      const selected = draft?.selected.filter((item) => !isCustomOption(item)) ?? [];
      const custom = draft?.custom.trim();
      const answers = custom ? [...selected, custom] : selected;

      if (answers.length > 0) {
        lines.push(`${question.question}\n${answers.join("、")}`);
      }
    }

    return lines.join("\n\n");
  }

  function submitFollowUpAnswers() {
    const answer = buildFollowUpAnswer();
    if (!answer) {
      onToast("请先补充至少一项信息");
      return;
    }
    void submitTurn(answer);
  }

  async function copyPrompt() {
    const prompt = editablePrompt.trim();
    if (!prompt) {
      onToast("当前还没有可复制的提示词");
      return;
    }
    try {
      await writeClipboardText(prompt);
      onToast("已复制提示词");
    } catch (error) {
      onToast(error instanceof Error ? error.message : "复制失败，请手动选择文本复制");
    }
  }

  async function handleGenerateImage() {
    const prompt = editablePrompt.trim();
    if (!prompt) {
      onToast("请先输入提示词");
      return;
    }
    if (imageConfig && !imageConfig.configured) {
      const message = "图片生成服务暂未就绪，请联系管理员处理。";
      setImageError(message);
      onToast(message);
      return;
    }

    setImageLoading(true);
    setImageError("");
    try {
      const response = await generatePromptSkillImages({
        prompt,
        model: settings.digitalTwinImageModel || imageConfig?.model,
        responseFormat: "url",
      });
      setImageResult(response);
      setSentPrompt(prompt);
      onToast(`已生成 ${response.images.length} 张图片`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "图片生成失败";
      setImageError(message);
      onToast(message);
    } finally {
      setImageLoading(false);
    }
  }

  function imageSrc(image: { url: string | null; b64Json: string | null }) {
    if (image.url) return image.url;
    if (!image.b64Json) return "";
    return image.b64Json.startsWith("data:") ? image.b64Json : `data:image/png;base64,${image.b64Json}`;
  }

  return (
    <section className="skill-lab">
      <div className="skill-lab__header">
        <div>
          <div className="ai-generate__eyebrow">Digital Twin Image</div>
          <h2 className="ai-generate__title">数字孪生参考生成器</h2>
          <p className="skill-lab__intro">
            通过多轮对话完成提示词生成与效果图生成。
          </p>
        </div>
        <div className="skill-lab__header-actions">
          <span className="skill-lab__status">{statusLabel(status)}</span>
          <button
            type="button"
            className="btn-ghost inline-flex h-9 items-center gap-2 rounded-lg px-3 text-[13px]"
            onClick={resetSession}
            disabled={loading}
          >
            <Icon icon="lucide:rotate-ccw" width="14" />
            重置会话
          </button>
        </div>
      </div>

      <div className="skill-lab__grid skill-lab__grid--workflow">
        <div className="skill-lab__panel">
          <div className="skill-lab__conversation" aria-label="需求补充对话">
            {messages.length === 0 ? (
              <div className="skill-lab__empty">
                输入一个初始需求，系统会判断是否需要补充信息。
              </div>
            ) : (
              <>
                {messages.map((message, index) => (
                  <div
                    className={`skill-lab__message skill-lab__message--${message.role}`}
                    key={`${message.role}-${index}`}
                  >
                    <div className="skill-lab__message-role">
                      {message.role === "user" ? "需求输入" : "系统反馈"}
                    </div>
                    <div className="skill-lab__message-content">{message.content}</div>
                  </div>
                ))}

                {latest?.followUpQuestions.length ? (
                  <div className="skill-lab__question-card">
                    <div className="skill-lab__question-card-title">请补充以下信息</div>
                    <div className="skill-lab__questions">
                      {latest.followUpQuestions.map((question, index) => {
                        const key = questionKey(question, index);
                        const draft = questionAnswers[key] ?? { selected: [], custom: "" };
                        const options = questionOptions(question);
                        const showCustom =
                          question.type === "text" || draft.selected.some(isCustomOption);

                        return (
                          <div className="skill-lab__question" key={key}>
                            <div>{question.question}</div>
                            {options.length ? (
                              <div className="skill-lab__question-options">
                                {options.map((option) => (
                                  <button
                                    type="button"
                                    className={`chip ${draft.selected.includes(option) ? "is-active" : ""}`}
                                    key={option}
                                    onClick={() => updateQuestionOption(question, index, option)}
                                    disabled={loading}
                                  >
                                    {option}
                                  </button>
                                ))}
                              </div>
                            ) : null}
                            {showCustom ? (
                              <input
                                type="text"
                                className="skill-lab__custom-input"
                                value={draft.custom}
                                onChange={(event) =>
                                  updateQuestionCustom(question, index, event.target.value)
                                }
                                placeholder="请输入自定义内容"
                                disabled={loading}
                              />
                            ) : null}
                          </div>
                        );
                      })}
                    </div>
                    <button
                      type="button"
                      className="btn-primary inline-flex h-9 items-center justify-center gap-2 rounded-lg px-4 text-[13px]"
                      onClick={submitFollowUpAnswers}
                      disabled={loading}
                    >
                      <Icon icon="lucide:check" width="15" />
                      确认并发送补充信息
                    </button>
                  </div>
                ) : null}

                {status === "confirming" || status === "ready" ? (
                  <div className="skill-lab__question-card">
                    <div className="skill-lab__question-card-title">确认生成</div>
                    <div className="skill-lab__question">
                      如以上需求摘要无误，可直接确认生成最终提示词。
                    </div>
                    <button
                      type="button"
                      className="btn-primary inline-flex h-9 items-center justify-center gap-2 rounded-lg px-4 text-[13px]"
                      onClick={() => void submitTurn("确认生成提示词。")}
                      disabled={loading}
                    >
                      <Icon icon="lucide:check" width="15" />
                      确认生成提示词
                    </button>
                  </div>
                ) : null}
              </>
            )}
          </div>

          <div className="skill-lab__composer">
            <textarea
              className="skill-lab__textarea skill-lab__textarea--message"
              value={input}
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
                  event.preventDefault();
                  void submitTurn(input);
                }
              }}
              placeholder="补充需求，或输入“确认生成”。"
              spellCheck={false}
            />
            <button
              type="button"
              className="btn-primary inline-flex h-10 items-center justify-center gap-2 rounded-lg px-5 text-[13.5px]"
              onClick={() => void submitTurn(input)}
              disabled={loading || !canSubmit}
            >
              <Icon icon={loading ? "lucide:loader-circle" : "lucide:send"} width="15" />
              {loading ? "处理中..." : "发送"}
            </button>
          </div>
        </div>

        <aside className="skill-lab__panel">
          <div className="skill-lab__block">
            <div className="skill-lab__block-title">需求摘要</div>
            <div className="skill-lab__slot-list">
              {SLOT_LABELS.map(({ key, label }) => (
                <div className="skill-lab__slot" key={key}>
                  <span>{label}</span>
                  <strong>{slotText(slots[key])}</strong>
                </div>
              ))}
            </div>
          </div>

          <div className="skill-lab__block">
            <div className="skill-lab__result-head">
              <div>
                <div className="skill-lab__block-title">提示词编辑</div>
                <div className="skill-lab__meta">
                  {sourcePrompt
                    ? editablePrompt.trim() === sourcePrompt.trim()
                      ? "已根据需求生成，可直接修改"
                      : "已手动调整"
                    : "可跳过对话，直接输入提示词生成图片"}
                </div>
              </div>
              <div className="skill-lab__prompt-actions">
                <button
                  type="button"
                  className="btn-ghost inline-flex h-8 items-center gap-1.5 rounded-lg px-3 text-[12.5px]"
                  onClick={() => void copyPrompt()}
                  disabled={!editablePrompt.trim()}
                >
                  <Icon icon="lucide:copy" width="14" />
                  复制
                </button>
                <button
                  type="button"
                  className="btn-ghost inline-flex h-8 items-center gap-1.5 rounded-lg px-3 text-[12.5px]"
                  onClick={() => setEditablePrompt(sourcePrompt)}
                  disabled={!sourcePrompt || editablePrompt.trim() === sourcePrompt.trim()}
                >
                  <Icon icon="lucide:undo-2" width="14" />
                  恢复
                </button>
              </div>
            </div>
            <textarea
              className="skill-lab__prompt-editor"
              value={editablePrompt}
              onChange={(event) => setEditablePrompt(event.target.value)}
              placeholder="可在此粘贴或编写提示词。通过对话生成后，提示词也会自动填入这里。"
              spellCheck={false}
            />
          </div>

          <div className="skill-lab__block">
            <div className="skill-lab__block-title">图片生成</div>
            <div className="skill-lab__image-hint">
              可直接输入提示词后生成图片；画幅比例请写在提示词中，例如 16:9、竖版或超宽屏。
            </div>
            {imageError ? <div className="skill-lab__error">{imageError}</div> : null}
            <button
              type="button"
              className="btn-primary mt-3 inline-flex h-10 items-center justify-center gap-2 rounded-lg px-5 text-[13.5px]"
              onClick={() => void handleGenerateImage()}
              disabled={imageLoading || !editablePrompt.trim() || imageConfigLoading}
            >
              <Icon icon={imageLoading ? "lucide:loader-circle" : "lucide:image"} width="15" />
              {imageLoading ? "生成中..." : "生成图片"}
            </button>
            {imageResult ? (
              <div className="skill-lab__image-meta">
                {imageResult.meta.model} · {imageResult.meta.durationMs}ms
              </div>
            ) : null}
            {imageResult?.images.length ? (
              <div className="skill-lab__image-grid">
                {imageResult.images.map((image, index) => {
                  const src = imageSrc(image);
                  const alt = `GPT Image 2 生成结果 ${index + 1}`;

                  return (
                    <article className="skill-lab__image-card" key={image.id}>
                      {src ? (
                        <button
                          type="button"
                          className="skill-lab__image-preview-trigger"
                          onClick={() => setPreviewImage({ src, alt })}
                          aria-label="放大预览图片"
                        >
                          <img
                            src={src}
                            alt={alt}
                            onError={() =>
                              setImageError("图片已生成，但暂时无法加载预览。请稍后重试。")
                            }
                          />
                        </button>
                      ) : (
                        <div>图片数据不可用</div>
                      )}
                    </article>
                  );
                })}
              </div>
            ) : null}
            {sentPrompt ? (
              <details className="skill-lab__sent-prompt">
                <summary>查看本次发送提示词</summary>
                <pre>{sentPrompt}</pre>
              </details>
            ) : null}
          </div>

        </aside>
      </div>
      {previewImage ? (
        <div
          className="skill-lab__preview-overlay"
          role="dialog"
          aria-modal="true"
          aria-label="图片预览"
          onClick={() => setPreviewImage(null)}
        >
          <button
            type="button"
            className="skill-lab__preview-close"
            onClick={() => setPreviewImage(null)}
            aria-label="关闭预览"
          >
            <Icon icon="lucide:x" width="18" />
          </button>
          <div className="skill-lab__preview-stage" onClick={(event) => event.stopPropagation()}>
            <img src={previewImage.src} alt={previewImage.alt} />
          </div>
        </div>
      ) : null}
    </section>
  );
}
