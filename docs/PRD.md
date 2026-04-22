# Icon 生成器 PRD - 产品需求文档

## 一、产品概述

### 1.1 产品定位

**AI 图标工作台** —— 一个轻量级的在线工具，主打"一句话 → 一组可用图标"。

产品只做一件事：**把自然语言输入，翻译成可直接下载使用的图标**。两种输出模式共用同一个输入框：

- **生成模式（AI 3D）**：输入对象名称 → AI 生成 4 张 3D 风格原创图标
- **匹配模式（开源SVG匹配）**：输入一组词 → AI 智能匹配出一组**同库同款**的开源图标

产品形态是**工具而非平台**：第一屏即工作区，无需注册，无需教程，不做营销堆砌。

### 1.2 核心价值

- **🎯 统一工作流**：一个输入框覆盖"从 0 到 1 原创"与"从万里挑一组"两种高频场景
- **🧩 风格一致性保证**：匹配模式下硬约束"同库 + 同风格"，彻底解决图标混搭问题（设计师最痛点）
- **⚡ 开箱即用**：无注册、无账号、无教程，打开即用
- **🤖 AI 降低门槛**：自然语言输入，支持中英文、同义词、隐喻（如"退出" → `log-out`）
- **📦 批量输出**：匹配模式一次性产出完整图标组 + 打包下载

### 1.3 目标用户

- **UI/UX 设计师**（60%）：组件库、导航栏、空状态配图，需要批量产出风格统一的图标
- **前端 / 独立开发者**（40%）：不想在 Iconify 里一个个搜，希望 AI 帮忙把术语映射成可用图标

两类用户共性痛点：**快速、批量、统一**。

---

## 二、功能模块详细设计

### 模块 A：AI 3D 图标生成

#### 2.1 核心流程

```plaintext
用户输入对象名称 → 系统补全提示词 → 调用 SeeDream API → 返回 4 张 3D 风格图
```

#### 2.2 提示词系统

**内置提示词模板**（用户不可见）：

```plaintext
A 3D rendered icon of [OBJECT], isometric view, clean minimalist style,
soft gradient lighting, pastel color scheme, floating on solid background,
studio quality, high detail, 4K resolution
```

**用户交互**：

- **最小输入**：只需填写对象名称，如 `咖啡杯`、`文件夹`、`火箭`
- **风格切换**（5 种预设，一键应用对应 prompt 片段）：
  1. **极简主义**：`clean minimalist, soft lighting, pastel colors`
  2. **玻璃拟态**：`glassmorphism, translucent material, frosted glass effect`
  3. **粘土风格**：`clay render, matte finish, playful cartoon style`
  4. **赛博朋克**：`cyberpunk neon, holographic, futuristic tech`
  5. **金属质感**：`metallic material, chrome finish, reflective surface`
- **高级选项**（折叠，默认收起）：颜色倾向（暖/冷/单色/彩虹）、视角（等轴测/正面/俯视）

#### 2.3 生成参数

**SeeDream API 调用**：

- 模型：SeeDream 默认模型
- 分辨率：1024×1024（标准）/ 2048×2048（高清，付费）
- 一次生成：4 张候选
- CFG Scale：7–9
- 步数：30–50

**生成时间**：

- 标准：20–40 秒
- 高清：60–90 秒

#### 2.4 结果与操作

**展示**：

- 4 宫格，悬停浮层操作
- 显示所用提示词（可复制）

**操作**：

- 单张下载 / 批量下载（PNG，透明或白底）
- 单张复制图片到剪贴板（走 `navigator.clipboard.write` + `ClipboardItem`，方便直接粘贴到 Figma / Notion / 即时通讯）
- 重新生成（保持输入，重抽 4 张）
- 大图预览

#### 2.5 图生图（Phase 2）

上传参考图 + 文本微调风格。本期不做。

---

### 模块 B：AI 图标SVG匹配（核心差异化功能）

#### 2.6 功能定义

**用户场景**：

> "我要给导航栏做一组图标：首页、消息、设置、搜索、用户、退出——要求风格统一。"

