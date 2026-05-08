# 图标大厨（IconCraft）项目进度记录

> **日期**：2026-05-07
> **阶段**：首版上线前收敛 · 数字孪生生成闭环 · 生产配置核查
> **文档版本**：PRD v3.2 · Workspace MVP+ · Digital Twin Workflow

---

## 最新更新（2026-05-07）

- **数字孪生模式收敛为首版上线形态**：工作台第三个模式从测试语义的「Skill协同」收敛为对外的 **「数字孪生」**；界面文案移除 `Prompt Skill Workflow`、`Skill Markdown`、`API Key / 环境变量`、`LLM`、`Beta` 等工程/测试表达，改为「提示词编辑」「智能匹配」「图片生成服务」等用户可理解文案。
- **完整工作流闭环**：数字孪生模式形成 `多轮需求补充 -> 需求摘要 -> 提示词编辑 -> 图片生成 -> 放大预览` 闭环；用户既可以通过多轮对话生成提示词，也可以跳过对话，直接在提示词编辑器中输入内容后生成图片。
- **提示词人工介入**：生成后的提示词不再直接锁死进入生图，而是先进入右侧提示词编辑器；用户可复制、恢复原始生成内容、手动微调，再点击生成图片，便于专业产品设计场景中的人工把关。
- **图片生成接入 API易**：新增 `backend/src/services/gpt-image-service.ts`，按 OpenAI-compatible `/images/generations` 接入 API易 `gpt-image-2-all`；请求固定使用 `response_format: "url"`，不向普通用户暴露 `url / b64_json` 技术选项，也不单独暴露尺寸、数量、质量参数，比例与画幅要求写入提示词。
- **图片模型配置自检**：新增 `GET /api/prompt-skills/image-config`，前端据此读取当前图片模型与可选模型列表；后端环境变量支持 `APIYI_IMAGE_MODEL`、`APIYI_IMAGE_MODEL_OPTIONS`、`APIYI_IMAGE_TIMEOUT_MS`。若只配置一个模型，前端只展示当前模型；若配置多个模型，前端显示下拉切换。
- **图片生成错误提示补全**：后端对图片生成错误做分类处理：服务未配置、鉴权失败、额度不足、429、连接中断、超时、空图返回；前端新增页面内错误卡片，不再只依赖 toast。浏览器拿到图片 URL 但无法加载时，也会提示用户稍后重试。
- **图片结果体验**：生成结果缩略图可点击全屏放大，支持点击背景、右上角关闭按钮和 `Esc` 关闭；生成结果区隐藏「变体与建议」原始 JSON，避免半成品功能干扰首版体验。
- **生产部署核查**：本地 `/api/health` 已包含 `promptSkillImageConfig`、`promptSkillImageGenerate`；本地 `/api/prompt-skills/image-config` 返回 `configured: true`、`providerName: API易`、`model: gpt-image-2-all`。当前生产 API 域 `https://icon-api.zeroyue.com` 仍是旧后端，仅返回 `match / iconsSvg / aiGenerate`，且 `/api/prompt-skills/image-config` 为 404；上线数字孪生模式前必须先发布最新后端。
- **密钥安全**：API Key 曾在开发对话中明文出现，生产发布前需要重新生成并轮换，只放部署平台 secret 或本地 `backend/.env`，不得进入前端构建产物或仓库文件。
- **验证**：本轮变更已通过 `corepack pnpm --filter @iconcraft/shared build`、`corepack pnpm --filter @iconcraft/backend check`、`corepack pnpm --filter @iconcraft/frontend check`、`corepack pnpm build`。

---

## 最新更新（2026-05-06）

