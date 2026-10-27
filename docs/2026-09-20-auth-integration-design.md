# Sensei 与 Auth 登录集成升级设计说明（第六版，待审阅）

> 状态：草案，等待审阅
>
> 日期：2026-09-20
>
> 修订依据：五轮逐条核对 `2026-09-20-auth-integration-design_review.md` 与当前权威工作区。
>
> 本文定义目标、边界、实现方法、预计文件和验收标准，不是开发执行计划。审阅通过前不修改业务代码。

## 1. 核对基准

审阅者使用的 `/Users/teddy/Documents/aaa/...` 是同一项目的另一份检出，并非错误路径；但它与本任务工作区在 `public/auth/sign-in.js` 等文件上存在版本差异。本任务的分析、计划和后续实现只以以下当前工作区为权威基准：

- Sensei：`/Users/silvia/Documents/dist/Sensei`
- Sensei 分支：`anqi`
- Sensei 业务代码核对基线：`9cdc6b5c631c058f6a79c77d3ab9013ad7b00b4f`；其后的提交包含设计/审阅文档和仓库配置调整，但未改变本文分析涉及的登录业务调用链。
- Auth：`/Users/silvia/Documents/dist/auth`
- Auth 当前分支/提交：`main` / `aa2c1e417e54288d4cf79f0138326851125fb30e`
- Auth 接口文档：`/Users/silvia/Documents/dist/auth/API接口文档.html`
- Auth OpenAPI：`/Users/silvia/Documents/dist/auth/openapi.json`

跨机器复核时应同时记录仓库远端、分支和提交 SHA，不能只凭本机绝对路径认定代码相同。涉及单个文件执行顺序的结论，必须在上述权威提交重新验证。

制定开发计划和开始开发前，必须重新读取两个仓库当时的分支、HEAD、工作区状态和相关调用链，不能把上述提交永久当作固定基线。

## 2. 目标

1. 用户从 Sensei 任意合法英文站内页面发起 Google 或 GitHub 登录后，回到发起登录的 pathname、query 和 hash，而不是固定进入 Dashboard。
2. 未被 Auth 当前静态白名单枚举的真实页面，也能正常开始登录，不再收到 `400 INVALID_CALLBACK_URL`。
3. 提供与具体页面无关的登录保护方法，供未来 Pricing 及其他页面复用。
4. 提供与当前 Auth 契约一致的 Customer Portal 通用客户端，但本次不接入 Pricing 或任何具体按钮。
5. 修正 Sensei 登录缓存、401/503 状态、退出登录和 Google One Tap 的真实缺陷。
6. 保留已完成的账户菜单交互和样式，不在本期重做 Navbar。

## 3. 产品与开发边界

### 3.1 本期包含

- Google OAuth 登录。
- GitHub OAuth 登录。
- Google One Tap；它属于 Google 登录方式。
- OAuth 首次登录自动创建账户，即“登录即注册”。
- 登录前页面地址的安全保存与登录后回跳。
- 通用登录保护方法。
- 通用 Customer Portal API 客户端。
- `/api/me` 的客户端状态识别、缓存失效和显式动作刷新策略。
- 退出登录的 CSRF token 获取、补种和失败处理。
- 当前账户菜单配置类型错误和死代码清理。
- 与上述行为直接对应的测试。

### 3.2 本期明确不包含

- 邮件注册或邮件登录的 UI、流程和测试。
- 独立注册流程；不新增“注册”产品概念。
- 多语言登录页与语言切换；英语作为当前兜底语言。
- 修改 Pricing 页面、套餐按钮或支付按钮。
- 把 Customer Portal 接入任何具体页面。
- 新购订阅、试用、Checkout Session 或支付落单流程。
- PayPal 动态 Customer Portal。
- 改造 Auth `/api/me` 的 Billing 响应契约。
- 重构与本目标无关的邮件、管理员、桌面端或支付逻辑。

Auth 后端现有邮件和注册能力本期既不删除也不扩展；它们不进入 Sensei 公共登录流程和验收范围。

## 4. 已核实的当前事实与缺陷

### 4.1 Auth 已有的浏览器侧安全校验

`auth/public/auth/app.js` 中的 `safeNext()` 已经具备以下结构校验：

- 必须以单个 `/` 开始。
- 拒绝 `//` 协议相对地址。
- 拒绝绝对 URL 和危险协议。
- 拒绝反斜杠绕过。
- 限制长度为 2048 字符。
- 保留合法 query 和 hash。

因此，本期不重写 `safeNext()` 的结构校验；但浏览器侧仍需新增“可作为最终导航目标”的策略校验。仅靠 `safeNext()` 会接受 `/auth/sign-in?...` 和 `/api/...`，已登录用户的 `location.href = next` 又不会经过服务端 `rejectIfBadCallbackURL()`，会绕过服务端保留命名空间规则。

Auth 浏览器侧应在 `public/auth/app.js` 增加一个复用 `safeNext()` 的导航目标 helper（最终命名在开发计划确定），并让所有把不可信 `next` 用作最终导航或 OAuth callback 的页面调用它。现有 `safeNext()` 和基础结构测试保留。

### 4.2 已有会话仍会丢失 `next`

当前实际文件 `auth/public/auth/sign-in.js` 的执行顺序是：

1. 第 13–24 行先请求 `/api/me`。
2. 如果已有会话，第 19 行固定执行 `location.href = "/dashboard/"`。
3. 第 31 行之后才读取 `next` 并计算 `redirectTarget`。

所以原设计对此问题的判断成立。Claude 第二轮已经撤回第一轮第 1 条，并确认该结论来自另一份内容不同的检出。

本期需要把 `next` 的解析和 `redirectTarget` 计算移到会话检查之前；已有会话、Google 登录和 GitHub 登录都使用同一个安全目标。

### 4.3 静态服务端白名单会直接中断登录

`auth/src/auth/index.ts` 的 `isAllowedNext()` 当前只接受 `ALLOWED_NEXT_PREFIXES` 中枚举的路径。`auth/src/index.ts` 会检查社交登录 JSON 中的 callback 字段；相对路径不在白名单时直接返回：

```text
400 INVALID_CALLBACK_URL
```

当前 Sensei 至少存在以下未被白名单覆盖的真实页面：

- `/interview-copilot`
- `/coding-interview-copilot`
- `/ai-mock-interview`
- `/cart`
- `/payment-success`
- `src/pages/[regular].astro` 生成的其他内容页

因此这不是一般的“未来覆盖率不足”，而是会阻断现有页面 Google/GitHub 登录的 P0 缺陷。

### 4.4 Sensei 没有采集和监听 hash