**产品回答**：

用户输入 `首页 消息 设置 搜索 用户 退出`，选择 `Lucide · 线性`，AI 在 2 秒内返回 6 个图标，全部来自 Lucide 线性风格，可一键批量下载。

**与传统图标搜索的本质区别**：

| 维度 | 传统搜索（Iconify 等） | 图标大厨 SVG匹配 |
|---|---|---|
| 输入 | 单个关键词 | 多词 / 句子 / 列表 |
| 输出 | 大量候选供用户筛选 | 每个词唯一最佳匹配 |
| 风格 | 用户需手动保证一致 | **系统硬约束同库同款** |
| 语言 | 仅英文精确匹配 | 中英文 + 同义词 + 隐喻 |
| 下载 | 逐个下载 | 一键批量 |

#### 2.7 AI 词语匹配系统

**完整链路**：

```plaintext
原始输入: "首页 消息 设置 搜索 用户 退出"
   ↓ ① 分词 + 清洗
["首页", "消息", "设置", "搜索", "用户", "退出"]
   ↓ ② LLM 语义匹配（含翻译 + 同义词扩展）
   ↓    - 输入：词列表 + 选定图标库的图标名清单
   ↓    - 输出：每个词对应的图标名（JSON）
[
  {"word": "首页", "match": "home"},
  {"word": "消息", "match": "message-circle"},
  {"word": "设置", "match": "settings"},
  {"word": "搜索", "match": "search"},
  {"word": "用户", "match": "user"},
  {"word": "退出", "match": "log-out"}
]
   ↓ ③ 在选定库 + 风格中渲染
输出: 6 张 Lucide 线性图标
```

**支持的输入格式**（全部兼容）：

- 空格分隔：`首页 消息 设置`
- 逗号分隔：`首页, 消息, 设置` / `首页，消息，设置`
- 换行分隔：每行一个词
- 自然语言：`我要做导航栏，需要首页、消息、设置` → AI 自动抽取关键词
- 混合中英：`dashboard 消息 settings` → 全部正常处理

**MVP 技术方案：LLM Prompt 直调**

```javascript
const systemPrompt = `
You are an icon matching assistant. Given a list of words (in any language)
and a catalog of icon names, return the best matching icon name for each word.

Rules:
1. Output strictly in JSON array format
2. If a word has no good match, set "match" to null and add "reason"
3. Prefer semantic match over literal translation (e.g., "退出" → "log-out" not "exit")
4. Support Chinese, English, and common abbreviations
`;

const userPrompt = `
Icon library: ${libraryName} (${styleVariant})
Available icons: ${iconNamesList.join(', ')}

Match these words:
${userWords.map((w, i) => `${i + 1}. ${w}`).join('\n')}
`;
```

**当前开发版实现说明（2026-04-22）**：

- 前端已开放 `baseURL`、`apiKey`、`model`、`systemPrompt` 配置，并持久化到浏览器本地，便于切换兼容 OpenAI 协议的模型服务并手动微调匹配策略。
- 匹配历史：每次成功匹配新增一组结果（`Zustand + localStorage`），**最新在前**，最多保留 **10** 组；历史组可单独「导出」ZIP，避免与单次结果混淆。
- 后端当前匹配链路已落地为：`本地词典精确匹配 -> LLM 语义匹配 -> LLM 关键词扩展 + 全量名字字面命中 -> 本地兜底匹配 -> 未匹配`。
- 共享 catalog 采用 `aliases.json + names.json` 双层结构：前者控制高质量候选与 prompt 体积，后者负责图标名合法性校验与补充直连命中。
- 当 LLM 直接返回图标名失败时，系统会尝试让 LLM 先扩展英文关键词，再用这些关键词去全量图标名里做安全字面命中。
- 开发版保留请求调试信息，用于查看本次是否实际发起 LLM 请求、请求地址、模型名、上游状态码与响应正文；正式版发布前移除该调试面板。

**成本估算**（以 Lucide 1400 个图标为例）：