- **Skill 协同实验入口**：工作台新增第三个模式 **「Skill协同」**，用于验证「Markdown Skill + MiniMax」的多轮提示词生成工作流；入口与 `AI 生成`、`SVG匹配` 并列，不影响既有 AI 图标生成与 SVG 匹配链路。
- **后端 · Prompt Skill API**：新增 `POST /api/prompt-skills/test` 与 `POST /api/prompt-skills/turn`；服务层 `prompt-skill-service.ts` 复用现有 OpenAI-compatible `/chat/completions` 调用方式，把 Skill Markdown、会话状态、用户输入组装给 MiniMax，并要求模型返回结构化 JSON。
- **多轮会话协议**：共享类型新增 `PromptSkillSlots`、`PromptSkillQuestion`、`PromptSkillTurnRequest`、`PromptSkillTurnResponse` 等；模型每轮返回 `slots`、`missingFields`、`followUpQuestions`、`assistantMessage`、`prompt`、`variants`、`usageTips`，前端据此驱动需求澄清、摘要确认与最终生成。
- **前端 · 多轮体验**：`SkillLabSection` 从单次测试窗升级为对话式工作流：左侧展示需求输入与系统反馈，右侧展示需求摘要、生成结果和变体建议；信息足够后在对话尾部展示 **「确认生成提示词」**，点击即发送确认。
- **追问表单稳定性**：模型返回的 `followUpQuestions` 直接渲染在对话框中；用户可先选择多个选项，选择 **自定义 / 其他** 时出现自定义输入框，最后点击 **「确认并发送补充信息」** 才一次性提交，避免点选项即自动发送造成中断。
- **默认 Skill 文档化**：默认数字孪生 Skill 从前端 TS 字符串迁移到 `frontend/src/prompts/digital-twin-skill.md`，并通过 `?raw` 导入；后续调整默认 Skill 只需维护该 Markdown。文档已补充网站多轮追问语义、生成前需求摘要确认规则，并明确面向 **GPT Image 2** 的提示词场景，不追加 negative prompt。
- **数字孪生 Skill 内容优化**：扩展智慧城市、交通、应急、园区、工业、能源、水利、机房、农业、物流、双碳等场景关键词；弱化不适合项目的纯赛博 / 电影海报倾向，强调 B 端大屏、GIS、业务指标、空间层次与可落地产品视觉。
- **复制体验修复**：`Skill协同` 生成结果旁的复制按钮改为优先 `navigator.clipboard.writeText`，失败时回退到临时 `textarea + execCommand("copy")`，降低浏览器权限或安全上下文导致的复制失败。
- **验证**：本轮变更已通过 `corepack pnpm -r check`、`corepack pnpm -r build`；局部前端修改也通过 `corepack pnpm --filter @iconcraft/frontend check/build`。

---

## 最新更新（2026-04-30）

- **产品与展示版本**：工作台顶栏展示 **v0.5 Beta**（`workbench.tsx`）；npm `package.json` 仍为 workspace 语义版本 `0.1.0`，与 UI 文案解耦。
- **AI 生成 · 多套提示词风格**：新增 `shared/config/ai-3d-icon-styles.json`（`version` + `styles[]`，每套含 `id` / `label` / `description?` / 与单机版一致的 `type`/`vars`/`prompt`/`negative`）。共享类型 `Ai3dIconStyleVariant`、`Ai3dIconStylesCatalog`；`shared` 包导出 `./config/ai-3d-icon-styles.json`。单机 `ai-3d-icon-style.json` 仍可作首套镜像或遗留参考，正式前端以样式表为准。
- **前端**：`stores/ai-prompt-style-store.ts`（`iconcraft-ai-prompt-style`，持久化当前 `selectedStyleId`）；`AiGenerateSection` 内 Chip 切换「提示词风格」，侧栏摘要区分「预设色/材质」与「提示词模板」；预览 / 复制 / 请求共用当前 variant 占位符替换。`ai-generation-history-store` 单条会话记录 `styleId` / `styleLabel`（旧数据无）；`AiHistorySection` 元信息区展示所用风格名称。
- **布局**：全局 `html { scrollbar-gutter: stable }` + 不支持时的 `overflow-y: scroll` 回退（`app.css`），减轻 **AI 生成 ↔ SVG 匹配** 切换时因纵向滚动条出现/消失导致的视口宽度变化与「左右抖动」。
- **文档（对齐本日实现）**：`docs/PROGRESS.md`、`README.md` 仓库说明、`docs/PRD.md` §2.2 / §4.3 / Phase 1 已写明样式表、工作台版本展示与滚动条槽位策略。工作台 `AI 生成` 模式已从禁用切换为可用 UI；新增 `AiGenerateSection`，支持物体输入、B 端/大屏预置主色、材质选择、自定义覆盖、分辨率 / 比例、2 张候选结果、单张下载与复制图片。
- **后端 · AI 生图代理**：新增 `/api/ai/generate` 与 `ai-image-service`，按 OpenAI 兼容 `/images/generations` 形态接入火山方舟 **Seedream 4.5**；请求同时传 `n` 与 `sequential_image_generation_options.max_images`，若接入点仍只回单张则自动补请求到 2 张；API Key 仅从后端环境变量读取，缺失时返回明确提示，不暴露给浏览器。
- **原型 · AI 3D 生成策略**：单次由 **4 张候选** 调整为 **2 张**，与控费及产品默认一致。
- **`ai-3d-icon-presets.json`**：主色与材质话术面向 **大屏可视化 + B 端**（指挥蓝、链路青绿、霓虹 HUD 点缀、状态绿/告警琥珀等；拉丝钢、喷砂钛灰、碳纤维、钢琴黑、深色亚克力面板等），替换偏消费/C 端审美的条目。**说明**：预置文案为写入 `prompt` 的中文 **`phrase`**，与风格模板占位符拼装后一并送模型；`swatch` 仅界面示意。详见 `docs/PRD.md` §2.2「预置 phrase 与文生图模型」。
- **原型 · AI 3D 参数**：主色改为 **预置色板（`phrase` + `swatch`）+ 自定义词组覆盖**；材质改为 **预置卡片（`phrase` + `thumb`）+ 自定义词组覆盖**；各材质项暂共用 `prototype/assets/material-placeholder.svg`，后续只换各条 `thumb` 路径即可挂载真实示意图。
- **配置拆分**：新增 `shared/config/ai-3d-icon-presets.json`，与已有的 `ai-3d-icon-style.json` 配套；共享类型补充 `Ai3dColorPreset` / `Ai3dMaterialPreset` / `Ai3dIconPresetsConfig`（`shared/src/types.ts`）。
- **文档**：已同步修订 `docs/PRD.md`（模块 A：JSON / 预置 / Seedream）；`README.md` 仓库树补充上述配置文件路径。

