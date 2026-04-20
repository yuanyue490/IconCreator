# IconCraft · AI 图标工作台

> 一次生成，批量匹配。AI 驱动的图标创作与检索工作台。

本仓库是 IconCraft 的主工程，目前已经进入 **正式开发阶段**。项目以 `pnpm workspace` 组织 `frontend`、`backend`、`shared` 三个包，原型文件仍保留用于设计参考。

---

## 仓库结构

```
IconCreator/
├── docs/                # 产品文档（PRD / 设计 / 进度）
│   ├── PRD.md
│   ├── DESIGN.md
│   └── PROGRESS.md
│
├── prototype/           # 纯 HTML 原型（保留用于视觉和交互参考）
│   ├── index.html
│   └── assets/          # 原型里用到的图片等静态资源
│       └── hero-banner.jpg
│
├── frontend/            # React + Vite + TS 前端工作台
│   ├── .env.local       # 本地默认 LLM 配置（不入库）
│   └── src/
│       ├── components/  # 设置弹窗 / 结果网格 / 图标详情
│       ├── lib/         # API 客户端与下载复制逻辑
│       ├── pages/       # Workbench 主页面
│       ├── stores/      # Zustand 设置持久化
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
│   │   └── icon-catalog/
│   └── src/
│
├── scripts/             # 一次性脚本（后续用于 catalog 生成等）
├── .github/workflows/   # CI / CD
└── README.md
```

## 当前已实现

- `frontend`：SVG 匹配工作台、结果卡片网格、图标详情弹窗、配置弹窗、开发期请求调试面板。
- `backend`：`/api/match` 匹配接口、`/api/icons/:library/:style/:name.svg` SVG 代理接口、内存缓存。
- `shared`：匹配类型、图标库与风格配置、提示词预设、各图标库本地 catalog。
- 匹配链路：`本地词典精确匹配 -> LLM 语义匹配 -> 本地兜底匹配`。
- 多图标库切换：当前支持 `Lucide`、`Heroicons`、`Phosphor`、`Tabler` 的已接入风格组合。
- LLM 配置：支持在前端设置 `baseURL`、`apiKey`、`model`、`systemPrompt`，并持久化到本地。

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
| AI 图像 | SeeDream API |
| AI 匹配 | OpenAI 兼容协议 |
| 图标源 | Iconify API + 本地 JSON 索引 |

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

默认情况下：

- 前端 Vite 开发服务器运行在 `5173`
- 后端 Fastify 开发服务器运行在 `8787`
- 前端通过 Vite proxy 转发 `/api`

## 当前支持的图标库

| 图标库 | 当前已接入风格 |
| --- | --- |
| Lucide | 线性 |
| Heroicons | 线性、填充 |
| Phosphor | 常规、双色 |
| Tabler | 线性 |

> 说明：当前 catalog 仍以首批高频语义词映射为主，后续会继续扩充为更完整的图标索引。

## 下一步

- 扩充多图标库 catalog，减少未命中与误命中。
- 把 `systemPrompt` 继续拆成可组合策略块，降低手工修改成本。
- 区分开发期与正式版调试能力，发布前移除请求调试面板。
- 补强批量导出格式，目前仍以 MVP 下载链路为主。

详见 [`docs/PROGRESS.md`](./docs/PROGRESS.md) 与 [`docs/PRD.md`](./docs/PRD.md)。

## 资产授权说明

- `prototype/assets/hero-banner.jpg` 来自 [Lorem Picsum](https://picsum.photos/)（基于 Unsplash，CC0），仅作占位使用，正式版本需替换为正式品牌图。