- 清单 tokens：~4,000
- 输入 words：10 个 ≈ 50 tokens
- 输出 JSON：~200 tokens
- 模型：GPT-4o-mini（¥0.000015/1K input + ¥0.000060/1K output）
- **单次成本**：约 ¥0.002，10000 次 ≈ ¥20

**延迟估算**：

- LLM 调用：~1.5 秒（首 token） + 0.5 秒（完整响应）
- 图标 SVG 获取（CDN 并发）：~200ms
- **端到端**：≈ 2 秒

**降级策略**：

- LLM 超时 / 报错 → 回退到本地同义词词典（方案 C）
- 某个词 AI 判断无合适匹配 → UI 标记"未匹配 · 该库未收录"，**不做自动切库，由用户自行决定**
- 输入词数 > 20 → 截断并在 UI 提示"已取前 20 个词，请分批处理"

#### 2.8 图标库与风格选择

**目标态支持的 `{库, 风格}` 组合**：

| 图标库 | 可选风格 | 图标数量 | 许可证 |
|---|---|---|---|
| **Lucide** | 线性 | ~1,400 | ISC |
| **Heroicons** | 线性 / 填充 | ~300 × 2 | MIT |
| **Phosphor** | 线性 / 填充 / 双色 / 细线 | ~6,000 × 4 | MIT |
| **Tabler** | 线性 / 填充 | ~4,000 × 2 | MIT |

Phase 2 增加：Feather、Material Symbols、Remix Icon。

**当前开发版已接入（2026-04-22）**：

| 图标库 | 已接入风格 | 状态 |
|---|---|---|
| **Lucide** | 线性 | 已接入 |
| **Heroicons** | 线性 / 填充 | 已接入 |
| **Phosphor** | 常规 / 双色 | 已接入 |
| **Tabler** | 线性 | 已接入 |

说明：当前多库切换能力、对应 catalog 与 SVG 拉取链路已经接通，但部分库仍是高频语义词首批 catalog，后续继续扩充覆盖率。

**风格切换交互**：

- 当前开发版已提供 `{图标库, 风格}` 二级下拉与当前组合状态展示
- 用户切换后，可基于新的 `{库, 风格}` 重新发起匹配并渲染结果
- `"AI 帮我选"` 仍保留在后续增强阶段，当前尚未实现自动推荐

**硬约束**：返回的所有图标**必须来自同一 `{库, 风格}`**，避免混搭。

#### 2.9 结果展示与批量操作

**匹配策略（简化原则）**：

- **上限**：单次输入最多 20 个词，超过截断并提示
- **一词一图**：AI 给出它判断的最佳单一匹配，不做多候选呈现
- **匹配失败认定**：若 AI 判断该词在当前库/风格中确实无合适图标（而非 AI 能力问题），直接标注"未匹配"，**不自动切库、不重试**——这说明该库不够细分，由用户自己决定是换库还是放弃该词
- **容错**：对 LLM 返回的图标名做本地存在性校验，不存在则降级为"未匹配"，不做幻觉兜底

**结果区**：

- 目标态：支持列表式或密集卡片式展示，便于同时查看词、图标、图标名与状态
- 未匹配项灰色标注，提示"该库未收录 · 可尝试切换图标库"
- 顶部显示"来源：当前图标库 · 当前风格 · 成功 x/x"

**当前开发版已实现（2026-04-22）**：

- 结果区已采用卡片平铺网格，而非行列表格；**无历史时**仅显示空状态提示，有历史时按组纵向堆叠展示。
- 每张卡片展示：图标预览、原始词、实际图标名、命中来源徽标（与汇总区统一为 `match-stat` 风格：词典 / LLM / 兜底 / 未匹配）。
- 已实现单张 `下载 SVG`、`复制 SVG`、`详情预览`（详情内 SVG 源码预格式换行；弹窗层级高于页面装饰层如 `border-beam`）。
- 已实现整组 SVG ZIP 导出：按图标逐个拉取 SVG 打包，支持失败汇总与文件名去重；**按历史组**导出，不再使用单一「当前结果」全局状态。
- **导出尺寸与颜色**：主输入卡片下方有独立 **「SVG 样式」**条（不放在「配置」里）。边长为下拉预设 **16、20、24、32、40、48、64** px（默认 **24**；非法或非预设的持久化值回退 24），单色为取色 + hex，均写入本地设置并与**网格预览、详情、复制、下载、ZIP** 一致。
- 每组历史头部为**两行**信息带：查询词、时间、弱化导出；第二行含库/风格、命中、耗时、链路摘要（`词典+LLM` / `仅词典`）、来源统计与说明入口。
- 若本次请求实际触达 LLM，组尾可显示语义请求成功/失败类反馈；未发起请求时可以不展示该行。

