# 图标大厨 · AI 图标工作台

> 一次生成，批量匹配。AI 驱动的图标创作与检索工作台。

本仓库是「图标大厨」的主工程（代码仓名仍为 IconCreator，包命名空间仍为 `@iconcraft/*`，仅用于内部标识），当前前端展示版本为 **v1.0**，已收敛为首个可发布版本。项目以 `pnpm workspace` 组织 `frontend`、`backend`、`shared` 三个包，原型文件仍保留用于设计参考。

---

## 仓库结构

```
IconCreator/
├── docs/                # 产品文档（PRD / 设计 / 进度 / 依赖排障）
│   ├── PRD.md
│   ├── DESIGN.md
│   ├── PROGRESS.md
│   └── ICONIFY.md       # Iconify 集成说明与排障
│
├── prototype/           # 纯 HTML 原型（保留用于视觉和交互参考）
│   ├── index.html
│   └── assets/          # 横幅、AI 3D 配置副本、材质占位图等
│       ├── hero-banner.jpg
│       ├── ai-3d-icon-style.json
│       ├── ai-3d-icon-presets.json
│       └── material-placeholder.svg
│
├── frontend/            # React + Vite + TS 前端工作台
│   ├── .env.local       # 本地默认 LLM 配置（不入库）
│   └── src/
│       ├── components/  # 设置 / 结果网格 / 历史分组 / 图标详情 / 数字孪生生成
│       ├── lib/         # API 客户端与下载复制逻辑
│       ├── pages/       # Workbench 主页面
│       ├── prompts/     # 数字孪生提示词生成器默认 Markdown
│       ├── stores/      # Zustand：设置、匹配历史（均支持 persist）
│       └── styles/      # 全局样式
│
├── backend/             # Node.js + Fastify + TS 后端
│   ├── src/
│   │   ├── routes/      # /api/match /api/icons /api/ai /api/prompt-skills
│   │   └── services/    # catalog / LLM / match / AI image / prompt skill / gpt-image
│
├── shared/              # 前后端共享类型、常量与配置
│   ├── config/
│   │   ├── prompt-presets.json
│   │   ├── ai-3d-icon-style.json    # 单机风格模板（可读作首套参考；正式前端用 styles 表）
│   │   ├── ai-3d-icon-styles.json   # AI 3D：多套提示词风格（id/label/description + prompt/negative/vars）
│   │   ├── ai-3d-icon-presets.json # 主色板 + 材质预置：phrase 注入 prompt（中文可理解）；swatch/UI；thumb 可换材质图
│   │   └── icon-catalog/<library>/<style>/
│   │       ├── aliases.json   # 精选中英别名词典（LLM prompt 候选源）
│   │       └── names.json     # Iconify 全量图标名（直连命中 + 合法性校验）
│   └── src/
│
├── scripts/             # 一次性脚本（含 catalog 名字生成）
├── .github/workflows/   # CI / CD
└── README.md
```

## 当前已实现

- `frontend`：SVG 匹配工作台、**AI 3D 生成模式**（多套「提示词风格」Chip 切换，持久化于 `localStorage`；生成历史条目标记所用风格名）、**数字孪生模式**（多轮需求补充 / 摘要确认 / 提示词编辑 / 图片生成 / 全屏预览，默认规则位于 `frontend/src/prompts/digital-twin-skill.md`）、品牌 Banner、**匹配历史（最新在前，最多 10 组，Zustand + `localStorage` 持久化）**、按组摘要与 **按组 SVG ZIP 导出**、结果卡片网格、图标详情弹窗、设置弹窗；**工作台「全局样式修改」**行可调导出/预览 **边长**（**16 / 20 / 24 / 32 / 40 / 48 / 64** px 七档，默认 24）与 **单色**（`localStorage` 持久化，与复制、下载、ZIP 及结果区预览一致）。全局 **`scrollbar-gutter: stable`**（及旧浏览器回退）减轻模式切换时滚动条显隐带来的布局左右抖动。
- `backend`：`/api/match` 匹配接口、`/api/ai/generate` AI 生图代理、`/api/prompt-skills/test` 与 `/api/prompt-skills/turn` 数字孪生需求补充接口、`/api/prompt-skills/image-config` 图片模型配置自检、`/api/prompt-skills/generate-image` 数字孪生图片生成、`/api/icons/:library/:style/:name.svg` SVG 代理接口、图标名合法性校验、进程内缓存。
- `shared`：匹配与 AI 生成类型、数字孪生提示词 / 图片生成类型、图标库与风格配置、AI 3D prompt / preset 配置、提示词预设，以及 `aliases.json + names.json` 双层本地 catalog。
- 匹配链路：`本地词典精确匹配 -> LLM 语义匹配 -> LLM 关键词扩展 + 全量名字字面命中 -> 本地兜底匹配`。
- 多图标库切换：当前支持 `Lucide`、`Heroicons`、`Phosphor`、`Tabler` 的已接入风格组合。
- LLM 配置：支持前端本地持久化 `baseURL`、`apiKey`、`model`、`systemPrompt`；也支持后端 `LLM_*` 环境变量兜底与 BYOK 共存。
- 发布版本：工作台顶部展示 **v1.0**；npm workspace 包版本仍为内部语义版本 `0.1.0`，两者解耦。
- **UI 与层级**：全屏弹窗（`.dialog-backdrop` / `.dialog-panel`）使用较高 `z-index`，保证盖过输入区 `border-beam` 等装饰层；详情弹窗内 SVG 源码区为预格式化换行，避免横向撑出滚动条（见 `docs/DESIGN.md` 附录）。

