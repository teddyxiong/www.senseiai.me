## 目标

在 `teddy` 分支为主站（以及各语言静态站产物）开发一个“登录入口 + 登录状态展示”的通用组件，满足以下能力：

- Header 顶部菜单新增 `Sign in` 与 `Try for free` 按钮
- 未登录：点击 `Sign in` 跳转登录页并携带 `?next=...` 回跳来源页面
- 已登录：显示头像 + 名字 + 下拉菜单（`Plan & Billings`、`Sign out`）
- `Sign out`：调用 `POST /api/auth/sign-out`，然后跳转登录页并携带 `?next=...`
- Google one-tap：仅未登录时触发（避免登录用户、auth 页面、或频繁重复弹层）

## 已知线上接口/入口（契约）

- 登录状态：`GET https://www.senseiai.me/api/me`
  - 已登录：HTTP 200，Body `{ authenticated: true, user: { id, email, name, emailVerified, image }, sessionExpiresAt }`
  - 未登录：HTTP 401，Body `{ authenticated: false }`
  - 调用要求：`fetch("/api/me", { credentials: "include" })`
- 登录入口：`https://www.senseiai.me/auth/login`
- 注册入口：`https://www.senseiai.me/auth/register`
- 退出登录：`POST https://www.senseiai.me/api/auth/sign-out`（要求：`credentials: "include"`）
- One-tap：在未登录时按以下方式调用：
  ```js
  import { runOneTap } from "/auth/one-tap.js";
  runOneTap();
  ```
- 账单入口：`https://www.senseiai.me/account/billing`

## 多语言策略（确认点：不在一个文件内塞所有语言）

这里不采用“单文件内包含所有 locale 并在运行时选择”的方式。

采用的策略是：**每个语言版本都有自己的一份 `account-menu.json` 文件内容**，但在代码中统一按同一路径引用（例如始终 import `src/config/account-menu.json`）。各语言版本在构建/发布时通过“覆盖文件内容”的方式得到本语言配置，不需要在 `account-menu.json` 内再区分或判断语言。

适配方式（两种选项，按你们当前发布流程选择其一）：

1) 单语言构建/发布（推荐与当前 `activeLocale` 发布流程一致）
- 每次 build 只针对一个 locale 产出静态站（例如输出到 `linkjobdist/ja`）
- 在该 locale 的代码/产物中，`src/config/account-menu.json` 已经是对应语言的内容

2) 多语言一次性构建（如果未来切换为一次 build 同时产出 /ja /es 等）
- 这时无法做到“同一路径同文件名同时存在多份内容”
- 需要退回到“多文件 + 运行时选择”或“多文件 + 构建时打包选择”
- 本文档先按选项 1 作为主路径设计

## 配置文件：`src/config/account-menu.json`（每个语言版本一份）

该文件只承担 AccountNav 的文案与链接定义，不承担业务逻辑。

建议最小结构（每个语言版本的文件内容相同结构，不同语言只改字符串）：

```json
{
  "buttons": {
    "signIn": "Sign in",
    "tryFree": "Try for free"
  },
  "menu": {
    "planAndBilling": "Plan & Billings",
    "signOut": "Sign out"
  },
  "links": {
    "login": "https://www.senseiai.me/auth/login",
    "register": "https://www.senseiai.me/auth/register",
    "billing": "https://www.senseiai.me/account/billing"
  },
  "a11y": {
    "accountMenu": "Account menu"
  }
}
```

说明：
- `Try for free` 固定走 `links.register`（即 `https://www.senseiai.me/auth/register`）
- `Plan & Billings` 固定走 `links.billing`（给定的完整 URL）
- `Sign out` 不走链接，走 `POST https://www.senseiai.me/api/auth/sign-out`   

## Island 组件方案（方案 2，React + client 指令）

### 组件边界

做一个独立的 React 组件作为 Island，仅在客户端运行：

- 组件职责：状态判定、渲染、交互（dropdown / signout / one-tap）
- Header 职责：只负责放置一个挂载点并把 config 传入组件

组件不依赖页面内容，不读取任何 Markdown/页面 frontmatter，不做 SSR 数据请求。

### 组件输入（Props）

最小 props（建议）：