`AccountNav.tsx` 当前只保存 `pathname` 和 `search`，`buildNext()` 不含 hash，也没有监听 `hashchange`。用户进入页面后切换锚点，生成的 `next` 不会更新。

本期需要：

- `LocationSnapshot` 增加 `hash`。
- `buildNext()` 拼接 pathname、search 和 hash。
- 监听并清理 `hashchange`。
- Astro 页面切换事件仍保留。

### 4.5 OAuth 返回后可能继续显示未登录 60 秒

Sensei 在 `/api/me` 返回 401 后，会把 `authenticated:false` 写入 `sessionStorage`，TTL 为 60 秒。OAuth 是同一标签页中的整页导航，不会清除 `sessionStorage`。登录返回原页时，AccountNav 会命中新鲜的未登录缓存并停止 revalidate。

所以即使回跳地址正确，页头也可能继续显示 Sign in，最长约 60 秒。

本期采用“主动清除 + 页面级兜底”两层规则解决，不在 Auth 中耦合 Sensei 的缓存 key：

- 所有 Sensei 发起登录的入口都调用统一 `redirectToSignIn()`。
- `redirectToSignIn()` 在导航前执行 `clearMeCache()`。
- Header 登录入口和未来 `requireAuthenticated()` 的 401 分支都必须走该方法。
- Header 继续使用带真实 `href` 的 `<a>`；普通 click 只清缓存，不 `preventDefault()`，从而保留复制链接、在新标签页打开等原生行为。
- 登录 anchor 必须带 `data-astro-reload`（或 Astro 当前版本的等效 opt-out），明确跳过 View Transitions 客户端路由。当前 Astro 5.16.6 在目标 Auth 文档缺少 View Transitions 标记时会回退为 `location.href`，不会把 Auth HTML swap 进 Sensei；显式 opt-out 的作用是避免一次无意义的预取，并消除对框架回退细节的依赖。
- 任何新登录入口不得手写登录 URL；必须通过 `buildSignInUrl()` 生成地址，并在当前标签页导航前调用统一缓存清理方法。
- 兜底规则：`authenticated:false` 缓存可以用于快速水合 UI，但不能阻止每个新 document 中 AccountNav 的首次 hydration revalidate。OAuth 回跳和 One Tap 的 `window.location.reload()` 都会创建新 document，因此能够立即确认新会话。
- AccountNav 使用 `transition:persist`；同一 document 内的 Astro pathname 变化不重新 hydration，也不因为 signed-out 缓存而无条件重复请求 `/api/me`。两个 mobile/desktop AccountNav 的首次并发请求继续由共享 in-flight 去重合并。
- 本期不新增 5–10 秒 signed-out 独立 TTL；首次 hydration 强制确认已经覆盖本期的登录回跳问题，额外 TTL 不能替代服务端授权，且会重新引入按浏览 PV 请求 Auth 的成本。
- 已登录缓存仍可按正常 TTL 使用；服务端接口继续承担最终鉴权。

该方案不依赖 `document.referrer`，不需要回跳标记，也不要求枚举 Google OAuth、GitHub OAuth、One Tap 或其他登录入口。

### 4.6 失败冷却、离线跳过和显式动作冲突

`session.ts` 当前在离线或 30 秒失败冷却期间返回 `kind:"skipped"`。AccountNav 在冷启动且没有可用缓存时会把 `skipped` 或 `error` 都显示成未登录，这与“只有 401 才表示未登录”冲突。

本期明确区分两类请求：

- 页头后台刷新：尊重离线状态和失败冷却，允许返回 `skipped`，并保留 `unknown` 或已有缓存，不转换为 signed out。
- 用户显式受保护动作：忽略 `navigator.onLine` 和失败冷却，始终尝试一次新鲜请求，但仍复用 in-flight 去重。`navigator.onLine` 可能在代理、VPN 或 WebView 中误报，不能作为用户动作的硬闸门；真实请求失败后再返回 unavailable。

`skipped` 只属于后台刷新；如果被上层接收到则映射为 `unavailable`，`status` 为空。只有明确的 HTTP 401 才能产生未登录结论。

### 4.7 当前退出登录实际上会失败但 UI 假装成功

Auth 只对 `/api/auth/sign-out` 强制双提交 CSRF：Cookie 中的 `csrf_token` 必须与 `X-CSRF-Token` 请求头一致。

Sensei 当前退出请求没有请求头，并且在 `finally` 中无条件清缓存和导航。因此服务端可返回 403，但页面仍表现为退出成功。

CSRF cookie 由 Auth 在 `/auth/*` HTML 和 `/api/me` 响应中补种，属性为可被 JavaScript 读取、SameSite=Lax、Path=/、最长 24 小时。退出成功后 Auth 会清除它。

本期退出流程：

1. 从 Cookie 读取并校验 `csrf_token`。
2. 如果缺少 token，先请求一次 `GET /api/me` 触发 Auth 补种，再读取一次。
3. 第二次仍缺少 token，停止并返回失败，不发送不受保护的写请求。
4. POST sign-out 时发送 `X-CSRF-Token`、`credentials:"include"`；接口请求体不是必需项，不发送额外字段。
5. 仅在 `response.ok` 后清除 `/api/me` 缓存并导航。
6. 403、503 或网络错误时保留已登录 UI，并允许重试。

### 4.8 Google One Tap 会把服务故障当成未登录

`auth/public/auth/one-tap.js` 当前使用 `response.ok` 判断是否登录，catch 返回 false，所以 503 和网络错误都会触发 One Tap。

Sensei `src/lib/account/oneTap.ts` 还维护 10 分钟冷却，而 Auth One Tap 模块维护 24 小时关闭冷却，两套长期计时重复。

本期规则：

- Auth One Tap 只在 `/api/me` 明确返回 401 时继续展示。
- 200、503、网络失败或非法响应均不展示。
- Auth 保留用户关闭后的 24 小时冷却。
- Sensei 删除自己的长期冷却，只保留同页最小触发间隔和 in-flight 去重。

One Tap 保留在本期，而不与 Billing 解耦合并到后续阶段：它是当前开放的 Google 登录方式之一，修复只涉及明确的 401/503 分流和删除重复冷却，且与本期“服务故障不得伪装成未登录”的统一状态规则直接相关。

### 4.9 账户菜单配置与类型已经不一致

`src/config/account-menu.json` 已在提交 `9cdc6b5c` 中移除 `tryFree` 和 `register`，不应再次把“移除配置”列为待办。但以下代码尚未同步：

- `src/lib/account/types.ts` 仍要求 `buttons.tryFree` 和 `links.register`。
- `AccountNav.tsx` 仍计算未使用的 `tryFreeHref`。
- `menuConfig.ts` 的 `satisfies AccountMenuConfig` 因此触发 TS1360。