## 模块边界约定

`AI 生成`、`SVG 匹配`、`数字孪生` 是三个独立功能模块。它们可以复用同一套 OpenAI-compatible API、LLM 配置入口或后端基础客户端，但业务流程、前端状态、错误恢复和默认参数必须彼此隔离。

- 开发 `数字孪生` 时，默认只改 `prompt-skills`、`gpt-image`、`digital-twin-skill.md` 与对应前端组件；不得顺手改动 SVG 匹配链路。
- 开发 `SVG 匹配` 时，保持既有链路 `本地词典 -> LLM 语义匹配 -> LLM 关键词扩展 -> 本地兜底` 的行为稳定，除非任务明确要求调整。
- 开发 `AI 生成` 时，Seedream 图标生成配置与数字孪生后续生图配置分开维护，不把图片模型选项混进 SVG 或数字孪生以外的界面。
- 如果必须修改共享文件（例如 `backend/src/services/llm-client.ts`、`frontend/src/lib/api.ts`、`shared/src/types.ts`），需要先确认影响范围，并至少回归对应模块的核心请求路径。

## 技术栈（当前实现）

| 层 | 选型 |
| --- | --- |
| 前端框架 | React 19 + TypeScript + Vite |
| UI | Tailwind CSS 4 + 自定义组件样式 |
| 状态 | Zustand |
| 图标渲染 | `@iconify/react` |
| 服务端 | Node.js + Fastify |
| 校验 | Zod |
| 缓存 | 进程内 `Map` 缓存（MVP） |
| AI 图像 | 火山方舟 Seedream 4.5；数字孪生模式接入 API易 `gpt-image-2-all` |
| AI 匹配 | OpenAI 兼容协议 |
| 图标源 | Iconify API + 本地 JSON 索引 |

Iconify 在本仓库中的用途、请求链路与常见问题排查，见 [`docs/ICONIFY.md`](./docs/ICONIFY.md)。

## 本地开发

首次安装依赖：

```bash
corepack pnpm install
```

启动前后端联调：

```bash
corepack pnpm dev
```

常用检查命令：

```bash
corepack pnpm check
corepack pnpm build
```

刷新各图标库的全量名字（`names.json`，来源 Iconify 官方 collection 接口）：

```bash
corepack pnpm catalog:names
```

默认情况下：

- 前端 Vite 开发服务器运行在 `5173`
- 后端 Fastify 开发服务器运行在 `8787`
- 前端通过 Vite proxy 转发 `/api`

**线上若返回 `Route POST:/api/ai/generate not found`（Fastify 404）**：说明浏览器请求已到达 **Node 上的 Fastify**，但当前进程里没有注册该路由。请确认：(1) 已用**含** `backend/src/routes/ai.ts` 的代码构建并发布；(2) 启动入口为 **`node backend/dist/index.js`**（或平台将 `start` 设为 `pnpm --filter @iconcraft/backend start`），而不是只起了旧脚本或仅部署了静态前端；(3) CI/镜像中先执行 `pnpm --filter @iconcraft/shared build && pnpm --filter @iconcraft/backend build`。自检：GET `https://你的API域/api/health` 应返回含 `features.aiGenerate: true` 的 JSON。

