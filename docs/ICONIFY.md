# Iconify 在本项目中的角色与排障

本文记录 **图标大厨（内部代号 IconCraft / 代码仓 IconCreator）** 与 [Iconify](https://iconify.design/) 的集成方式、外部依赖与常见问题，便于后续 **SVG 拉取失败、502、图标不显示** 时对照排查。

---

## Iconify 是什么（与本仓库的关系）

- **Iconify** 是开源图标生态：聚合多套开源图标库（如 Lucide、Heroicons 等），提供统一命名、组件与 **HTTP API** 取图标数据。
- 本项目中 Iconify **不是** LLM 服务；仅用于 **图标渲染** 与 **按名称获取 SVG 矢量**（与 `shared` 里本地 catalog 的「匹配结果」配合）。

官方文档入口：[Iconify API 概览](https://iconify.design/docs/api/)。

---

## 代码里用在哪里

| 用途 | 位置 | 说明 |
| --- | --- | --- |
| React 内联展示小图标 | `frontend` → `@iconify/react`（如 `workbench.tsx`、结果网格、详情弹窗） | 浏览器侧按 `collection:name` 渲染，依赖 Iconify 组件与（按需）公共 API。 |
| 匹配结果的 SVG 文本（下载/复制等） | `backend/src/routes/icons.ts` | 校验 **本地 catalog** 含该图标名后，服务端 `fetch` **公共 Iconify API** 拉取 `.svg`，进程内 `Map` 缓存。 |
| 产品外链 | `frontend/src/pages/workbench.tsx` | Header「Iconify」按钮跳转官网，便于查图标集与文档。 |

**请求路径（当前架构）**：浏览器 → 同源 `/api/icons/...` → **后端** → `https://api.iconify.design/...` → 返回 SVG。  
因此 **浏览器不直连** Iconify 拉 SVG（由后端代理），一般不受浏览器对 `api.iconify.design` 的 CORS 限制；若 SVG 失败，优先查 **后端日志与 502 响应**。

---

## 公共 API 与费用（政策备忘）

- 官方说明：公共 API 服务器 **免费开放使用**；运维有成本，项目方欢迎 [赞助](https://iconify.design/sponsors/) 以支持基础设施与开发。
- **不等于**可无节制滥用：高并发或大规模商用时，应评估 **限流、稳定性、合规**，必要时 **自托管 API**（见 [Hosting Iconify API](https://iconify.design/docs/api/hosting.html)）。
- 各 **图标集** 仍遵循各自开源许可；与「API 是否收费」是两件不同的事。

若将来出现「公共 API 策略变更、限流变严」，现象多为 **间歇性 502/超时**，可对照下文排障，并考虑自托管或改为本地打包 SVG。

---

## 排障清单（按现象）

### 1. 前端 UI 小图标不显示（Lucide 等）

- 检查 **网络** 是否可访问 Iconify 相关域名（组件按需请求时可能访问公共 API）。
- 打开开发者工具 **Network**，看是否有对 Iconify 的请求失败、被广告拦截或企业代理拦截。

### 2. 匹配结果里「SVG 获取失败」或接口 502

- **502** 且文案含 upstream：多为后端请求 `api.iconify.design` **失败**（对端不可用、DNS、防火墙、TLS 拦截）。
  - 在 **运行后端的机器** 上测试：`curl -I "https://api.iconify.design/lucide.svg"`（collection 以 `shared` 中 `styleConfig` 为准）。
- **404**：可能是 **本地 catalog 无该 name**（`icons.ts` 在校验 catalog 后直接 404），与 Iconify 无关；应查匹配逻辑与 catalog 数据。

### 3. 仅内网/离线环境

- 后端必须能访问公网 **才能** 使用当前「远程拉 SVG」实现；完全离线需改为 **本地/自托管图标数据**（架构变更，不在本文实现范围内）。

### 4. 冗余与备用域名（官方说明备忘）

公共 API 主域名为 `https://api.iconify.design`。官方文档还提到备用主机名（主域不可达时的冗余思路），详见 [Iconify API 文档 · Public API / Redundancy](https://iconify.design/docs/api/)。  
**当前仓库实现**仅使用主域名 `api.iconify.design`；若需对接备用域，应在 `backend/src/routes/icons.ts` 等处显式改造并补充测试。

---

## 与本项目其他故障的区分

| 现象 | 更可能原因 |
| --- | --- |
| 匹配无结果 / 语义不对 | LLM 配置、`/api/match`、catalog 词表，**非** Iconify SVG 链路。 |
| 仅 SVG 失败 | Iconify 上游或后端代理、网络；按上表 502/404 区分。 |

---

## 相关链接（官方）

- 官网：<https://iconify.design/>
- API 文档：<https://iconify.design/docs/api/>
- 自托管：<https://iconify.design/docs/api/hosting.html>

---

*文档随实现变更时请同步更新 `backend/src/routes/icons.ts` 与 `frontend` 中 `@iconify/react` 的用法说明。*