- `menuConfig`：来自 `src/config/account-menu.json`
- `currentPathname`（可选）：默认使用 `location.pathname`，但为了可测试与 SSR 兼容可由外部注入
- `currentSearch`（可选）：默认使用 `location.search`

`next` 的统一计算规则：

```
next = location.pathname + location.search
```

因此能自动覆盖：
- `/pricing` → next=`/pricing`
- `/ja/pricing` → next=`/ja/pricing`
- 带 query 的页面也能保留 query

### 状态机（解决闪烁 + 提升稳定性）

组件状态建议：

- `unknown`：初始化（允许先渲染一个固定宽度占位，避免布局跳动）
- `signedOut`：未登录（显示 Sign in / Try for free）
- `signedIn`：已登录（显示头像/名字/菜单）
- `error`：网络异常（降级为 `signedOut`）

### 请求与缓存策略（减少每页 /api/me 与 UI 闪烁）

缓存目标：在同一 tab 内页面切换时减少重复请求，并让 UI 尽可能“先稳定渲染”。

建议使用 `sessionStorage` 做短 TTL 缓存：

- key：`account.me.v1`
- value：`{ ts: number, authenticated: boolean, user?: {...} }`
- TTL：例如 60 秒

渲染策略：

1. 组件加载：先读缓存，若未过期直接渲染 `signedIn/signedOut`
2. 后台发起 `/api/me` 再校验一次（stale-while-revalidate）
3. 若结果变化（例如缓存为登录但已退出），更新 UI 并更新缓存

注意：`fetch("/api/me", { credentials: "include" })` 必须带 `credentials: "include"`，否则无法带 cookie。

### UI/交互规则

未登录：
- `Sign in`：跳转 `menuConfig.links.login + "?next=" + encodeURIComponent(next)`
- `Try for free`：跳转 `menuConfig.links.register + "?next=" + encodeURIComponent(next)`

已登录：
- 展示 `user.image`（头像）与 `user.name || user.email`（名称兜底）
- 名字右侧三角 hover 打开下拉菜单
- 下拉菜单项：
  - `Plan & Billings`：跳转 `menuConfig.links.billing`
  - `Sign out`：触发退出流程

退出流程（按确认要求）：

1. `await fetch("https://www.senseiai.me/api/auth/sign-out", { method: "POST", credentials: "include" })`
2. 清理缓存（例如删 `account.me.v1`）
3. 跳转登录页并带 `next`：
   - `location.href = menuConfig.links.login + "?next=" + encodeURIComponent(next)`

### One-tap 触发规则（仅未登录触发）

在确认未登录后触发 one-tap：

- 只有当 `/api/me` 返回 401（或解析后 authenticated=false）时才允许触发
- 排除路径：
  - 当前 pathname 以 `/auth/` 开头时不触发（避免与登录/注册页面冲突）
- 为避免多页反复弹层，增加冷却：
  - `localStorage` 记录 `account.oneTap.cooldownUntil`（毫秒时间戳）
  - 未到期则不触发

触发方式：

```js
import { runOneTap } from "/auth/one-tap.js";
runOneTap();
```

### Header 集成点（最小改动）

在 `src/layouts/partials/Header.astro` 的导航右侧区域加入 AccountNav Island 挂载点，传入：

- `currentLocale`（已在 Header 内解析）
- `menuConfig`（import `src/config/account-menu.json`）

目标是：以后迁移到其他语言站点时，只需要覆盖该语言版本的 `src/config/account-menu.json`，Header 的挂载方式保持一致。

## 验收/验证清单

- 未登录：
  - Header 显示 `Sign in`、`Try for free`
  - 点击后跳转：
    - `/auth/login?next=...`
    - `/auth/register?next=...`
  - `next` 对 `/ja/...` 页面保留 locale 前缀与 query
  - 未登录时触发 one-tap（且不在 `/auth/*` 页面触发）
- 已登录：
  - 调用 `/api/me`（200）后显示头像与名字
  - hover 三角显示下拉菜单
  - `Plan & Billings` 打开 `https://www.senseiai.me/account/billing`
  - `Sign out`：调用 `POST /api/auth/sign-out` 后跳转 `/auth/login?next=...`
- 性能/体验：
  - 同一 tab 内频繁切页不应每次都闪烁（TTL 缓存有效）
  - 网络失败不应阻塞页面（降级显示未登录）