本期应收敛类型并删除死变量，不修改已经正确的 JSON 结构。

实际运行 `tsc --noEmit --incremental false` 还会报告 i18n、Cloudflare Workers 类型和正则 target 等历史错误。这些不属于本期，但意味着不能把“全仓 tsc 零错误”当作当前基线。开发计划必须记录基线错误，并要求本期不得新增错误；账户菜单 TS1360 必须消失。

### 4.10 本地开发鉴权旁路必须保留

`session.ts` 已有仅在 `import.meta.env.DEV` 生效的 `readDevAuth()` / `hasDevAuthOverride()`，它依赖本地存储和 `PUBLIC_ACCOUNT_DEV_AUTH` 配置。

- `requireAuthenticated()` 必须复用现有 session 层，因此自然尊重 dev override。
- `signOutCurrentSession()` 必须在 DEV override 存在时把 `DEV_AUTH_STORAGE_KEY` 写为 `"0"` 并直接返回 success，不读取 CSRF cookie、不发网络请求；`signOutAndReturn()` 随后清一次缓存并 reload 当前本地页面。AccountNav 不保留第二套 DEV 退出实现。
- dev override 必须继续受 `import.meta.env.DEV` 保护，生产构建不能启用。
- Customer Portal 客户端不伪造支付渠道 URL；本地没有 Auth/Billing 服务时通过 mock fetch 做单元测试，需要端到端联调时连接本地 Auth/Billing。
- 不在本期自动改写 `account-menu.json` 的生产域名；本地登录状态使用现有 dev override。

## 5. 安全回跳设计

### 5.1 Auth 回跳目标统一判定规则

Auth 浏览器导航策略与服务端 `isAllowedNext()` 共享同一份规范和测试向量；不要求浏览器 JavaScript 与服务端 TypeScript 物理共用一个模块。

1. 结构层：复用或等价实现现有 `safeNext()`，拒绝外部地址、反斜杠和超长输入。
2. 导航策略层：默认拒绝 `/auth`、`/auth/*`、`/api`、`/api/*`，只开放经盘点的精确内部例外。

精确例外在两侧采用完全相同的规则：

- `/auth/legacy-claim/complete`：必须是完全一致的路径，不允许额外 query 或 hash。
- `/auth/desktop`：只允许该精确 pathname，拒绝 hash；query 必须包含非空的 `redirect_uri`、`code_challenge`、`state`、`device_id`。本层不复制 loopback 或 PKCE 的语义校验：`public/auth/desktop.js` 在展示确认界面前校验 loopback 和基本参数，`/api/auth/device/authorize` 在产生授权码前执行服务端最终校验。其他 `/auth/desktop/*` 不放行。

该取舍避免引入第三份 loopback/PKCE 规则。一个结构完整但语义非法的 Desktop self-next 最多返回 Desktop 错误页，不会产生授权码或跳转到外部地址。

浏览器收到非法目标时降级到 `/dashboard/`；服务端收到非法 callback 时返回 `400 INVALID_CALLBACK_URL`。Sensei 自身的 returnTo 不需要 Auth 内部例外，直接拒绝全部 `/auth` 与 `/api` 保留命名空间。

### 5.2 浏览器侧的来源分类

浏览器必须先区分导航值的来源：

1. URL query、referrer 或其他浏览器输入中的 `next`：不可信，必须经过 §5.1 的结构层和导航策略层。该规则覆盖已有会话跳转、社交登录 callback、Auth 首页，以及现存 Auth 页面中最终消费这类 `next` 的导航点；不能直接执行 `location.href = safeNext(raw)`。
2. `/auth/legacy-claim/start` 响应中的 `next`：这是该端点专用的服务端生成中转契约，只能是 `/auth/legacy-claim/complete`、携带编码 email 和固定嵌套 next 的 `/auth/verify-email?...`，或携带固定嵌套 next 的 `/auth/sign-in?...`。`legacy-claim-start.js` 可以直接导航，但服务端路由测试必须断言这三种输出形状和 email 编码；这不构成“所有 API 返回的 next 都可信”的通用规则。
3. 页面自身构造的 Desktop self-next：仍经过 §5.1 的 `/auth/desktop` 精确例外。

### 5.3 Auth 服务端

服务端是最终安全边界，不能把非法 callback 静默替换后继续登录。`rejectIfBadCallbackURL()` 必须保持 fail-closed：非法值返回 `400 INVALID_CALLBACK_URL`。

服务端 `isAllowedNext()` 使用 §5.1 的统一规则，从“枚举所有业务页面”调整为：

1. 先执行与 `safeNext()` 等价的结构校验和最大长度限制。
2. 接受合法的站内业务相对路径，解决动态内容页和新页面无法枚举的问题。
3. 默认拒绝保留命名空间 `/api`、`/api/*`、`/auth`、`/auth/*`，避免把登录回跳用于内部接口或伪造认证页面。
4. 为现有 Auth 内部流程保留 §5.1 定义的两个精确例外，不得使用整个 `/auth/*` 前缀例外，也不在此层重复 loopback/PKCE 语义校验。
5. 非法 callback 保持 400，并加入回归测试；本期不新增日志系统。

这是有意识的取舍：取消不断增长的业务页面 allow-list，以支持真实的任意站内内容页；通过结构校验、保留命名空间 deny-list、精确内部例外和服务端 400，保留必要的防外跳与站内认证钓鱼防护。

当前代码搜索没有发现 `/api/*` 被用作 Better Auth callback/next 的合法依赖。`/api/auth/device/authorize` 是页面发起的接口请求，客户端最终的 loopback redirect 走独立校验，不属于 `isAllowedNext()`。由于当前 allow-list 曾显式包含 `/api/`，开发计划仍需在修改前重新搜索全部 callback 字段及测试，确认没有遗漏后才能收紧。

`signInWithSocial()` 的空 callback 兜底从 `/auth/` 改为 `/dashboard/`，否则新的保留命名空间规则会让兜底请求必然返回 400。

## 6. Sensei 通用实现

### 6.1 `authFlow.ts`

建议新增 `src/lib/account/authFlow.ts`，集中提供：

```ts
type AuthGateResult =
  | { kind: "authenticated"; user: MeUser }
  | { kind: "redirecting" }
  | { kind: "unavailable"; status?: number };

type SignOutResult =
  | { kind: "success" }
  | { kind: "unavailable"; status?: number };

function currentReturnTo(): string;
function buildSignInUrl(returnTo?: string): string;
function redirectToSignIn(returnTo?: string): void;
async function requireAuthenticated(options?: {
  returnTo?: string;
}): Promise<AuthGateResult>;
async function signOutCurrentSession(): Promise<SignOutResult>;
async function signOutAndReturn(): Promise<SignOutResult>;
```