---

## 最新更新（2026-04-22）

- **匹配历史**：`frontend/src/stores/match-history-store.ts`，`Zustand + persist(localStorage)`，最多保留 **10** 组；每次匹配成功prepend，旧组下沉；按组 **ZIP 导出**、详情预览均带组内 `library/style`。
- **历史区 UI**：`MatchHistorySection` 头部收为 **两行**（查询词 + 时间 + 次按钮「导出」；第二行合并库/风格、命中、耗时、链路文案 `词典+LLM` / `仅词典`、来源统计 `match-stat`、流程 `?`）；去掉冗余「匹配记录」标签与独立摘要块。
- **结果卡片**：`MatchResultGrid` 来源徽标与汇总统一为 **`match-stat`**，词典命中显示「词典」。
- **弹窗**：`IconDetailDialog` / `SettingsDialog` 标题行 `items-start`、关闭钮 `inline-flex` 居中对齐；**`.dialog-svg-code`** 预格式换行，**弹层 z-index**（`5000+`）高于输入区 `BorderBeam`；**Toast** 仍高于弹层。
- **文档**：`docs/ICONIFY.md` 排障用「主域 + 具体 `.svg` 路径」两步探活，避免误用集合级 URL 产生假 404。
- **杂项**：Banner 标题 `hero-caption-title` 字重 500（`app.css`）。

- **SVG 导出外观（工作台）**：
  - **设置弹窗**（`SettingsDialog`）内不再放「边长 / 单色」等导出项，仅保留 LLM（Base URL、Key、Model、System Prompt）相关配置；`exportIconSizePx`、`exportIconColor` 仍由 **`useSettingsStore`（persist）** 存取，与预览、复制、下载、ZIP 的导出逻辑一致（见 `getSvgExportOptions` / `applySvgExportOptions`）。
  - **工作台**（`workbench.tsx`）：`BorderBeam` **仅**包裹主输入与匹配区卡片（`section.surface-raised`）；**「SVG 样式」**为 **独立一行**，放在 `</BorderBeam>` 之后、与主卡片**同级**，避免与卡片同包在一个 `flex` 容器里。
  - **控件布局**：单条 `div.workbench-export-tuning` 内横向排布（标题「SVG 样式」+ 边长下拉里预设 px + 取色 + hex 输入），**不展示**副文案「影响预览、复制、下载与 ZIP」；样式在 `app.css`（`workbench-export-tuning` 系列，视觉层级比主卡片弱一级）。
  - **边长预设**（`export-appearance.ts` · `EXPORT_SIZE_PRESETS`）：**16、20、24、32、40、48、64** px 共七档，默认 **24**；`isPresetSize` 判定，持久化值不在预设内时回退 **24px**（与下拉里 `|| 24` 一致）。