**批量操作**：

- **一键下载整组**：
  - 当前已实现：SVG ZIP 包
  - 规划中：PNG ZIP 包（可选尺寸：24/32/48/64）
  - 规划中：单 SVG Sprite 文件（含 `<symbol>` 定义，一次引入全部）
  - 规划中：React 组件集合（每个图标一个 `.tsx`，附 `index.ts` barrel export）
  - 规划中：Vue 组件集合（同上）
- **复制整组 SVG 代码**
- **重新匹配**：保留输入，换一个库/风格

#### 2.10 浏览模式（二级功能）

传统的"逐个搜索图标"场景仍然保留，但**降级为次要入口**——主界面不暴露，通过顶部"浏览全部"链接进入独立页面。

- 搜索框 + 图标网格 + 详情弹窗
- 实现与原规划一致（Iconify API + SVG/PNG/React/Vue 导出）
- 本期可直接复用原型代码

---

## 三、技术架构

### 3.1 前端技术栈

- **框架**：React 19 + TypeScript + Vite
- **UI**：Tailwind CSS 4 + 自定义样式组件
- **状态**：Zustand
- **图标渲染**：`@iconify/react`
- **图像处理**：浏览器原生 Blob / Clipboard / 下载 API（后续可扩展 SVG → PNG）
- **打包下载**：JSZip

### 3.2 后端技术栈

- **服务端**：Node.js + Fastify（轻量，低延迟）
- **缓存**：进程内 `Map`（MVP），后续可升级为 Redis
- **数据库**：PostgreSQL（Phase 2 用户系统起用；MVP 阶段无需）
- **AI 图像接口**：SeeDream API
- **AI 匹配接口**：OpenAI 兼容协议（支持 OpenAI / DeepSeek / Kimi / 自部署）
- **图标元数据源**：Iconify API（实时查询 + 本地 JSON 索引）
- **校验**：Zod
- **存储**：对象存储（仅 AI 生成的图标；开源图标走 CDN）

### 3.3 核心技术方案

#### 3.3.1 AI 图标SVG匹配（MVP）

```typescript
// 伪代码：一次完整的匹配请求
async function matchIconGroup(
  words: string[],
  library: 'lucide' | 'heroicons' | 'phosphor' | 'tabler',
  style: string,
): Promise<MatchResult[]> {
  // 1. 缓存命中检查
  const cacheKey = hash({ words, library, style });
  const cached = await redis.get(cacheKey);
  if (cached) return cached;

  // 2. 获取图标清单（本地 JSON 索引，零延迟）
  const iconNames = await loadIconCatalog(library, style);

  // 3. LLM 匹配
  const response = await openaiClient.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: buildUserPrompt(words, iconNames) },
    ],
    response_format: { type: 'json_object' },
    temperature: 0.2, // 低温度保证稳定
  });

  const matches = JSON.parse(response.choices[0].message.content);

  // 4. 校验 + 降级（LLM 幻觉保护）
  for (const m of matches) {
    if (m.match && !iconNames.includes(m.match)) {
      m.match = fuzzyFallback(m.word, iconNames); // 本地模糊匹配兜底
    }
  }

  // 5. 缓存
  await redis.setex(cacheKey, 86400, JSON.stringify(matches));
  return matches;
}
```

#### 3.3.2 SeeDream API 集成