行为约束：

- 默认 returnTo 为 `pathname + search + hash`。
- returnTo 必须通过结构校验，并拒绝 Sensei 页面不应使用的 `/auth`、`/api` 保留命名空间。
- `redirectToSignIn()` 导航前清除 `/api/me` 缓存。
- `/api/me` 200 且响应结构有效：authenticated。
- 401：不写入新的 signed-out 缓存；清除已有缓存后调用 `redirectToSignIn()`，进入 redirecting。
- 503、其他非成功状态、网络失败、离线、skipped 或非法响应：unavailable，不跳登录。
- 用户显式调用时绕过失败冷却和 `navigator.onLine` 短路，但不绕过并发去重。
- 复用现有 dev override，不另写第二套开发登录逻辑。
- `signOutCurrentSession()` 在 DEV override 下只把本地开关写为 `"0"`，其他环境只提交服务端退出；两条路径都只返回结果，不清缓存、不导航。`signOutAndReturn()` 捕获调用前是否存在 DEV override：DEV success 清一次缓存并 reload，生产 success 调用 `redirectToSignIn(currentReturnTo())`。AccountNav 只负责触发封装并在失败时恢复 UI。

页面不读取 HttpOnly Session Cookie。浏览器用 `credentials:"include"` 发送 Cookie，Auth 负责判断有效性。

### 6.2 `session.ts`

session 层需要：

- 把无缓存副作用的网络读取与 UI revalidate 分开：底层 fetch 返回 unauthorized/ok/error；后台 revalidate 决定是否写缓存；authFlow 的 401 跳转不先写 false 再清除。
- 为后台刷新和用户显式刷新提供清晰参数，例如 `revalidateMe({ force: true })`；最终命名在开发计划确定。
- 保留 401、服务不可用、离线/冷却跳过和响应非法之间的区别。
- 运行时验证 200 响应至少包含 `authenticated:true`、有效 user id 和 email。`sessionExpiresAt` 当前在 Sensei 类型中可选：缺失时仍视为已登录，只按普通缓存 TTL；存在但格式非法时才视为 invalid response。
- 缓存只用于 UI 快速渲染，不作为服务端授权依据。
- signed-out 缓存只负责快速水合，不能阻止每个新 document 中 AccountNav 的首次 hydration revalidate；之后同一 document 内的 Astro pathname 变化继续使用缓存，不无条件请求。signed-in 缓存仍可按 TTL 使用。
- `error` 和 `skipped` 在冷启动时保持 unknown/error，不显示 signed out。

### 6.3 Customer Portal 通用客户端

根据用户已确认的范围，本期仍交付通用方法，即使 Pricing 接入留到后续分支。建议新增 `src/lib/account/customerPortal.ts`：

```ts
type CustomerPortalResult =
  | {
      kind: "success";
      provider: "stripe" | "creem";
      url: string;
      subscriptionExpiresAt: string | null;
    }
  | { kind: "authenticationRequired" }
  | { kind: "noManageableSubscription" }
  | { kind: "unavailable"; retryable: boolean }
  | { kind: "invalidResponse" };

async function createCustomerPortal(): Promise<CustomerPortalResult>;
```

使用 `subscriptionExpiresAt` 命名，是为了明确 Auth 响应中的 `expiresAt` 表示订阅周期/权益结束时间，不是 Portal URL 的失效时间。

实现规则：

- GET `/api/billing/customer-portal`，`credentials:"include"`。
- GET 不添加 CSRF token。
- 200 时只接受 `stripe` / `creem`、HTTPS URL 和合法可空日期。
- 401 在读取 body 前返回 authenticationRequired。
- 所有 5xx（包括 HTML、空 body 或其他不可解析响应）返回 retryable unavailable。
- 404 读取 body 仅用于识别 `NO_MANAGEABLE_SUBSCRIPTION` 并返回 noManageableSubscription；未知 code 或不可解析 body 返回 invalidResponse。
- 其他未知非 2xx，以及 200 但结构非法的响应返回 invalidResponse。
- 客户端保持无 UI 副作用：不清 session 缓存、不跳登录、不打开 URL、不跳 Pricing。
- 调用方收到 401 后负责使缓存失效并调用通用登录回跳；成功后由调用方决定是否 `window.location.assign(url)`。

### 6.4 OAuth 后继续具体动作

OAuth 是整页导航，登录前内存里的 JavaScript callback 无法在登录后继续。未来如果 Pricing 要“登录后继续某动作”，只能通过回跳页面可识别的有限动作标识恢复。

本期不规定参数名、不实现恢复协议，也不提前锁定 Pricing 行为；只记录这一技术约束。

## 7. Customer Portal 的业务语义

`GET /api/billing/customer-portal` 用于管理已有的可管理自动续费订阅，不是创建新订阅。

适用条件：

- 用户已登录。
- 存在未取消的 Stripe 或 Creem 自动续费订阅。
- Auth 已保存对应 provider customer ID。

不适用于：

- Pricing 首次购买。
- 开始试用。
- Checkout Session。
- 一次性或 Lifetime 购买。
- 没有可管理订阅的用户。
- PayPal 动态 Portal；当前只有 `/api/me.billing.cancellationUrls.paypal` 固定入口。

因此未来 Pricing 分支必须先确定按钮是“购买”还是“管理已有订阅”。本期通用客户端不能被描述为 Checkout 方案。

## 8. 本期不修改 `/api/me` Billing 契约

Auth 当前会在 Billing binding 缺失或查询失败时让 `/api/me` 返回 503，这确实会扩大 Billing 故障对身份 UI 的影响。但把它改成 `200 + billing:null` 会影响：

- Auth Dashboard 和 Sidebar。
- 桌面客户端及 Tauri 指南。
- tempserver Service Binding 等内部消费者。
- OpenAPI、HTML 文档、Swagger 和多组 Auth 测试。

部分现有 UI 使用 optional chaining，直接返回 `billing:null` 可能把服务故障静默显示成“订阅消失”。因此原第一版低估了影响面。

本期采取最小安全方案：Sensei 按 HTTP 状态区分 401 与 503，不改 Auth `/api/me` 契约。Billing 解耦记录为独立后续需求，必须先盘点全部消费者并为“Billing 暂不可用”定义显式 UI 状态。

## 9. 状态与责任矩阵