---

## 一、2026-04-21 开发进展

### 1.1 匹配链路增强（已完成 ✅）

- 在原有 `本地词典精确匹配 -> LLM 语义匹配 -> 本地兜底` 基础上，新增
  `LLM 关键词扩展 -> 全量图标名字面命中` 中间层
- 共享 catalog 从“仅精选 aliases”升级为“`aliases.json` + `names.json` 双层结构”
- 后端会先用 `aliases.json` 保证高质量命中，再用 `names.json` 做图标合法性校验与补充直连
- 典型收益：像“火”这类精选词典没覆盖、但库里存在合法图标名的词，可以通过 `flame`、`fire` 这类关键词桥接出来

### 1.2 SVG 导出能力补齐（已完成 ✅）

- 前端已支持将当前匹配结果按图标逐个拉取 SVG 后打成 ZIP 下载
- 导出流程会自动去重图标名，并对文件名做安全清洗，避免非法文件名或撞名
- 单个图标拉取失败不会中断整组导出，UI 可区分“全部成功 / 部分失败 / 全部失败”

### 1.3 配置与安全边界收敛（已完成 ✅）

- 补充 `backend/.env.example` 与 `frontend/.env.example`
- 明确开发态与生产态的 LLM 配置边界：
  - 开发态可通过 `frontend/.env.local` 预置默认值
  - 生产态推荐在后端使用 `LLM_*` 环境变量兜底
  - 用户在前端填写自己的 key 时仍保持 BYOK 优先
- 设置持久化增加迁移逻辑，旧配置异常时会自动回退到新的默认配置

### 1.4 工作台体验打磨（已完成 ✅）

- 工作台首屏补齐品牌 Banner、模式分段控件、匹配说明与来源统计
- 结果区支持卡片详情预览、单张复制/下载、整组导出、请求反馈文案
- 微调按钮与标题区样式，修正模式切换按钮 icon 与文字的视觉对齐问题

### 1.5 文档同步（已完成 ✅）

- 更新 `README.md`，同步当前能力、匹配链路与环境变量约定
- 更新 `docs/PRD.md` 中“当前开发版实现说明”，使其与当前工程一致
- 更新 `docs/ICONIFY.md`，修正过时描述并补充双层 catalog 的实际角色

### 1.6 前端埋点接入（已完成 ✅）

- 按 Microsoft Clarity 官方方式，将跟踪脚本直接植入 `frontend/index.html` 的 `<head>` 区域
- 当前使用站点 ID：`wf5ez8k0rc`，前端发布后即可随页面加载自动上报会话数据
- 保持最小改动策略，本次不引入额外运行时依赖与环境变量配置

---

## 二、2026-04-20 开发进展

### 1.1 工程骨架落地（已完成 ✅）

- 初始化 `pnpm workspace`，统一管理 `frontend`、`backend`、`shared`
- 建立根脚本：`dev`、`check`、`build`
- 前后端共享类型、常量、catalog 与 prompt 配置拆到 `shared`
- 完成 TypeScript 构建链，支持按包独立检查与整仓构建

### 1.2 SVG 匹配 MVP 落地（已完成 ✅）

**前端**：

- 搭建 React + Vite 工作台页面，迁移 SVG 匹配核心流程
- 结果区改为卡片平铺网格，支持命中来源标签展示
- 实现图标详情弹窗，支持真实 SVG 预览、单张复制、单张下载
- 设置弹窗支持配置 `baseURL`、`apiKey`、`model`、`systemPrompt`
- 开发期请求调试面板默认折叠，便于排查模型请求问题

**后端**：

- 实现 `POST /api/match`
- 实现 `GET /api/icons/:library/:style/:name.svg`
- 建立匹配链路：`本地词典精确匹配 -> LLM 语义匹配 -> 本地兜底 -> 未匹配`
- 为 LLM 请求补充结构化调试信息：请求地址、模型、状态码、错误与上游响应正文

### 1.3 多图标库切换（已完成 ✅）

当前已经接通以下 `{库, 风格}` 组合：

- `Lucide · 线性`
- `Heroicons · 线性 / 填充`
- `Phosphor · 常规 / 双色`
- `Tabler · 线性`