```javascript
const prompt = `A 3D rendered icon of ${userInput}, ${stylePrompt},
  floating on solid background, studio quality, 4K`;

const response = await fetch('https://api.seedream.ai/v1/generate', {
  method: 'POST',
  headers: { 'Authorization': `Bearer ${API_KEY}` },
  body: JSON.stringify({
    prompt, num_images: 4, width: 1024, height: 1024,
    steps: 40, cfg_scale: 8,
  }),
});
```

#### 3.3.3 SVG 转 PNG

```javascript
const canvas = document.createElement('canvas');
const ctx = canvas.getContext('2d');
const img = new Image();
img.src = 'data:image/svg+xml;base64,' + btoa(svgString);
img.onload = () => {
  canvas.width = size;
  canvas.height = size;
  ctx.drawImage(img, 0, 0, size, size);
  canvas.toBlob(blob => downloadBlob(blob, 'icon.png'));
};
```

---

## 四、界面设计

### 4.1 核心原则：工具化，非着陆页

**打开即工作**。第一屏就是工作区，不做 Hero、不做营销 Banner、不做信任徽章。参考 Linear / Excalidraw / ChatGPT 的交互密度。

### 4.2 主界面布局

```plaintext
┌──────────────────────────────────────────────────────────┐
│  [Logo] 图标大厨              [浏览全部] [历史] [登录]   │ ← 48px 细边导航
├──────────────────────────────────────────────────────────┤
│                                                          │
│  ┌────────────────────────────────────────────────────┐ │
│  │ [模式: ◉ AI 生成  ○ SVG匹配]                        │ │
│  │                                                    │ │
│  │ ┌────────────────────────────────────────────────┐│ │
│  │ │ 输入框（多行，自适应高度）                     ││ │
│  │ │ 占位：输入对象名称，或一组词（空格/逗号分隔） ││ │
│  │ └────────────────────────────────────────────────┘│ │
│  │                                                    │ │
│  │ [风格/库 选择] ────────────────────── [生成 ▶ ]   │ │
│  └────────────────────────────────────────────────────┘ │
│                                                          │
│  ┌────────────────────────────────────────────────────┐ │
│  │              输出工作区（按模式切换）              │ │
│  │  - AI 模式：4 宫格结果                            │ │
│  │  - 匹配模式：卡片网格展示                         │ │
│  └────────────────────────────────────────────────────┘ │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

### 4.3 输入区交互

- **模式切换**：顶部两个 radio-style 胶囊；当前开发版默认落在 `SVG匹配`，`AI 生成` 入口先保留为禁用占位
- **输入框**：
  - 自适应高度（单行 → 多行）
  - 当前开发版：`Ctrl/Cmd + Enter` 提交，`Enter` 换行
  - 后续可增强为多词实时解析与词 chip 展示
- **参数区**：
  - AI 模式：5 种风格 chip + 高级选项（折叠），仍处于待迁移状态
  - 匹配模式：`{图标库, 风格}` 二级下拉 + 当前组合 chip；"AI 帮我选"仍为后续规划
- **生成按钮**：统一白底黑字，高优先级 CTA

### 4.4 AI 模式输出区

- 顶部：当前输入 + 风格，耗时统计
- 4 宫格结果，hover 浮层操作：
  - **下载该张**（`lucide:download`）：触发单张 PNG 下载
  - **复制图片到剪贴板**（`lucide:copy`）：把该张图像以 PNG `Blob` 形式写入系统剪贴板，便于直接粘贴到 Figma / Notion / 即时通讯
  - **放大预览**（`lucide:maximize-2`）：打开大图查看 Modal
- 提示词展示行（小字，可展开 / 复制）
- 底部操作条：复制提示词 / 重新生成 / 下载全部

### 4.5 匹配模式输出区

```plaintext
来源：Heroicons · 填充   匹配：5/6   耗时：420ms    [重新匹配] [导出当前组]

