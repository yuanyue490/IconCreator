# 图标大厨 · AI 图标工作台

> 一次生成，批量匹配。AI 驱动的图标创作与检索工作台。

本仓库是「图标大厨」的主工程（代码仓名仍为 IconCreator，包命名空间仍为 `@iconcraft/*`，仅用于内部标识），目前已经进入 **正式开发阶段**。项目以 `pnpm workspace` 组织 `frontend`、`backend`、`shared` 三个包，原型文件仍保留用于设计参考。

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
│       ├── components/  # 设置 / 结果网格 / 历史分组 / 图标详情
│       ├── lib/         # API 客户端与下载复制逻辑
│       ├── pages/       # Workbench 主页面
│       ├── stores/      # Zustand：设置、匹配历史（均支持 persist）
│       └── styles/      # 全局样式
│
├── backend/             # Node.js + Fastify + TS 后端
│   ├── src/
│   │   ├── routes/      # /api/match /api/icons
│   │   └── services/    # catalog / LLM / match orchestration
│
├── shared/              # 前后端共享类型、常量与配置
│   ├── config/
│   │   ├── prompt-presets.json
│   │   ├── ai-3d-icon-style.json   # AI 3D：prompt / negative / vars
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

- `frontend`：SVG 匹配工作台、**AI 3D 生成模式**、品牌 Banner、**匹配历史（最新在前，最多 10 组，Zustand + `localStorage` 持久化）**、按组摘要与 **按组 SVG ZIP 导出**、结果卡片网格（命中来源与汇总区统一为 `match-stat` 风格）、图标详情弹窗、设置弹窗、开发期请求反馈；**工作台「SVG 样式」**行可调导出/预览 **边长**（**16 / 20 / 24 / 32 / 40 / 48 / 64** px 七档，默认 24）与 **单色**（`localStorage` 持久化，与复制、下载、ZIP 及结果区预览一致）。
- `backend`：`/api/match` 匹配接口、`/api/ai/generate` AI 生图代理、`/api/icons/:library/:style/:name.svg` SVG 代理接口、图标名合法性校验、进程内缓存。
- `shared`：匹配与 AI 生成类型、图标库与风格配置、AI 3D prompt / preset 配置、提示词预设，以及 `aliases.json + names.json` 双层本地 catalog。
- 匹配链路：`本地词典精确匹配 -> LLM 语义匹配 -> LLM 关键词扩展 + 全量名字字面命中 -> 本地兜底匹配`。
- 多图标库切换：当前支持 `Lucide`、`Heroicons`、`Phosphor`、`Tabler` 的已接入风格组合。
- LLM 配置：支持前端本地持久化 `baseURL`、`apiKey`、`model`、`systemPrompt`；也支持后端 `LLM_*` 环境变量兜底与 BYOK 共存。
- **UI 与层级**：全屏弹窗（`.dialog-backdrop` / `.dialog-panel`）使用较高 `z-index`，保证盖过输入区 `border-beam` 等装饰层；详情弹窗内 SVG 源码区为预格式化换行，避免横向撑出滚动条（见 `docs/DESIGN.md` 附录）。

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
| AI 图像 | 火山方舟 Seedream 4.5 |
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

## LLM 密钥与部署（开发 / 生产切分）

本项目支持「同一份代码、不同环境不同读法」，避免线上把密钥打进前端包。

**开发期**：图省事可在 `frontend/.env.local` 设 `VITE_DEFAULT_LLM_API_KEY` 等（已 `.gitignore`），工作台打开即带默认值。

- 代码里已用 `import.meta.env.DEV` 守卫：**生产构建时**这段会被 Vite 编译期剔除，
  `VITE_DEFAULT_LLM_API_KEY` 的真实值 **不会出现在线上 JS 里**。

**生产期**：推荐在 **后端环境变量** 配置站长密钥（仅服务端可见）：

- `LLM_BASE_URL` / `LLM_MODEL` / `LLM_API_KEY` / `LLM_SYSTEM_PROMPT`
- AI 生图使用 `AI_IMAGE_BASE_URL` / `AI_IMAGE_MODEL` / `AI_IMAGE_API_KEY`，仅后端读取。
- 前端不带 `apiKey` 时，后端会用这些值兜底；用户填了自己的 key 则以用户为准（BYOK 兼容）。
- 后端启动时会自动读取当前目录 `.env`，并兼容从仓库根目录启动时读取 `backend/.env`。
- 示例文件 `backend/.env.example`、`frontend/.env.example` 会入库，**不要填写真实密钥**；请复制为 `backend/.env` / `frontend/.env.local` 后再填真值。

**发布前检查清单**：

- 生产构建的构建环境 **不要** 注入任何 `VITE_DEFAULT_LLM_*`（尤其 `API_KEY`）。
- 服务端 `LLM_API_KEY` 通过部署平台的 secret / 环境变量下发，避免写入仓库或前端构建。
- 服务端 `AI_IMAGE_API_KEY` 同样只放部署平台 secret 或本地 `backend/.env`，不要写入 `.env.example`。
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

详见 [`docs/PROGRESS.md`](./docs/PROGRESS.md) 与 [`docs/PRD.md`](./docs/PRD.md)。核心方向包括：AI 生成接入、导出尺寸、catalog 扩充、`systemPrompt` 模块化、正式版前收敛调试能力、更多导出格式等。

## 资产授权说明

- `prototype/assets/hero-banner.jpg` 来自 [Lorem Picsum](https://picsum.photos/)（基于 Unsplash，CC0），仅作占位使用，正式版本需替换为正式品牌图。