说明：

- 共享层已具备图标库与风格映射能力
- 前端可以直接切换图标库与风格
- 后端会按当前 `{库, 风格}` 使用对应 catalog 做匹配，并按对应 Iconify collection 拉取 SVG

### 1.4 匹配质量与可调参数（已完成 ✅）

- 本地词典与本地兜底职责已拆分，减少误命中
- LLM 仅处理本地词典未命中的词，降低成本和幻觉风险
- `systemPrompt` 已开放到设置面板，可按模型服务实际表现手动微调
- 当前仍以“高频语义词首批 catalog”作为多库基线，后续继续扩充覆盖率

### 1.5 构建验证（已完成 ✅）

已通过以下检查：

- `corepack pnpm --filter @iconcraft/shared build`
- `corepack pnpm --filter @iconcraft/backend check`
- `corepack pnpm --filter @iconcraft/frontend check`
- `corepack pnpm build`

---

## 三、2026-04-17 原型阶段记录

### 1.1 需求梳理（已完成 ✅）

- 通读 [PRD.md](PRD.md) v2.0 与 [DESIGN.md](DESIGN.md)（Cal.com 单色设计系统）
- 确认 MVP 覆盖范围为 AI 3D 生成 + 开源 2D 图标两大模块
- 明确视觉基调：基于 Cal.com 灰度哲学迁移到**暗色调**

### 1.2 首版原型（已完成 ✅，后被重构替换）

**产物**：单文件 `prototype.html`，Tailwind CDN 驱动，无构建

**包含**：

- 暗色 Design Token（画布 `#0a0a0a`、卡片 `#161616`、主文 `#fafafa`）
- Cal Sans 大标题 + Inter 正文的字体体系
- 多层阴影 + ring-border 的表面处理
- 顶部导航 + Tab 切换器（AI 生成 / 开源图标库）
- AI 3D 生成器模块：Hero + 输入卡片 + 5 风格预设 + **双列**三态（空/加载/结果）
- 开源图标库模块：sticky 搜索栏 + 60 个 Iconify 真实图标渲染
- 图标详情 Modal：SVG / PNG / React / Vue 四格式切换 + 尺寸滑块
- Toast、hover、骨架动画等微交互

### 1.3 产品定位重构讨论（已完成 ✅）

**触发问题**：用户指出产品应更**轻量工具化**，开源图标库的真实价值是"**一组词 → 一组同款图标**"，而非单图搜索。

**达成共识**（通过三个拍板问题）：

| 议题 | 决策 |
|---|---|
| 两个模块定位关系 | 双核心平级，共用一个输入框，切换输出模式 |
| AI 匹配技术方案 | 方案 A：LLM Prompt 直调（最快落地，MVP 首选） |
| 界面改造力度 | 彻底工具化：砍 Hero，第一屏即工作区 |

**匹配策略最终规则**（用户确认）：

- 上限 20 词
- 一词一图，AI 给最佳单一匹配
- 未匹配直接标注，不自动切库、不重试，由用户自行判断

### 1.4 PRD v3.0 重构（已完成 ✅）

重写 [PRD.md](PRD.md) 关键章节：

- **§1 产品概述**：从"双核心图标工具平台"→"AI 图标工作台"
- **§2 模块 B 整体重写**：改为"AI 图标SVG匹配"，突出风格一致性硬约束
- **§2.7 新增**：AI 词语匹配系统（完整链路 + 输入格式 + LLM Prompt 方案 + 成本延迟估算 + 降级策略）
- **§2.8 新增**：图标库风格矩阵（Lucide / Heroicons / Phosphor / Tabler）
- **§2.9 新增**：批量下载五种形式（SVG ZIP / SVG Sprite / PNG ZIP / React / Vue）
- **§2.10 新增**：浏览模式降级为二级功能
- **§3.3.1 新增**：AI 匹配核心伪代码（含缓存、校验、降级）
- **§4 界面设计**：改为工具化单输入框工作台
- **§6 路线图**：MVP 锁定 AI 3D + SVG匹配 + Lucide + Heroicons
- **§9 成功标准**：新增"匹配次数 > 30000"、"平均输入词数 > 4"验证"组"的价值

### 1.5 原型完全重写（已完成 ✅）

基于 PRD v3.0 重写 [prototype.html](prototype.html)：

**删除**：