| 场景 | 含义 | 责任与行为 |
| --- | --- | --- |
| `/api/me` 200 且结构有效 | 会话有效 | session 层写已登录缓存；调用方执行动作 |
| `/api/me` 401（页头后台刷新） | 无有效会话 | revalidate 写未登录缓存并显示 signed out |
| `/api/me` 401（显式受保护动作） | 无有效会话 | authFlow 不写 false；清除旧缓存后带 `next` 登录 |
| `/api/me` 503/其他错误 | 服务不可用 | 返回 unavailable；不跳登录、不改成 signed out |
| `/api/me` 网络错误 | 无法确认 | 返回 unavailable；保留旧状态或 unknown |
| `/api/me` skipped | 离线或后台冷却 | 背景 UI 保留状态；显式动作映射 unavailable |
| Portal 200 | 已创建管理链接 | 纯客户端返回已验证数据；调用方决定导航 |
| Portal 401 | 会话无效 | 纯客户端返回 authenticationRequired；调用方清缓存并调用 authFlow |
| Portal 404 | 无可管理订阅 | 返回 noManageableSubscription；不登录、不跳 Pricing |
| Portal 5xx | Billing、渠道或上游基础设施不可用 | 无论 body 是否可解析都返回 retryable unavailable |
| Sign-out 200 | 服务端会话结束 | 清缓存并导航 |
| Sign-out 403/503/网络错误 | 未确认退出 | 保留已登录状态并允许重试 |

核心规则：只有明确 401 才引导登录；服务故障不能伪装成未登录。

## 10. 默认地址规范

- Auth 无合法 `next` 时的安全默认目标统一写作 `/dashboard/`。
- Auth Worker 同时支持 `/dashboard` 和 `/dashboard/`；账户菜单当前绝对链接无尾斜杠只是兼容别名，不作为登录默认值。
- Sensei `config.json` 的 `trailing_slash:false` 适用于站点页面；验收比较回跳时以浏览器最终规范化 URL 为准，不因等价的单次尾斜杠重定向判失败。
- Sensei 与 Auth 的生产路由都位于 `https://www.senseiai.me`，当前登录调用是同源请求，不需要新增 CORS 或 `SameSite=None`。

## 11. 预计修改文件

### 11.1 Sensei

预计新增：

- `src/lib/account/authFlow.ts`
- `src/lib/account/customerPortal.ts`
- Sensei 行为测试文件和必要的最小测试配置；具体名称在开发计划确定。

预计修改：

- `src/lib/account/session.ts`
- `src/lib/account/types.ts`
- `src/lib/account/constants.ts`
- `src/lib/account/oneTap.ts`
- `src/layouts/helpers/AccountNav.tsx`：登录 anchor 保留真实 href，并增加 `data-astro-reload`；初次 hydration 强制确认 signed-out 缓存，同 document 的 pathname 变化不重复强制请求。
- `package.json` 及 lockfile（仅当审阅后确定引入 Vitest）

当前不需要修改：

- `src/config/account-menu.json`：`tryFree` / `register` 已移除。
- `src/pages/pricing.astro`
- `src/layouts/partials/PricingSection.astro`
- `src/content/pricing/*`
- `src/pages/cart.astro`
- 任何套餐或支付按钮

提交 `9cdc6b5c` 已完成账户菜单样式、下拉交互和头像尺寸修改。后续不得回退其交互结构与样式；这不是“未提交改动保护”，而是已提交基线保护。

### 11.2 Auth

预计修改：

- `public/auth/app.js`：保留结构 helper，增加浏览器导航策略 helper；社交登录空 callback 改用 `/dashboard/`。
- `public/auth/sign-in.js`：先计算经过导航策略校验的 redirectTarget，再检查已有会话。
- `public/auth/index.js`：已有会话的最终导航使用新策略。
- `public/auth/desktop.js`：设备登录 self-next 使用 `/auth/desktop` 精确例外，不再回退到 `/auth/`。
- `public/auth/register.js`、`public/auth/verify-email.js`、`public/auth/forgot-password.js`：仅把现有 `next` 消费接入同一导航策略，不扩展邮件或注册产品能力。
- `src/auth/index.ts`：结构校验、保留命名空间拒绝和精确内部例外。
- `public/auth/one-tap.js`：只在明确 401 时展示。
- `tests/allowed-next.test.ts`：重写现有白名单断言并加入真实 Sensei 路径。
- `tests/safe-next.test.ts`：保留结构测试，并增加浏览器导航策略、保留命名空间和精确例外测试。
- `tests/legacy-claim-route.test.ts`：固定三种服务端生成中转地址、嵌套 next 和 email 编码契约。
- 现有 Desktop/device 测试：确认语义非法参数不能进入确认或产生授权码，不新增第三套校验实现。
- 登录页顺序与 One Tap 的行为测试；具体文件名在开发计划确定。

预计不修改：

- `public/auth/legacy-claim-start.js`：已盘点；它只消费 `/auth/legacy-claim/start` 的服务端生成中转契约。通过服务端路由测试固定三种输出形状，不把该响应误当作浏览器 query `next`。
- `src/routes/me.ts`
- `openapi.json` 和 `API接口文档.html` 的 `/api/me` 契约
- `src/routes/billing.ts` 的 Customer Portal 实现
- 邮件登录、注册的产品流程及多语言逻辑；上述页面若被修改，仅限共享安全策略接线

## 12. 实施优先级

- P0：Auth 浏览器和服务端统一回跳策略，消除现有英文页面的 400，并关闭客户端导航绕过。
- P0：盘点 `/auth/*`、`/api/*`、Legacy Claim 和 Desktop callback，固定精确例外及 query 规则。
- P0：Auth 登录页已有会话尊重 `next`；Sensei 补全 hash 和 `hashchange`。
- P1：登录前主动清缓存；signed-out 缓存不得阻止每个新 document 的首次 hydration revalidate，但站内 pathname 变化不无条件增加请求。
- P1：401、503、network、skipped 分流；显式动作绕过失败冷却。
- P1：退出登录 CSRF token、补种和成功后清缓存。
- P1：账户菜单类型与死代码修正。
- P2：One Tap 失败关闭和重复冷却清理。
- 独立但仍属本期交付：Customer Portal 通用客户端及行为测试。

测试工具链虽然在开发计划中首先建立，但不改变上述业务严重度排序。

## 13. 测试策略

Auth 已使用 Vitest，可直接扩充现有测试。

Sensei 当前没有 test script 或测试框架；现有 `scripts/account-nav-dropdown.test.mjs` 只是源码结构检查，不能验证 HTTP 分支。本期不能再用正则扫描源码假装覆盖 200/401/404/503 行为。

开发计划的第一个技术任务必须在以下最小方案中定案：