**数字孪生模式上线自检**：

- `GET /api/health` 应返回 `features.promptSkillTest`、`features.promptSkillImageConfig`、`features.promptSkillImageGenerate`。
- `GET /api/prompt-skills/image-config` 应返回 `configured: true`，并包含当前图片模型名。
- 若生产前端通过 `vercel.json` rewrite 到独立 API 域，需要先确认该 API 域已经部署最新后端；否则前端会出现 404 或「图片生成服务状态获取失败」。

## LLM 密钥与部署（开发 / 生产切分）

本项目支持「同一份代码、不同环境不同读法」，避免线上把密钥打进前端包。

**开发期**：图省事可在 `frontend/.env.local` 设 `VITE_DEFAULT_LLM_API_KEY` 等（已 `.gitignore`），工作台打开即带默认值。

- 代码里已用 `import.meta.env.DEV` 守卫：**生产构建时**这段会被 Vite 编译期剔除，
  `VITE_DEFAULT_LLM_API_KEY` 的真实值 **不会出现在线上 JS 里**。

**生产期**：推荐在 **后端环境变量** 配置站长密钥（仅服务端可见）：

- `LLM_BASE_URL` / `LLM_MODEL` / `LLM_API_KEY` / `LLM_SYSTEM_PROMPT`
- AI 生图使用 `AI_IMAGE_BASE_URL` / `AI_IMAGE_MODEL` / `AI_IMAGE_API_KEY`，仅后端读取。
- 数字孪生后续生图使用 `APIYI_IMAGE_BASE_URL` / `APIYI_IMAGE_MODEL` / `APIYI_IMAGE_API_KEY`，仅后端读取；若需要在前端开放图片模型切换，再配置 `APIYI_IMAGE_MODEL_OPTIONS`（逗号分隔，只放供应商确认可用的模型）。
- 当前数字孪生模式默认跑 `APIYI_IMAGE_MODEL=gpt-image-2-all`；接口返回格式固定为 `url`，不向普通用户暴露 `url / b64_json`。
- 前端不带 `apiKey` 时，后端会用这些值兜底；用户填了自己的 key 则以用户为准（BYOK 兼容）。
- 后端启动时会自动读取当前目录 `.env`，并兼容从仓库根目录启动时读取 `backend/.env`。
- 示例文件 `backend/.env.example`、`frontend/.env.example` 会入库，**不要填写真实密钥**；请复制为 `backend/.env` / `frontend/.env.local` 后再填真值。

**发布前检查清单**：

- 生产构建的构建环境 **不要** 注入任何 `VITE_DEFAULT_LLM_*`（尤其 `API_KEY`）。
- 服务端 `LLM_API_KEY` 通过部署平台的 secret / 环境变量下发，避免写入仓库或前端构建。
- 服务端 `AI_IMAGE_API_KEY` 同样只放部署平台 secret 或本地 `backend/.env`，不要写入 `.env.example`。
- 服务端 `APIYI_IMAGE_API_KEY` 同样只放部署平台 secret 或本地 `backend/.env`，不要写入 `.env.example`；上线前可访问 `/api/prompt-skills/image-config` 确认 `configured: true`。若密钥曾在沟通或日志中明文出现，发布前必须重新生成并轮换。
- 发布前建议 `rg VITE_DEFAULT_LLM_API_KEY frontend/dist`（或你平台的产物目录），确认线上包内不含真实 key 字符串。

## 当前支持的图标库

| 图标库 | 当前已接入风格 |
| --- | --- |
| Lucide | 线性 |
| Heroicons | 线性、填充 |
| Phosphor | 常规、双色 |
| Tabler | 线性 |

> 说明：当前 catalog 仍以首批高频语义词映射为主，后续会继续扩充为更完整的图标索引。

## 后续规划

详见 [`docs/PROGRESS.md`](./docs/PROGRESS.md) 与 [`docs/PRD.md`](./docs/PRD.md)。核心方向包括：生产后端发布、图片结果持久化、catalog 扩充、`systemPrompt` 模块化、更多导出格式等。

## 资产授权说明

- `prototype/assets/hero-banner.jpg` 来自 [Lorem Picsum](https://picsum.photos/)（基于 Unsplash，CC0），仅作占位使用，正式版本需替换为正式品牌图。