- 64px Cal Sans Hero 大标题
- 营销副标、状态徽章、"免费使用"CTA
- 顶部 Tab 胶囊切换器
- 所有营销元素

**新增**：

- 48px 细边导航栏（Logo + 辅助入口）
- 居中 920px 工作台卡片（打开即见）
- 模式分段控件（AI 生成 / SVG匹配）共用同一输入框与提交按钮
- SVG匹配列表式输出（图标 / 词 / 图标名 / 操作）
- 未匹配行灰色标注样式
- 下载菜单 6 种格式选择
- 图标库 + 风格二级下拉
- "AI 帮我选"占位按钮
- 示例场景卡片（导航栏 / 电商流程 / 社交互动）
- 浏览模式独立页（`/browse` 概念，通过"浏览全部"入口进入）
- Mock 词典：内置 30+ 中文词 → Lucide 图标映射，演示匹配与未匹配

---

## 四、当前文件资产

```text
f:/VibeCoding/IconCreator/
├── README.md
├── package.json
├── pnpm-workspace.yaml
├── docs/              PRD / DESIGN / PROGRESS / ICONIFY
├── prototype/
├── frontend/src/
│   ├── pages/workbench.tsx
│   ├── components/    设置、AI 生成区、match-history、ai-history、结果网格、图标详情
│   ├── lib/api.ts
│   └── stores/        settings、match-history、ai-generation-history、ai-prompt-style
├── backend/src/
└── shared/
```

---

## 五、当前待办

### 4.1 近期优先项

- [x] 把 AI 生成结果正式接入工作台，补齐生成态结果卡片、预览与基础操作
- [x] 数字孪生模式形成多轮需求补充、提示词编辑、直接提示词生图、图片放大预览的首版闭环
- [x] 数字孪生图片生成接入 API易 `gpt-image-2-all`，并通过后端环境变量读取密钥
- [x] 首版上线前隐藏半成品「变体与建议」JSON，并收敛对外工程/测试文案
- [ ] 发布最新生产后端，确保线上 `/api/health` 含 `promptSkillImageConfig` / `promptSkillImageGenerate`
- [ ] 发布前轮换已在沟通中出现过的图片模型 API Key
- [ ] 评估生成图片 URL 是否会过期；若会过期，补服务端转存与结果持久化
- [ ] 扩充多图标库 catalog，提升 Heroicons / Phosphor / Tabler 的覆盖率
- [ ] 把 `systemPrompt` 拆成可组合策略块，降低手工改整段 prompt 的成本
- [x] 正式版发布前移除/隐藏数字孪生模式中的测试阶段工程文案，仅保留必要错误提示
- [ ] 在已支持 SVG ZIP 的基础上，继续补齐 Sprite / React / Vue / PNG ZIP 导出
- [ ] 为生成 / 导出链路加入尺寸调节能力，明确预设尺寸、滑杆交互与下载尺寸联动

### 4.2 功能增强待办

- [x] AI 生成支持多套 Positive/Negative 模板切换（样式表 JSON + persist + 历史记录风格字段）
- [x] AI 3D 生成功能从原型迁移到正式工程，并与当前工作台双模式切换打通
- [x] 数字孪生模式支持不走多轮对话、直接输入提示词生成图片
- [ ] 浏览模式 `/browse` 的正式页面与单图导出能力
- [x] 历史记录与最近匹配组持久化（`match-history-store`，最多 10 组）
- [x] 数字孪生图片生成错误提示覆盖服务未配置、鉴权失败、额度不足、限流、超时、空图、图片无法加载
- [ ] SVG 匹配与 AI 3D 图标生成补更完整的输入校验反馈与错误恢复交互
- [ ] 为关键词扩展链路增加可观测性与命中质量回看
- [ ] 移动端与窄屏适配

### 4.3 工程与发布待办

- [ ] Redis 或更稳妥的缓存层替换当前进程内缓存
- [ ] 基础日志、错误采样与匹配成功率统计
- [x] 数字孪生图片生成环境变量规范：`APIYI_IMAGE_BASE_URL` / `APIYI_IMAGE_MODEL` / `APIYI_IMAGE_MODEL_OPTIONS` / `APIYI_IMAGE_TIMEOUT_MS` / `APIYI_IMAGE_API_KEY`
- [ ] 生产 API 域发布最新后端，并复核 Vercel rewrite 指向的 API 版本
- [ ] CI 中加入自动 `check` / `build`