- 推荐：为 Sensei 添加最小 Vitest 配置，直接测试 TypeScript 纯逻辑和 mock fetch；不引入 DOM 测试库，除非 AccountNav 行为无法通过抽出的纯函数验证。
- 备选：把纯逻辑保持为零依赖、Node 可直接加载的模块并使用内置 `node:test`。不得复制一套仅供测试的实现。

无论采用哪种方案，都必须记录现有 `tsc` 基线错误，并保证本期不新增类型错误。

### 13.1 浏览器与服务端回跳

必须接受：

- `/`
- `/interview-copilot`
- `/coding-interview-copilot`
- `/ai-mock-interview`
- `/cart`
- `/payment-success`
- `/pricing/?source=header#plans`
- `/pricing?source=header#plans`
- 一个由 `[regular].astro` 当前内容集合生成的真实路径
- 完全一致的内部例外 `/auth/legacy-claim/complete`
- `/auth/desktop` 携带合法设备登录 query

必须拒绝：

- `//evil.example`
- `https://evil.example`
- `/\evil.example`
- `javascript:alert(1)`
- 无前导 `/` 和空串
- 超过最大长度
- `/api/...`
- `/auth/sign-in?error=session+expired+enter+password`
- `/auth/legacy-claim/complete?unexpected=1`
- `/auth/desktop/other`

上述保留命名空间向量必须同时覆盖浏览器导航策略和服务端策略。浏览器断言安全降级到默认页；服务端断言 400 fail-closed。Desktop 还要验证：四个必需 query key 缺一时拒绝；结构完整但 loopback/PKCE 语义非法时可回到 Desktop 错误页，但无法通过页面校验或 `/api/auth/device/authorize` 获得授权码。

Legacy Claim 路由测试必须分别覆盖三种服务端生成中转地址，断言未登录和未验证邮箱分支只包含固定认证路径、固定嵌套 next，并正确编码 session email；`legacy-claim-start.js` 的直接导航不能被新 query-next 策略误伤。还要验证社交登录 `/dashboard/` 兜底没有被新规则破坏。

### 13.2 登录回跳与缓存

- 已有会话访问合法 `next` 时回到该地址。
- Google/GitHub 使用同一个 redirectTarget。
- 首次 OAuth 用户是否仅靠 callbackURL 回跳必须通过集成验证，不能假设 Better Auth 的 `newUserCallbackURL` 默认行为；若需要显式传入，改动和测试落在 `public/auth/app.js`。
- 无合法 `next` 时进入 `/dashboard/`。
- pathname、query、hash 均保留；hashchange 后生成的新 next 立即更新。
- `/pricing` 与 `/pricing/` 经过站点规范化后，query 和 hash 都保持完整。
- 发起登录前清除未登录缓存；OAuth 返回后立即请求 `/api/me` 并显示已登录。
- One Tap reload 和 OAuth 回跳产生新 document 后，fresh signed-out 缓存不能阻止 AccountNav 首次 hydration revalidate。
- 两个 AccountNav 实例的首次并发确认共享 in-flight；同一 document 内连续 Astro pathname 变化不应按页面数产生新的 `/api/me` 请求。
- Header 保持真实 anchor href 并带 `data-astro-reload`；清缓存 click handler 不阻止复制链接、新标签页等原生行为。测试至少断言渲染后的 anchor 具有 opt-out 属性，并在生产同源环境做一次整页导航 smoke test，而不是引入新的浏览器测试框架只覆盖这一属性。

### 13.3 通用登录保护与 session

- 200 且结构有效返回 authenticated。
- 后台 401 写 signed-out 缓存；显式动作 401 不写 false，清旧缓存后构造带编码 next 的登录地址。
- 503、网络失败、非法响应和 skipped 不跳登录。
- 缺少 `sessionExpiresAt` 的 200 响应仍为 authenticated 并使用普通 TTL；存在但非法才判 invalid response。
- 背景刷新可参考离线状态并尊重冷却；显式动作无论 `navigator.onLine` 值如何都尝试请求，同时复用 in-flight。
- dev override 仅 DEV 生效，生产构建不可启用。

### 13.4 Customer Portal

- Stripe 与 Creem 200 正确解析。
- `expiresAt` 映射为 subscriptionExpiresAt，不当作 Portal URL 过期时间。
- 401 在读取 body 前正确映射；404 仅凭文档化 code 映射为 noManageableSubscription。
- 文档化 503 与基础设施 5xx（包括 HTML、空 body）都映射为 retryable unavailable。
- 其他未知非 2xx，以及 200 中的非 HTTPS URL、未知 provider、非法日期和非法 JSON 被拒绝。
- 测试通过 mock fetch 验证返回值与请求参数；导航、登录和缓存修改不属于该模块职责，不用源码正则断言“不存在的代码”。

### 13.5 退出登录与 One Tap

- 有 CSRF cookie 时发送匹配请求头。
- 缺少 cookie 时先通过 `/api/me` 补种并重读。
- 补种仍失败时不发送 sign-out。
- 服务端退出路径只在 2xx 返回 success；DEV override 路径在本地开关成功写为 `"0"` 后返回 success。`signOutAndReturn()` 只在 success 时清一次缓存，并按生产登录回跳或 DEV reload 执行后续导航。
- 403、503、网络失败保留已登录状态且不导航；行为测试直接覆盖 success 与这些失败分支的导航次数。
- DEV override 退出把本地开关写为 `"0"`，不读取 CSRF cookie、不发送 fetch，清一次缓存后 reload 当前页面；测试使用 DEV 构建变体固定该契约。
- One Tap 只在 401 时展示；503 和网络失败保持安静。

## 14. 验收标准