[首页] [home]                 [本地词典]
[消息] [chat-bubble-left-right] [LLM 语义]
[设置] [cog-6-tooth]          [本地词典]
[搜索] [magnifying-glass]     [本地词典]
[用户] [user]                 [本地兜底]
[鱼]   [未匹配]               [未匹配]
```

- 当前开发版点击卡片打开详情弹窗，可查看真实 SVG 资源并执行复制、下载。
- 未匹配卡片保留原因说明，但暂未提供"换个库"或"手动指定"的 recover 操作。
- 拖拽排序、替换候选仍属于后续增强项。

### 4.6 浏览模式（二级页面）

- 独立 URL `/browse`
- 布局与现有原型一致：搜索栏 + 图标网格 + 详情 Modal
- 入口：主导航"浏览全部"

### 4.7 空态引导

- AI 模式空态：3–5 个点击可填充的示例词（咖啡杯、火箭、相机...）
- 匹配模式空态：3 个完整示例组（"导航栏"、"电商购物流程"、"社交媒体"），一键填充

---

## 五、性能与指标

### 5.1 性能要求

- **首屏加载**：< 2 秒（允许保留轻量品牌 banner）
- **AI 3D 生成响应**：20–40 秒（标准）
- **AI SVG匹配响应**：< 2.5 秒（LLM + 图标加载）
- **SVG → PNG 转换**：< 1 秒
- **批量打包下载**：< 3 秒（50 个图标）

### 5.2 核心指标

- **AI 生成成功率**：> 95%
- **AI 匹配成功率**（每词有合理 match）：> 90%
- **平均每次会话匹配词数**：> 5（验证"组"的价值）
- **图标库覆盖**：MVP 4 库 × 风格变体 ≈ 20,000 图标
- **7 日留存**：> 30%

---

## 六、产品路线图

### Phase 1：MVP（2 个月）

**输入工作台**：

- 单输入框 + 双模式切换
- 支持多种分隔符和自然语言输入

**AI 3D 生成器**：

- 5 种风格预设
- 4 张候选图
- PNG 下载（1024×1024）
- 尺寸调节能力（预设尺寸 + 滑杆，导出结果与当前尺寸保持一致）

**AI 图标SVG匹配**：

- 接入 Lucide、Heroicons、Phosphor、Tabler 的首批 `{库, 风格}` 组合
- LLM Prompt 直调方案（方案 A）
- `systemPrompt` 可配置，便于针对不同模型服务做微调
- 当前已落地单张复制 / 下载、详情预览、SVG ZIP 整组导出基础能力
- 降级：本地词典精确匹配 + LLM 关键词扩展桥接 + 本地兜底匹配

**浏览模式（降级功能）**：

- `/browse` 独立页，保留搜索 + 单图标下载

**基础**：

- 响应式 Web（desktop 优先）
- 无需登录
- 历史记录（localStorage，最近 20 次）

**验证目标**：

- AI 匹配质量是否达标（用户是否愿意直接使用无需调整）
- 用户对"组"这个概念的接受度
- 生成 vs 匹配两种模式的使用频率分布

### Phase 2：增强（3–4 个月）

**AI 增强**：

- 生成：图生图、参数精调、批量生成、结果尺寸调节与多尺寸导出
- 匹配：方案 B 向量检索、AI 推荐库/风格、手动 refine 候选

**图标库扩展**：

- 扩充 Phosphor、Tabler 的 catalog 覆盖率
- 增加 Feather、Material Symbols
- 组件导出增强（React/Vue barrel + 图标 types 声明）

**用户系统**：

- 登录 / 注册（OAuth）
- 收藏图标组（完整一组，而非单个）
- 项目分组管理

### Phase 3：专业版（6 个月）

- 自定义提示词模板
- 团队协作（共享图标组）
- API 接口（开发者可程序化调用匹配引擎）
- 商业化：
  - 免费：每日 10 次 AI 生成 + 无限匹配
  - Pro：无限生成、高清分辨率、无水印、优先队列
  - Team：共享库、私有部署选项

---

## 七、竞品分析

| 产品 | 类型 | 优势 | 劣势 | 图标大厨 差异化 |
|---|---|---|---|---|
| **Midjourney** | AI 生图 | 图像质量顶级 | 通用工具，非图标专用，无SVG匹配 | 垂直聚焦图标，内置专业 prompt，输出可直接用 |
| **Iconify** | 开源聚合 | 图标数量最多 | 仅单个搜索展示，无批量，无 AI 语义 | **AI SVG匹配 + 风格一致性硬约束** |
| **Icons8** | 素材库 | 风格统一，质量高 | 收费，无 AI 生成，无批量匹配 | AI 生成 + 免费开源，SVG匹配 |
| **Figma AI** | 设计插件 | 集成设计流程 | 需要 Figma 账户，功能局限 | 独立 Web 工具，2 秒出组 |
| **Lucide/Heroicons 官网** | 单库浏览 | 风格自洽 | 仅本库，需自己搜 | 跨库 + AI 跨语言匹配 |

**核心护城河**：

1. **"组"是动词**：没有其他工具把"一组同款图标"作为一等公民输入输出
2. **AI 跨语言语义匹配**：中英文、同义词、隐喻，Iconify 做不到
3. **双模式同一心智**：同一个输入框解决两种需求，降低学习成本

---

## 八、风险与挑战

### 8.1 技术风险

- **LLM 幻觉**：可能返回不存在的图标名
  - **应对**：JSON schema 强约束 + 本地校验 + 模糊匹配兜底
- **LLM 延迟**：影响"开箱即用"体验
  - **应对**：匹配结果缓存（相同输入直接命中 Redis）；可流式返回结果
- **AI 生成不稳定**：SeeDream 输出偶发偏离
  - **应对**：一次 4 张，优化 prompt 模板
- **API 成本**：LLM + SeeDream 双重成本
  - **应对**：免费用户每日配额；匹配结果缓存命中率目标 > 40%

### 8.2 产品风险

- **用户习惯**：用户可能仍倾向"逐个搜"
  - **应对**：空态强引导（示例组）、历史记录展示"组"
- **匹配质量预期**：AI 100% 猜对不现实
  - **应对**：未匹配项友好展示 + 快速 refine 入口
- **开源图标许可证**：部分库有限制
  - **应对**：详情页明示许可证；批量下载包含 LICENSE 文件

### 8.3 市场风险

- **大厂模仿**：Figma、Iconify 可能跟进
  - **应对**：快速迭代SVG匹配算法；建立"组"的使用习惯和历史数据

---

## 九、成功标准

### 9.1 MVP 阶段（上线 3 个月内）

- 独立访客 > 5,000 人
- AI 生成次数 > 10,000 次
- **AI 匹配次数 > 30,000 次**（验证匹配是高频核心）
- 批量下载次数 > 5,000 次
- 用户平均输入词数 > 4（验证"组"概念）
- NPS > 40

### 9.2 产品成熟期（6–12 个月）

- 月活 > 20,000
- AI 匹配成功率 > 92%
- 付费转化 > 3%
- NPS > 60

---

## 十、附录

### 10.1 SeeDream API 文档

- 官方文档：（待补充）
- 定价：（待补充）
- 速率限制：（待补充）

### 10.2 LLM 提供方选型

- **首选**：OpenAI GPT-4o-mini（成本 + 质量最佳）
- **备选**：DeepSeek Chat（国内访问 + 成本更低）
- **抽象层**：统一 OpenAI 兼容协议，运行时可切换

### 10.3 开源图标库资源

- Iconify：<https://iconify.design>
- Lucide：<https://lucide.dev>
- Heroicons：<https://heroicons.com>
- Phosphor：<https://phosphoricons.com>
- Tabler：<https://tabler.io/icons>

### 10.4 参考设计

- 工具化交互：Linear、Excalidraw、Raycast、v0.dev
- AI 输入体验：ChatGPT、Claude、Perplexity
- 3D 图标风格：Dribbble "3D icons"

---

**文档版本**：v3.0（定位重构）
**创建日期**：2026-04-17
**最新修订**：2026-04-22（同步匹配历史与工作台实现）
**负责人**：产品团队
**审核状态**：待评审