### 4.4 待定问题

- [x] **品牌名**：已从 `IconCraft` 改为「图标大厨」（代码仓与包命名空间继续沿用 `IconCraft` / `@iconcraft/*`）
- [ ] **Logo 设计**：当前是简单字标 `[厨]`，需要正式设计
- [ ] **域名选型**
- [x] **Seedream 4.5 API 接入方式**：当前按火山方舟 OpenAI 兼容 `/images/generations` 接入，密钥仅后端读取
- [x] **数字孪生图片模型接入方式**：当前通过 API易 OpenAI 兼容 `/images/generations` 接入 `gpt-image-2-all`，密钥仅后端读取，前端通过 `/api/prompt-skills/image-config` 读取当前模型
- [ ] **AI 匹配的 LLM 选型**：GPT-4o-mini / DeepSeek / Kimi 的具体基准测试
- [ ] **免费额度策略**：匿名用户每日限多少次生成 / 匹配
- [ ] **图标库许可证显示方式**：批量下载包是否自动附带 LICENSE
- [ ] **Phase 2 方案 B 向量检索**：何时切换，Phosphor 6000+ 是否会触发切换
- [ ] **Phase 3 商业化时点**：MVP 数据达到什么阈值启动付费

---

## 六、关键决策记录（ADR）

### ADR-001：产品定位从"双核心平台"改为"AI 图标工作台"

- **日期**：2026-04-17
- **背景**：原 PRD 把 AI 生成和开源图标聚合做成两个独立模块，容易两头都不够强
- **决策**：统一为"一个输入框，两种输出模式"的工作台形态
- **后果**：
  - 优点：心智统一、开箱即用、差异化清晰
  - 缺点：开源图标库的常规搜索场景被降级，可能流失"只想找单图"的用户

### ADR-002：开源图标库的核心价值是"SVG匹配"而非"聚合"

- **日期**：2026-04-17
- **背景**：如果只做聚合 + 搜索，做不过 Iconify 官方
- **决策**：聚焦"一组词 → 一组同库同款图标"，硬约束风格一致性
- **后果**：
  - 优点：真正的差异化，解决设计师高频痛点
  - 缺点：需要投入 AI 匹配能力，增加 LLM 成本与延迟

### ADR-003：AI 匹配 MVP 采用 LLM Prompt 直调（方案 A）

- **日期**：2026-04-17
- **决策**：不做向量检索，直接把图标清单作为 prompt 传给 GPT-4o-mini
- **候选方案**：B（向量检索）/ C（词典）
- **理由**：MVP 追求最快上线，LLM 单次 ¥0.002 成本可控，2s 延迟可接受
- **迁移路径**：Phosphor 6000+ 图标可能超 context 时，切换方案 B

### ADR-004：未匹配项不做自动切库与重试

- **日期**：2026-04-17
- **决策**：AI 判断无合适匹配 → 直接标注"未匹配"，交给用户
- **理由**：保持工具化原则，减少决策复杂度；未匹配本身就是有效信号（说明该库不够细分）
- **后果**：用户需要主动切库重试，但换来了明确的行为边界

### ADR-005：界面彻底工具化

- **日期**：2026-04-17
- **决策**：砍掉 Hero / 营销文案 / 大标题，第一屏即工作区
- **参考**：Linear / Excalidraw / Raycast / v0.dev
- **后果**：
  - 优点：符合"开箱即用"定位，老用户直接上手
  - 缺点：新用户缺少引导，需要靠示例卡片补偿

---

## 七、下次启动时的切入点

当前正式工程已经跑通 SVG 匹配 MVP。重启工作时，建议按以下优先级推进：

1. **接入 AI 生成模块**：先把生成结果卡片、预览、基础下载链路接回当前工作台
2. **补尺寸调节能力**：明确生成图标的尺寸预设、滑杆交互，以及尺寸与下载结果的对应关系
3. **扩 catalog**：优先补 Heroicons / Phosphor / Tabler 高频语义映射，降低未命中率
4. **拆 systemPrompt 配置块**：把策略、未命中策略、格式约束、候选偏好模块化
5. **完善导出链路**：在现有 SVG ZIP 基础上继续补齐 Sprite / 组件代码 / PNG ZIP

---

**最后更新**：2026-05-07
**维护者**：产品 + 开发