1. 所列真实英文页面均可正常开始 Google/GitHub 登录，不再返回 `INVALID_CALLBACK_URL`。
2. 从任意合法英文站内页面登录后，返回原 pathname、query 和 hash。
3. 浏览器和服务端都拒绝把 `/auth/*`、`/api/*` 当作任意回跳目标，只允许经过测试的 Legacy Claim 与 Desktop 精确例外。
4. 已有会话访问带合法 `next` 的登录页时也尊重 `next`；恶意 `next` 不会因直接 `location.href` 绕过服务端策略。
5. 没有合法 `next` 时使用 `/dashboard/`，社交登录 helper 的空 callback 也使用该默认值。
6. 登录发起时缓存立即失效；One Tap reload 或 OAuth 回跳产生新 document 后，signed-out 缓存不能阻止 AccountNav 首次 hydration revalidate；同 document 的站内 pathname 变化不会无条件重复请求。
7. Header 仍是带真实 href 和 `data-astro-reload` 的 anchor，点击登录直接执行整页导航；缓存清理不破坏复制链接和新标签页等原生行为。
8. Sensei 提供不依赖具体页面的通用登录保护方法。
9. 只有 401 触发登录；503、网络错误、离线请求失败、skipped 和非法响应不触发登录。
10. 显式用户动作忽略失败冷却和 `navigator.onLine` 短路，真实请求失败后才返回 unavailable。
11. 缺少可选 `sessionExpiresAt` 不会把已登录用户误判为 unavailable。
12. 生产退出只有在服务端成功后才改变本地状态；缺 token 时能尝试补种。DEV override 退出不发网络请求，并通过同一个通用封装关闭本地登录状态后 reload。
13. One Tap 不会在 `/api/me` 503 或网络失败时弹出。
14. `account-menu.json` 与 TypeScript 类型一致，删除 `tryFreeHref` 死代码，账户菜单 TS1360 消失。
15. 已提交的账户下拉菜单交互和样式不回退。
16. dev auth override 在本地仍可登录和退出，生产构建不可启用。
17. Customer Portal 通用客户端完成且有行为测试，但未接入 Pricing/支付按钮。
18. Portal 404 不被误判为未登录；Portal 不被描述为首次购买或 Checkout。
19. 本期不新增邮件登录、独立注册、多语言或 PayPal 动态 Portal。
20. Auth 相关测试通过；Sensei 本期新增行为测试通过；本期不新增 TypeScript 错误。

## 15. 后续独立事项

以下问题真实存在，但不进入本期开发计划：

- Auth `/api/me` 与 Billing 可用性解耦。
- 所有 `/api/me` 消费方对 `billing unavailable` 的显式 UI。
- Pricing 的购买、试用、Checkout 和 Manage Subscription 按钮语义。
- OAuth 后自动继续某个页面动作的恢复协议。
- PayPal 后续动态 Portal 能力。

## 16. 后续流程

1. 项目负责人审阅本文第六版。
2. 根据意见继续修订，直到设计获批。
3. 获批后重新读取两个仓库的最新代码与状态。
4. 再制定逐文件、逐测试的具体开发计划。
5. 开发计划再次确认后才修改业务代码。
6. Pricing 接入另开需求与分支。

本文获批不等于授权立即写代码；具体开发仍以之后确认的开发计划为准。

## 附录 A：两轮 Claude 审阅意见裁决摘要

| 编号 | 裁决 | 说明 |
| --- | --- | --- |
| 1 | Claude 已撤回；原设计正确 | 权威 Auth 的 sign-in.js 确实先检查会话并固定跳 Dashboard；第一轮结论来自内容不同的检出。 |
| 2 | 采纳 | 未列入白名单的现有页面会直接 400，应定为 P0。 |
| 3 | 部分采纳 | Auth 浏览器 safeNext 已完成结构校验；但 sign-in.js 仍需为已有会话回跳而修改。 |
| 4 | Claude 已撤回；按当前状态修订 | 第一版创建时相关文件未提交；现在已由 9cdc6b5c 提交，改为保护已提交基线。 |
| 5 | 采纳 | JSON 已移除字段，类型和死代码未同步；TS1360 已复现。 |
| 6 | Claude 已撤回；双方澄清 | Teddy 路径是另一份有效检出，不是笔误；本任务仍以 Silvia 的 dist 工作区和 SHA 为权威。 |
| 7 | 采纳 | fresh signed-out sessionStorage 会使 OAuth 回跳后页头最长 60 秒仍显示未登录。 |
| 8 | 采纳 | skipped、后台冷却和显式动作必须分别定义。 |
| 9 | 采纳 | 缺 CSRF cookie 时先 GET `/api/me` 补种，再决定是否 sign-out。 |
| 10 | 采纳 | 通用鉴权必须复用仅 DEV 生效的现有旁路。 |
| 11 | 采纳 | hash 字段和 hashchange 监听都需要补齐；不自动改写生产登录域名。 |
| 12 | 采纳 | 浏览器可安全降级；Auth 服务端必须保持 400 fail-closed。 |
| 13 | 双方修正后采纳 | 使用结构校验 + 保留命名空间 deny-list + 必要的精确 Auth 例外，不能粗暴禁止全部 `/auth/*`。 |
| 14 | 采纳 | `/api/me` Billing 解耦影响面被低估，因此移到独立需求。 |
| 15 | 采纳 | Portal 客户端保持纯；缓存失效和登录跳转由调用方负责。 |
| 16 | 采纳 | 登录安全默认值统一 `/dashboard/`，另说明无尾斜杠兼容入口。 |
| 17 | 采纳 | Sensei 需要真实行为测试策略，不能用源码正则验证 HTTP 分支。 |
| 18 | Claude 第二轮接受不采纳 | 用户已明确要求本期先做通用 Customer Portal 方法、Pricing 后续调用；保留交付并补充 expiresAt 语义及无副作用边界。 |
| 19 | 采纳 | resume 只保留技术事实，不提前规定参数和协议。 |
| 20 | 采纳 | `/api/me` Billing 解耦移出本期，保留为独立后续事项。 |
| 21 | 采纳 | 测试改用当前真实页面和明确拒绝向量。 |

## 附录 B：本设计作者在各轮审阅中确认的错误

以下是第一版设计或第二版表述中属于本文作者的错误，而不是 Claude 的误判：

1. 第一版把 Auth `/api/me` 与 Billing 解耦列入本期，低估了 Dashboard、桌面端、Service Binding、OpenAPI 和测试的影响面；第三版已移到独立后续事项。
2. 第一版没有识别未列入白名单的现有页面会直接 400，也没有把它定为 P0。
3. 第一版遗漏 OAuth 返回后的 60 秒未登录缓存、`skipped`、CSRF 补种、dev override 和 `hashchange`。
4. 第一版把已经移除的 `tryFree` / `register` 配置写成待办，没有指出真正的类型错误和死变量。
5. 第一版混淆了浏览器非法 `next` 的安全降级与服务端 callback 的 fail-closed。
6. 第一版未说明结构校验替换业务白名单后的站内认证钓鱼取舍，也未保留遗留账户流程的精确例外。
7. 第一版提出了过早的 `resume` 具体协议，并给 Sensei 列出无法落地的 Node 源码测试方案。
8. 第二版把 `menuConfig.ts` 列为预计修改文件；实际只需由 `types.ts` 修正后重新通过其类型约束，不需要修改该文件。

第三版新引入或仍未闭环、已由第四版开始纠正并在第五版继续收敛的错误：

1. 把保留命名空间 deny-list 只放在服务端，遗漏了已有会话和其他浏览器 `location.href` 导航不会经过服务端 callback 校验。
2. 精确例外只列出 Legacy Claim complete，遗漏了 Desktop 设备登录使用的 `/auth/desktop?...`，也没有定义 pathname、query 和 hash 的匹配边界。
3. 登录缓存方案过度依赖 Sensei 主动调用 `redirectToSignIn()`，没有覆盖 One Tap reload 和其他非 Sensei 发起的会话变化。
4. 401 状态矩阵同时要求写 signed-out 缓存和立即清缓存，未区分后台 revalidate 与显式受保护动作。
5. 把可选的 `sessionExpiresAt` 当作 200 响应的必填有效性条件。
6. 把 `navigator.onLine === false` 当作显式用户动作的硬短路，而不是只作为后台刷新优化。
7. 没有先盘点旧 allow-list 中 `/api/` 的历史依赖，也遗漏 `public/auth/app.js` 等可能修改文件。
8. 实施优先级错误地嵌在测试策略章节内，部分测试向量和尾斜杠验收条件不够精确。

以下属于 Claude 第一轮的判定错误，且已在第二轮由 Claude 自行撤回或修正：

1. 认为权威 Auth 登录页已经先解析 `next`，从而断言已有会话回跳问题不存在。
2. 因 `safeNext()` 已完成而推导 `public/auth/sign-in.js` 不需修改；该文件仍需调整初始化顺序。
3. 把第一版成文时真实存在的未提交改动判成事实错误。
4. 把另一台开发机的绝对路径差异判成原设计路径错误。
5. 最初建议无例外地拒绝全部 `/auth/*`，遗漏 `/auth/legacy-claim/complete` 的现有合法流程。
6. 建议移除用户已经明确要求的 Customer Portal 通用客户端，越过了既定产品范围。

## 附录 C：Claude 第三轮新增意见裁决

| 编号 | 裁决 | 核对结果与修订 |
| --- | --- | --- |
| 1 | 采纳 | v3 只在服务端定义 deny-list，已登录用户的客户端 `location.href` 可绕过。v4 增加浏览器导航策略 helper，并覆盖最终消费不可信 `next` 的页面。 |
| 2 | 采纳并补充 | v3 例外盘点不全。除 `/auth/legacy-claim/complete` 外，Desktop OAuth 需要 pathname 精确为 `/auth/desktop` 且携带 query。Legacy Claim 的 sign-in/verify-email 是服务端生成中转，不作为任意 callback 例外。 |
| 2A | 采纳并在 v6 收敛 | One Tap reload 不经过 `redirectToSignIn()`。signed-out 缓存可用于水合，但不能阻止每个新 document 的首次 hydration revalidate；由于 AccountNav 持久化，站内 pathname 变化不无条件重复请求。 |
| 3 | 采纳 | 后台 revalidate 的 401 可以写 signed-out；显式 authFlow 的 401 不写 false，直接清旧缓存并跳登录。 |
| 4 | 采纳 | `sessionExpiresAt` 在 Sensei 类型中可选；缺失使用普通 TTL，只有存在但非法才判 invalid response。 |
| 5 | 采纳 | `navigator.onLine` 只可用于后台优化，显式用户动作必须真实发请求。 |
| 6 | 采纳 | 当前未发现 `/api/*` callback 依赖，设备 authorize 不是 callback；但开发前必须重新盘点再收紧。 |
| 7 | 采纳 | 拒绝向量修正为实际的 `/\evil.example`。 |
| 8 | 采纳 | 同时测试 `/pricing` 与 `/pricing/`，并验证规范化后 query/hash 保留。 |
| 9 | 采纳 | `public/auth/app.js` 加入预计修改范围，用于默认 callback、浏览器 helper 及必要时的 `newUserCallbackURL`。 |
| 10 | 采纳 | 实施优先级与测试策略拆成独立章节，标题层级已修正。 |

## 附录 D：Claude 第四轮复核意见裁决

| 编号 | 裁决 | 权威工作区核对结果与第五版动作 |
| --- | --- | --- |
| 1 | 采纳并收窄信任边界 | `legacy-claim-start.js` 确实直接导航服务端返回值。只把 `/auth/legacy-claim/start` 的三种固定输出定义为专用可信契约，并以路由测试固定路径、嵌套 next 和 email 编码；不把所有 API 返回的 `next` 一般化为可信。该文件加入已盘点但预计不修改清单。 |
| 2 | 采纳建议方案 | Desktop 回跳策略只检查精确 pathname、无 hash、四个必需键存在且非空；loopback/PKCE 语义继续由现有 `desktop.js` 和 `/api/auth/device/authorize` 校验，避免第三份实现漂移。 |
| 3 | 采纳 | 把浏览器和服务端共同规则提到 §5.1，两个执行环境引用同一规范和测试向量，不再各自用含糊措辞复述。 |
| 4 | 部分采纳并纠正机制 | View Transitions 和同 document swap 的判断成立；但 AccountNav 标记了 `transition:persist`，不能描述为每次 swap 后重新挂载。第五版改为 signed-out 缓存永不跳过初次 hydration 或 pathname 变化触发的 revalidate。 |
| 5 | 采纳 | 验收标准补回“离线请求失败不触发登录”。显式动作仍真实尝试请求，失败后归 unavailable。 |
| 6 | 采纳目的，调整编号 | 原审阅意见本身没有给缓存项编号。使用 `2A`，既方便引用，也保留后续 3–10 与原意见的编号对应。 |

## 附录 E：Claude 第五轮复核意见裁决

| 编号 | 裁决 | 权威工作区核对结果与第六版动作 |
| --- | --- | --- |
| 1 | 部分采纳，严重度下调 | 当前 Astro 5.16.6 确实会拦截生产同源登录 anchor；但其 loader 发现 Auth 文档没有 `astro-view-transitions-enabled` 后会 `preventDefault()` 并回退到 `location.href`，不会把 Auth HTML swap 进 Sensei。仍为登录 anchor 增加 `data-astro-reload`，避免重复 fetch 并明确整页导航，不把它定为现存 P0/P1 功能故障。 |
| 2 | 采纳请求量问题，不采纳短 TTL | 每次 pathname 变化强制请求会让匿名流量随 PV 增长。第六版只要求每个新 document 的首次 hydration revalidate；OAuth 和 One Tap 都被覆盖。同 document 的持久化 AccountNav 不重复强制请求，也不新增没有当前需求支撑的 5–10 秒 TTL。 |
| 3 | 采纳 | 删除 §5.2 对 Legacy Claim 中转规则的重复段落，保留来源分类第 2 条作为唯一规范。 |
| 4 | 采纳 | 删除会随文档提交立即过期的 Sensei HEAD；业务代码核对基线改为最后实际修改登录调用链的 `9cdc6b5c`。 |
