# Linkjob 与 Auth 登录集成升级 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让 Linkjob 任意合法英文站内页面的 Google/GitHub 登录安全回到原 pathname、query 和 hash，并交付可复用登录保护与 Customer Portal 客户端，同时修复缓存、退出和 One Tap 状态错误。

**Architecture:** Auth 继续作为会话与 callback 的最终安全边界：浏览器和服务端执行等价的站内回跳规则，服务端非法 callback 保持 400。Linkjob 只通过 `/api/me` 判断会话，session 层负责状态分类与缓存，`authFlow.ts` 负责通用登录跳转，`customerPortal.ts` 保持纯数据客户端；AccountNav 只负责 UI 编排。

**Tech Stack:** Astro 5.16.6、React 18、TypeScript 5.6、Node 内置测试、Cloudflare Workers、Hono、Better Auth 1.6.17、Vitest 4。

**Spec:** `docs/2026-09-20-auth-integration-design.md`

## Global Constraints

- 开始每个仓库的实现前，重新记录分支、HEAD 和 `git status --short`；不得覆盖用户已有改动。
- Linkjob 权威仓库：`/Users/silvia/Documents/dist/linkjob`；Auth 权威仓库：`/Users/silvia/Documents/dist/auth`。
- 只支持 Google、GitHub 和 Google One Tap；不新增邮件登录/注册产品能力。
- 不修改 Pricing、套餐/支付按钮、Checkout、新购订阅或 PayPal Portal。
- 不修改 Auth `/api/me` 的 Billing 契约；该解耦保持后续独立事项。
- 不新增测试框架、浏览器测试框架或运行时依赖；Auth 使用现有 Vitest，Linkjob 使用现有 Node 测试脚本。Linkjob 必须把测试加载器直接导入的 `esbuild` 显式声明为 devDependency，并提交对应 lockfile 变更，禁止依赖 Astro/Vite 偶然提升的传递依赖。
- Linkjob 不修改 `src/config/account-menu.json`；只修正其 TypeScript 类型和死代码。
- 保留提交 `9cdc6b5c` 已完成的账户菜单样式、hover/focus 下拉逻辑和头像尺寸。
- 浏览器非法 `next` 安全降级到 `/dashboard/`；Auth 服务端非法 callback 必须返回 `400 INVALID_CALLBACK_URL`。
- 只有明确 HTTP 401 表示未登录；503、网络失败、离线、`skipped` 和非法响应不得触发登录。
- `sessionExpiresAt` 缺失仍是有效登录响应；存在但无法解析才是非法响应。
- Linkjob TypeScript 基线已有 7 个错误：2 个 i18n locale、3 个 Cloudflare 全局类型、1 个正则 target、1 个账户菜单 TS1360。本期必须消除 TS1360，其他 6 个不得增加或改变。
- Auth 当前基线：相关 5 个测试文件 41 项通过，`npm run build` 通过。
- 每个任务只提交本任务文件；两个仓库分别提交，禁止跨仓库拼成一个 Git 提交。

## Review Focus

- 编码、反斜杠或协议相对形式伪装成 `/auth/*`、`/api/*` 时，两侧都必须拒绝；Task 1 的共享向量覆盖。
- 已有会话访问登录页时，合法 `next` 必须生效，恶意 `next` 必须降级；Task 2 的手工浏览器检查覆盖。
- `/api/me` 503、网络失败、离线和非法 JSON 必须保持 unavailable/unknown，不能显示成 signed out 或跳登录；Task 4 的行为测试覆盖。
- OAuth/One Tap 整页返回后，即使 sessionStorage 中有 fresh signed-out，也必须首次 revalidate；同 document 的 Astro pathname 变化不能按 PV 重复请求；Task 5 覆盖。
- 退出登录缺 CSRF cookie 时必须先补种，且 403/503/网络失败不能清缓存或导航；DEV override 退出必须关闭本地开关且不发 fetch。Task 6 覆盖。

---

### Task 1: Auth 浏览器与服务端统一回跳策略

**Repository:** `/Users/silvia/Documents/dist/auth`

**Files:**
- Modify: `public/auth/app.js:1-105`
- Modify: `src/auth/index.ts:59-95`
- Modify: `tests/safe-next.test.ts`
- Modify: `tests/allowed-next.test.ts`

**Interfaces:**
- Consumes: 现有 `safeNext(raw): string | null` 结构校验。
- Produces: `safeAuthNavigationNext(raw): string | null`；更新后的 `isAllowedNext(path): boolean`。
- Invariant: 两个函数对同一组相对路径给出等价允许/拒绝结论；区别只在调用方的失败行为。

- [ ] **Step 1: 重新盘点现有 callback/next 目标**

```bash
graft grep "callbackURL"
graft grep "newUserCallbackURL"
graft grep "redirectTo"
rg -n 'callbackURL|newUserCallbackURL|redirectTo|next=' public src tests
```

Expected: `/api/auth/device/authorize` 只是 POST 接口；没有合法 `/api/*` callback。合法 Auth 内部目标只有设计文档列出的 Legacy Claim complete 和 Desktop self-next；若结果不同，停止 Task 1 并先更新设计与本计划。

- [ ] **Step 2: 在现有测试中加入统一策略的失败向量**

在 `tests/allowed-next.test.ts` 同时导入浏览器和服务端函数，使用一组小型共享数组，不新增 fixture 文件：

```ts
// @ts-expect-error — plain browser JS module.
import { safeAuthNavigationNext } from "../public/auth/app.js";
import { isAllowedNext } from "../src/auth";

const accepted = [
  "/",
  "/pricing/?source=header#plans",
  "/pricing?source=header#plans",
  "/interview-copilot",
  "/auth/legacy-claim/complete",
  "/auth/desktop?redirect_uri=http%3A%2F%2F127.0.0.1%3A4567%2Fcallback&code_challenge=x&state=y&device_id=z",
  "/" + "a".repeat(2047), // total length 2048
];
const rejected = [
  "//evil.example",
  "/\\evil.example",
  "/api/me",
  "/auth/sign-in?error=session+expired",
  "/%61uth/sign-in",
  "/auth/legacy-claim/complete?unexpected=1",
  "/auth/desktop?redirect_uri=x&code_challenge=y&state=z",
  "/" + "a".repeat(2048), // total length 2049
];

it("keeps browser and server redirect policies equivalent", () => {
  for (const path of accepted) {
    expect(safeAuthNavigationNext(path)).toBe(path);
    expect(isAllowedNext(path)).toBe(true);
  }
  for (const path of rejected) {
    expect(safeAuthNavigationNext(path)).toBeNull();
    expect(isAllowedNext(path)).toBe(false);
  }
});
```

明确重写 `tests/allowed-next.test.ts` 的旧 allow-list 断言：

- 删除 `accepts whitelisted top-level prefixes` 整组；新策略允许除保留前缀外的任意结构合法站内路径。
- 删除 `rejects paths that don't match a whitelisted prefix` 整组；其中 `/random/path`、`/zhabc`、`/jacuzzi` 在新策略下必须允许。
- 保留并继续断言协议相对路径、反斜杠注入、无前导 `/` 和空串。把旧 query/hash 组中的 `/notallowed?x=/zh/` 拒绝断言删除或改为允许，并用 `/auth/sign-in?next=/pricing` 仍被拒绝来证明 query/hash 不得绕过保留前缀策略。

保留 `tests/safe-next.test.ts` 现有纯结构测试；不要把 `safeNext()` 改成业务策略函数。共享数组中的 2048/2049 两个向量必须同时约束浏览器和服务端长度边界。

- [ ] **Step 3: 运行测试并确认当前实现失败**

Run:

```bash
npm test -- --run tests/safe-next.test.ts tests/allowed-next.test.ts
```

Expected: FAIL，因为 `safeAuthNavigationNext` 尚不存在，且当前服务端仍允许整个 `/auth/`、`/api/`。

- [ ] **Step 4: 在浏览器 helper 中实现最小导航策略**

在 `public/auth/app.js` 的 `safeNext()` 后新增纯函数。使用固定解析 origin，避免测试依赖 DOM：

```js
const RESERVED_NEXT_PREFIXES = ["/auth", "/api"];
const DESKTOP_NEXT_KEYS = ["redirect_uri", "code_challenge", "state", "device_id"];

function decodedPathname(url) {
  try {
    return decodeURIComponent(url.pathname);
  } catch {
    return null;
  }
}

export function safeAuthNavigationNext(raw) {
  const next = safeNext(raw);
  if (!next) return null;

  const url = new URL(next, "https://www.senseiai.me");
  const pathname = decodedPathname(url);
  if (!pathname) return null;

  const reserved = RESERVED_NEXT_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
  if (!reserved) return next;

  if (next === "/auth/legacy-claim/complete") return next;
  if (pathname !== "/auth/desktop" || url.hash) return null;
  return DESKTOP_NEXT_KEYS.every((key) => Boolean(url.searchParams.get(key)))
    ? next
    : null;
}
```

不要在此复制 Desktop loopback 或 PKCE 格式校验。

- [ ] **Step 5: 在服务端实现等价策略**

在 `src/auth/index.ts` 删除 `ALLOWED_NEXT_PREFIXES`，保留结构校验并按相同规则解析 pathname。函数仍只接收相对路径；绝对 URL 继续由 Better Auth trusted origin 处理：

```ts
const RESERVED_NEXT_PREFIXES = ["/auth", "/api"] as const;
const DESKTOP_NEXT_KEYS = ["redirect_uri", "code_challenge", "state", "device_id"] as const;
const MAX_NEXT_LENGTH = 2048;

export function isAllowedNext(path: string): boolean {
  if (!path.startsWith("/") || path.startsWith("//") || path.includes("\\") || path.length > MAX_NEXT_LENGTH) {
    return false;
  }
  let url: URL;
  let pathname: string;
  try {
    url = new URL(path, "https://www.senseiai.me");
    pathname = decodeURIComponent(url.pathname);
  } catch {
    return false;
  }
  const reserved = RESERVED_NEXT_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
  if (!reserved) return true;
  if (path === "/auth/legacy-claim/complete") return true;
  return pathname === "/auth/desktop" && !url.hash &&
    DESKTOP_NEXT_KEYS.every((key) => Boolean(url.searchParams.get(key)));
}
```

- [ ] **Step 6: 运行定向测试和 Auth 类型检查**

Run:

```bash
npm test -- --run tests/safe-next.test.ts tests/allowed-next.test.ts
npm run build
```

Expected: 两个测试文件全部 PASS；`tsc --noEmit` exit 0。

- [ ] **Step 7: 提交 Auth 策略变更**

```bash
git add public/auth/app.js src/auth/index.ts tests/safe-next.test.ts tests/allowed-next.test.ts
git commit -m "fix: unify auth redirect policy"
```

---

### Task 2: Auth 登录页面消费统一安全目标

**Repository:** `/Users/silvia/Documents/dist/auth`

**Files:**
- Modify: `public/auth/app.js:212-220`
- Modify: `public/auth/sign-in.js:1-50`
- Modify: `public/auth/index.js:1-25`
- Modify: `public/auth/desktop.js:1-40`
- Modify: `public/auth/register.js:1-55`
- Modify: `public/auth/verify-email.js:1-42`
- Modify: `public/auth/forgot-password.js:1-65`
- Modify: `tests/legacy-claim-route.test.ts`

**Interfaces:**
- Consumes: Task 1 的 `safeAuthNavigationNext()`。
- Produces: 所有浏览器输入 `next` 的最终导航都通过统一策略；`signInWithSocial()` 空 callback 默认 `/dashboard/`。
- Behavior change: `register.js` 的已有会话分支从固定 `/dashboard/` 改为安全的 `redirectTarget`，这是 Legacy Claim 回到 `/auth/legacy-claim/complete` 的必要行为。
- Does not change: 不新增邮件登录/注册产品能力；除上述 Legacy Claim 必需跳转外，只做共享安全策略接线。

- [ ] **Step 1: 扩充 Legacy Claim 路由契约测试**

在 `tests/legacy-claim-route.test.ts` 增加一个测试，分别调用 `handlers.start()` 的三种 session 状态并断言：

```ts
expect(verifiedBody.next).toBe("/auth/legacy-claim/complete");
expect(unverifiedBody.next).toBe(
  "/auth/verify-email?email=buyer%2Bclaim%40example.com&next=%2Fauth%2Flegacy-claim%2Fcomplete",
);
expect(anonymousBody.next).toBe(
  "/auth/sign-in?next=%2Fauth%2Flegacy-claim%2Fcomplete",
);
```

复用现有 `billingReturning()` 和 CSRF request helper，不新增浏览器测试。

- [ ] **Step 2: 运行契约测试并确认缺少分支覆盖**

Run:

```bash
npm test -- --run tests/legacy-claim-route.test.ts
```

Expected: 新断言在测试代码完成前失败；完成三种 handler 调用后应反映当前固定契约。

- [ ] **Step 3: 统一页面输入解析并修正登录初始化顺序**

机械替换各页面从 query 读取的 `safeNext(...)` 为 `safeAuthNavigationNext(...)`。`sign-in.js` 和 `register.js` 都必须先得到目标，再检查已有会话。

以下片段只用于 `sign-in.js`；referrer fallback 仍仅属于登录页：

```js
const explicitNext = safeAuthNavigationNext(
  new URLSearchParams(location.search).get("next"),
);
const structuralReferrer = safeReferrerNext(document.referrer, location.origin);
const referrerNext = safeAuthNavigationNext(structuralReferrer);
// 保留现有仅 downloads/dashboard 接受 referrer 的限制。
const referrerPath = referrerNext?.split(/[?#]/, 1)[0];
const next = explicitNext || (
  referrerPath === "/downloads" ||
  referrerPath?.startsWith("/downloads/") ||
  referrerPath === "/dashboard" ||
  referrerPath?.startsWith("/dashboard/")
    ? referrerNext
    : null
);
const redirectTarget = next || "/dashboard/";

try {
  const meRes = await fetch("/api/me", { credentials: "include" });
  if (meRes.ok && (await meRes.json())?.authenticated) {
    location.href = redirectTarget;
  }
} catch {
  // 继续显示登录页
}
```

`register.js` 不引入 `safeReferrerNext` 或任何 referrer fallback。它只把 query helper 替换为统一策略，并在已有会话检查前计算目标：

```js
const next = safeAuthNavigationNext(
  new URLSearchParams(location.search).get("next"),
);
const redirectTarget = next || "/dashboard/";
```

已有会话时，`sign-in.js` 和 `register.js` 都使用各自的 `redirectTarget`，不再固定 Dashboard。register 的改动只保证 Legacy Claim 的既有内部流程，不扩展注册产品。`index.js`、`verify-email.js`、`forgot-password.js` 只更换 helper；不要改邮件文案、表单或接口。

- [ ] **Step 4: 修正 Desktop self-next 和社交登录默认值**

`desktop.js` 使用精确例外：

```js
const selfNext = location.pathname + location.search;
const returnTo = safeAuthNavigationNext(selfNext) || "/dashboard/";
location.href = `/auth/sign-in?next=${encodeURIComponent(returnTo)}`;
```

`app.js` 的社交登录 body 改为：

```js
callbackURL: callbackURL || "/dashboard/",
```

Better Auth 1.6.17 的 OAuth callback 对首次用户执行 `newUserURL || callbackURL`，因此不额外发送 `newUserCallbackURL`。

- [ ] **Step 5: 运行 Auth 回跳相关测试与构建**

Run:

```bash
npm test -- --run tests/safe-next.test.ts tests/allowed-next.test.ts tests/legacy-claim-route.test.ts tests/device.test.ts tests/device-handlers.test.ts
npm run build
```

Expected: 5 个测试文件全部 PASS；Auth build exit 0。

- [ ] **Step 6: 手工验证已有会话与 OAuth 请求目标**

使用本地 Auth：

```bash
npm run dev
```

验证：

1. 已有会话打开 `/auth/sign-in?next=%2Fpricing%2F%3Fsource%3Dheader%23plans`，跳转到该目标。
2. 已有会话打开 `/auth/sign-in?next=%2Fauth%2Fsign-in%3Ferror%3Dfake`，跳 `/dashboard/`。
3. Google/GitHub 发起请求的 JSON `callbackURL` 是同一个 `redirectTarget`。
4. 使用新 OAuth 用户完成一次集成检查，确认 Better Auth 仍回 `callbackURL`。

同时验证服务端保持 fail-closed（本地 Turnstile 未启用时直接执行；启用时使用测试环境合法 token）：

```bash
curl -i -X POST http://127.0.0.1:8787/api/auth/sign-in/social \
  -H 'Content-Type: application/json' \
  --data '{"provider":"google","callbackURL":"/auth/sign-in?error=fake"}'
```

Expected: `400`，JSON code 为 `INVALID_CALLBACK_URL`，而不是静默改写到 Dashboard。

- [ ] **Step 7: 提交 Auth 页面接线**

```bash
git add public/auth/app.js public/auth/sign-in.js public/auth/index.js public/auth/desktop.js public/auth/register.js public/auth/verify-email.js public/auth/forgot-password.js tests/legacy-claim-route.test.ts
git commit -m "fix: preserve safe login return targets"
```

---

### Task 3: Auth One Tap 只在明确 401 时展示

**Repository:** `/Users/silvia/Documents/dist/auth`

**Files:**
- Modify: `public/auth/one-tap.js:24-75`
- Create: `tests/one-tap.test.ts`

**Interfaces:**
- Produces: `shouldOfferOneTap(): Promise<boolean>`；仅 `/api/me` 401 返回 true。
- Preserves: Auth 自己的 24 小时 dismissed cooldown。

- [ ] **Step 1: 写主路径和关键失败路径测试**

```ts
import { afterEach, describe, expect, it, vi } from "vitest";
// @ts-expect-error — plain browser JS module.
import { shouldOfferOneTap } from "../public/auth/one-tap.js";

afterEach(() => vi.unstubAllGlobals());

describe("shouldOfferOneTap", () => {
  it("offers only for an explicit 401", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({ status: 401 })));
    await expect(shouldOfferOneTap()).resolves.toBe(true);
  });

  it("stays quiet for service and network failures", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({ status: 503 })));
    await expect(shouldOfferOneTap()).resolves.toBe(false);
    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("offline"); }));
    await expect(shouldOfferOneTap()).resolves.toBe(false);
  });
});
```

- [ ] **Step 2: 运行测试并确认失败**

```bash
npm test -- --run tests/one-tap.test.ts
```

Expected: FAIL，因为导出函数尚不存在且当前 503/network 会继续 One Tap。

- [ ] **Step 3: 实现最小状态门**

```js
export async function shouldOfferOneTap() {
  try {
    const response = await fetch("/api/me", { credentials: "include" });
    return response.status === 401;
  } catch {
    return false;
  }
}

export async function runOneTap() {
  if (!(await shouldOfferOneTap())) return;
  // 通过状态门后逐行保留 dismissedAt 检查、public config、GSI 初始化和 prompt callback。
}
```

- [ ] **Step 4: 运行测试和构建**

```bash
npm test -- --run tests/one-tap.test.ts
npm run build
```

Expected: PASS；build exit 0。

- [ ] **Step 5: 提交 Auth One Tap 修复**

```bash
git add public/auth/one-tap.js tests/one-tap.test.ts
git commit -m "fix: gate one tap on explicit signed-out status"
```

---

### Task 4: Linkjob session 状态分类与账户类型收敛

**Repository:** `/Users/silvia/Documents/dist/linkjob`

**Files:**
- Modify: `src/lib/account/types.ts`
- Modify: `src/lib/account/session.ts`
- Create: `scripts/account-auth.test.mjs`
- Modify: `package.json`
- Modify: `package-lock.json`

**Interfaces:**
- Produces: `checkMe({ force?: boolean }): Promise<MeCheckResult>`，无缓存写副作用。
- Produces: `revalidateMe(): Promise<MeRevalidateResult>`，只供后台 UI 刷新并负责缓存。
- `MeCheckResult`: authenticated、unauthorized、unavailable、invalidResponse、skipped。
- Removes: `AccountMenuConfig.buttons.tryFree`、`AccountMenuConfig.links.register`。

- [ ] **Step 1: 显式声明构建工具并建立行为测试加载器**

先把当前被 Astro/Vite 传递依赖提升的 esbuild 变成 Linkjob 自己声明的开发依赖：

```bash
npm install --save-dev esbuild@0.25.11
```

Expected: `package.json` 的 `devDependencies` 出现 `esbuild`，`package-lock.json` 同步更新；不增加运行时依赖或测试框架。执行后运行 `git diff --stat -- package-lock.json` 并检查 `git diff -- package-lock.json`，确认只有 esbuild 直接声明所需的条目。若 lockfile 出现与 esbuild 无关的大范围重排，撤销这次命令对 `package.json`、`package-lock.json` 的修改，手工只添加 `devDependencies.esbuild`，再运行 `npm install --package-lock-only` 生成最小 lockfile 变更并重新检查 diff。

在 `scripts/account-auth.test.mjs` 使用已安装的 esbuild 把被测 TypeScript 临时 bundle 到内存；不写生成文件：

```js
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { resolve } from "node:path";
import test from "node:test";
import { build } from "esbuild";

async function loadAccountModule(entry, { dev = false } = {}) {
  const result = await build({
    entryPoints: [entry],
    bundle: true,
    format: "esm",
    platform: "browser",
    write: false,
    alias: { "@": resolve("src") },
    define: {
      "import.meta.env.DEV": JSON.stringify(dev),
      "import.meta.env.PUBLIC_ACCOUNT_DEV_AUTH": "undefined",
      "import.meta.env.PUBLIC_ACCOUNT_DEV_USER": "undefined",
    },
  });
  const source = result.outputFiles[0].text;
  return import(`data:text/javascript;base64,${Buffer.from(source).toString("base64")}#${randomUUID()}`);
}

function makeStorage(seed = {}) {
  const values = new Map(Object.entries(seed));
  const removed = [];
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: (key) => {
      removed.push(key);
      values.delete(key);
    },
    removed,
  };
}

function installBrowser({ onLine = true, sessionSeed = {} } = {}) {
  const sessionStorage = makeStorage(sessionSeed);
  Object.defineProperty(globalThis, "navigator", {
    value: { onLine },
    configurable: true,
  });
  globalThis.window = {
    localStorage: makeStorage(),
    sessionStorage,
    location: {
      origin: "https://www.senseiai.me",
      pathname: "/pricing/",
      search: "?source=header",
      hash: "#plans",
    },
  };
  return { sessionStorage };
}

const jsonResponse = (status, body) => new Response(JSON.stringify(body), {
  status,
  headers: { "Content-Type": "application/json" },
});
```

在 `package.json` 增加脚本：

```json
"test:account": "node --test scripts/account-nav-dropdown.test.mjs scripts/account-auth.test.mjs"
```

- [ ] **Step 2: 写 session 主路径和失败分类测试**

使用简单内存 storage stub，测试以下两个行为：

```js
test("checkMe accepts authenticated responses without sessionExpiresAt", async () => {
  Object.defineProperty(globalThis, "navigator", {
    value: { onLine: true },
    configurable: true,
  });
  globalThis.fetch = async () => ({
    status: 200,
    ok: true,
    json: async () => ({ authenticated: true, user: { id: "u1", email: "u@example.com" } }),
  });
  const { checkMe } = await loadAccountModule("src/lib/account/session.ts");
  assert.equal((await checkMe({ force: true })).kind, "authenticated");
});

test("checkMe separates 401, 503, invalid payload, and forced offline attempts", async () => {
  installBrowser();
  globalThis.fetch = async () => jsonResponse(401, { authenticated: false });
  let session = await loadAccountModule("src/lib/account/session.ts");
  assert.deepEqual(await session.checkMe({ force: true }), { kind: "unauthorized" });

  installBrowser();
  globalThis.fetch = async () => jsonResponse(503, { code: "BILLING_UNAVAILABLE" });
  session = await loadAccountModule("src/lib/account/session.ts");
  assert.deepEqual(await session.checkMe({ force: true }), {
    kind: "unavailable",
    status: 503,
  });

  installBrowser();
  globalThis.fetch = async () => jsonResponse(200, { authenticated: true, user: {} });
  session = await loadAccountModule("src/lib/account/session.ts");
  assert.deepEqual(await session.checkMe({ force: true }), { kind: "invalidResponse" });

  installBrowser({ onLine: false });
  let calls = 0;
  globalThis.fetch = async () => {
    calls += 1;
    return jsonResponse(401, { authenticated: false });
  };
  session = await loadAccountModule("src/lib/account/session.ts");
  assert.equal((await session.checkMe({ force: true })).kind, "unauthorized");
  assert.equal(calls, 1);
});
```

第二个测试中依次加载新 bundle，避免模块级 cooldown 状态串扰。

- [ ] **Step 3: 运行测试并确认失败**

```bash
npm run test:account
```

Expected: 新测试 FAIL，因为 `checkMe` 尚不存在；原下拉菜单测试仍 PASS。

- [ ] **Step 4: 收敛类型和运行时响应校验**

把 `isAuthedMeResponse` 改为接受 `unknown` 并验证必需字段：

```ts
export const isAuthedMeResponse = (value: unknown): value is MeResponseAuthed => {
  if (!value || typeof value !== "object") return false;
  const resp = value as Partial<MeResponseAuthed>;
  if (resp.authenticated !== true) return false;
  if (!resp.user || typeof resp.user.id !== "string" || typeof resp.user.email !== "string") return false;
  return resp.sessionExpiresAt === undefined || Number.isFinite(Date.parse(resp.sessionExpiresAt));
};
```

删除 `AccountMenuConfig` 中已经不存在的 `tryFree` 和 `register` 字段。

- [ ] **Step 5: 分离无副作用检查和后台 revalidate**

在 `session.ts` 定义：

```ts
export type MeCheckResult =
  | { kind: "authenticated"; data: MeResponseAuthed }
  | { kind: "unauthorized" }
  | { kind: "unavailable"; status?: number }
  | { kind: "invalidResponse" }
  | { kind: "skipped" };

export const checkMe = async (
  { force = false }: { force?: boolean } = {},
): Promise<MeCheckResult> => {
  const devAuth = readDevAuth();
  if (devAuth) {
    if (!devAuth.enabled) return { kind: "unauthorized" };
    return {
      kind: "authenticated",
      data: {
        authenticated: true,
        user: devAuth.user,
        sessionExpiresAt: new Date(Date.now() + 24 * 60 * 60_000).toISOString(),
      },
    };
  }
  if (!force && (isOffline() || isInFailCooldown())) return { kind: "skipped" };

  const result = await fetchMeDeduped();
  if (result.kind === "unauthorized") return result;
  if (result.kind === "unavailable") {
    markMeFail();
    return result;
  }
  return isAuthedMeResponse(result.data)
    ? { kind: "authenticated", data: result.data }
    : { kind: "invalidResponse" };
};
```

同时把底层结果改为：

```ts
type MeFetchResult =
  | { kind: "unauthorized" }
  | { kind: "ok"; data: unknown }
  | { kind: "unavailable"; status?: number };
```

`fetchMeDeduped()` 对 401 返回 unauthorized；其他非 2xx 返回 unavailable(status)；JSON 解析或网络失败返回 unavailable（无 status）。

`revalidateMe()` 调用 `checkMe()`：authenticated 写已登录缓存；unauthorized 写 signed-out；unavailable、invalidResponse、skipped 都不覆盖缓存。保留现有 in-flight 去重。

- [ ] **Step 6: 运行账户测试和 TypeScript 基线对比**

```bash
npm run test:account
./node_modules/.bin/tsc --noEmit --incremental false
```

Expected:

- Node tests PASS。
- TS1360 消失。
- 命令仍因 6 个历史错误 exit 2：2 个 locale、3 个 Cloudflare 全局类型、1 个 regex target；不得出现新的 account 文件错误。

- [ ] **Step 7: 提交 Linkjob session 基础**

```bash
git add src/lib/account/types.ts src/lib/account/session.ts scripts/account-auth.test.mjs package.json package-lock.json
git commit -m "refactor: separate account session checks"
```

---

### Task 5: Linkjob 通用登录保护、完整回跳和缓存刷新

**Repository:** `/Users/silvia/Documents/dist/linkjob`

**Files:**
- Create: `src/lib/account/authFlow.ts`
- Modify: `src/lib/account/constants.ts`
- Modify: `src/layouts/helpers/AccountNav.tsx`
- Modify: `scripts/account-auth.test.mjs`
- Modify: `scripts/account-nav-dropdown.test.mjs`

**Interfaces:**
- Consumes: Task 4 的 `checkMe({ force: true })` 和 `clearMeCache()`。
- Produces: `currentReturnTo()`、`buildSignInUrl(returnTo?)`、`redirectToSignIn(returnTo?)`、`requireAuthenticated(options?)`。
- `AuthGateResult`: authenticated、redirecting、unavailable。

- [ ] **Step 1: 写 URL、401 和缓存刷新行为测试**

在 `scripts/account-auth.test.mjs` 增加：

```js
test("buildSignInUrl preserves pathname, query, and hash", async () => {
  installBrowser();
  const { currentReturnTo, buildSignInUrl } = await loadAccountModule("src/lib/account/authFlow.ts");
  assert.equal(currentReturnTo(), "/pricing/?source=header#plans");
  assert.equal(
    new URL(buildSignInUrl()).searchParams.get("next"),
    "/pricing/?source=header#plans",
  );
  assert.equal(
    new URL(buildSignInUrl("/%61uth/sign-in")).searchParams.get("next"),
    "/dashboard/",
  );
  assert.equal(
    new URL(buildSignInUrl("/" + "a".repeat(2047))).searchParams.get("next")?.length,
    2048,
  );
  assert.equal(
    new URL(buildSignInUrl("/" + "a".repeat(2048))).searchParams.get("next"),
    "/dashboard/",
  );
});

test("requireAuthenticated redirects only on an explicit 401", async () => {
  const assigned = [];
  const { sessionStorage } = installBrowser({
    sessionSeed: { "account.me.v1": JSON.stringify({ ts: Date.now(), authenticated: false }) },
  });
  window.location.assign = (url) => assigned.push(url);
  globalThis.fetch = async () => jsonResponse(401, { authenticated: false });
  let authFlow = await loadAccountModule("src/lib/account/authFlow.ts");
  assert.deepEqual(await authFlow.requireAuthenticated(), { kind: "redirecting" });
  assert.equal(sessionStorage.getItem("account.me.v1"), null);
  assert.equal(assigned.length, 1);
  assert.equal(new URL(assigned[0]).searchParams.get("next"), "/pricing/?source=header#plans");

  installBrowser();
  const unavailableAssignments = [];
  window.location.assign = (url) => unavailableAssignments.push(url);
  globalThis.fetch = async () => jsonResponse(503, { code: "BILLING_UNAVAILABLE" });
  authFlow = await loadAccountModule("src/lib/account/authFlow.ts");
  assert.deepEqual(await authFlow.requireAuthenticated(), {
    kind: "unavailable",
    status: 503,
  });
  assert.deepEqual(unavailableAssignments, []);
});
```

在 `scripts/account-nav-dropdown.test.mjs` 增加静态契约断言：LocationSnapshot 包含 hash、监听/清理 `hashchange`、登录 anchor 有 `data-astro-reload`、不存在 `tryFreeHref`，且登录 click handler 对修饰键和非主键点击不清缓存。

- [ ] **Step 2: 运行测试并确认失败**

```bash
npm run test:account
```

Expected: FAIL，因为 `authFlow.ts` 和新 AccountNav 契约尚不存在。

- [ ] **Step 3: 实现最小通用登录 API**

在 constants 增加由 `API_ORIGIN` 派生的 `SIGN_IN_URL`、`/dashboard/` 默认值和与 Auth 对齐的 `MAX_NEXT_LENGTH = 2048`。`authFlow.ts` 使用以下类型：

```ts
export type AuthGateResult =
  | { kind: "authenticated"; user: MeUser }
  | { kind: "redirecting" }
  | { kind: "unavailable"; status?: number };

export function currentReturnTo(): string;
export function buildSignInUrl(returnTo?: string): string;
export function redirectToSignIn(returnTo?: string): void;
export async function requireAuthenticated(options?: {
  returnTo?: string;
}): Promise<AuthGateResult>;
```

核心实现按以下结构完成；dev override 只通过 session 层生效：

```ts
const safeReturnTo = (raw: string | undefined): string => {
  if (!raw || raw.length > MAX_NEXT_LENGTH || !raw.startsWith("/") || raw.startsWith("//") || raw.includes("\\")) {
    return DEFAULT_AFTER_AUTH;
  }
  try {
    const url = new URL(raw, window.location.origin);
    const pathname = decodeURIComponent(url.pathname);
    if (["/auth", "/api"].some(
      (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
    )) return DEFAULT_AFTER_AUTH;
    return raw;
  } catch {
    return DEFAULT_AFTER_AUTH;
  }
};

export const currentReturnTo = () => safeReturnTo(
  `${window.location.pathname}${window.location.search}${window.location.hash}`,
);

export const buildSignInUrl = (returnTo = currentReturnTo()) => {
  const url = new URL(SIGN_IN_URL, window.location.origin);
  url.searchParams.set("next", safeReturnTo(returnTo));
  return url.toString();
};

export const redirectToSignIn = (returnTo?: string) => {
  clearMeCache();
  window.location.assign(buildSignInUrl(returnTo));
};

export const requireAuthenticated = async (
  options: { returnTo?: string } = {},
): Promise<AuthGateResult> => {
  const result = await checkMe({ force: true });
  if (result.kind === "authenticated") {
    return { kind: "authenticated", user: result.data.user };
  }
  if (result.kind === "unauthorized") {
    redirectToSignIn(options.returnTo);
    return { kind: "redirecting" };
  }
  return {
    kind: "unavailable",
    ...(result.kind === "unavailable" && result.status !== undefined
      ? { status: result.status }
      : {}),
  };
};
```

- [ ] **Step 4: 接入 AccountNav，不让 pathname 变化重复强制请求**

修改位置快照：

```ts
type LocationSnapshot = { pathname: string; search: string; hash: string };
const buildNext = ({ pathname, search, hash }: LocationSnapshot) =>
  `${pathname}${search}${hash}`;
```

注册并对称清理 `popstate`、`hashchange`、`astro:after-swap`、`astro:page-load`，这些事件只更新 returnTo。session hydration effect 不依赖 pathname：

```ts
const didHydrateSessionRef = useRef(false);
useEffect(() => {
  if (didHydrateSessionRef.current) return;
  didHydrateSessionRef.current = true;
  const cached = readMeCache();
  if (cached?.authenticated && cached.user) applySignedIn(cached.user);
  else if (cached) applySignedOut();

  if (cached?.authenticated && isMeCacheFresh(cached, Date.now())) return;
  void doRevalidate(); // fresh signed-out 也必须在每个新 document 首次确认
}, [applySignedIn, applySignedOut, doRevalidate]);
```

`doRevalidate()` 只有 signedIn/signedOut 改写身份 UI；error、skipped、invalidResponse 在已有水合状态时保留旧状态，在无缓存冷启动时设置 `ViewState="error"`，不得调用 `applySignedOut()` 或触发 One Tap。

登录 anchor：

```tsx
<a
  href={buildSignInUrl(next)}
  data-astro-reload
  onClick={(event) => {
    if (
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey
    ) return;
    clearMeCache();
  }}
  className="inline-flex items-center gap-2 rounded-md border border-border px-3 py-2 text-sm font-bold text-primary transition hover:border-primary hover:text-primary"
>
```

不要 `preventDefault()`；删除 `tryFreeHref`。

- [ ] **Step 5: 运行账户测试与构建前类型基线**

```bash
npm run test:account
./node_modules/.bin/tsc --noEmit --incremental false
```

Expected: 账户测试 PASS；仅剩 6 个既有非账户类型错误。

- [ ] **Step 6: 提交 Linkjob 登录保护和回跳**

```bash
git add src/lib/account/authFlow.ts src/lib/account/constants.ts src/layouts/helpers/AccountNav.tsx scripts/account-auth.test.mjs scripts/account-nav-dropdown.test.mjs
git commit -m "feat: add reusable authenticated navigation"
```

---

### Task 6: Linkjob 退出登录 CSRF 与 One Tap 冷却收敛

**Repository:** `/Users/silvia/Documents/dist/linkjob`

**Files:**
- Modify: `src/lib/account/authFlow.ts`
- Modify: `src/lib/account/constants.ts`
- Modify: `src/lib/account/oneTap.ts`
- Modify: `src/layouts/helpers/AccountNav.tsx`
- Modify: `scripts/account-auth.test.mjs`

**Interfaces:**
- Produces: `SignOutResult = { kind: "success" } | { kind: "unavailable"; status?: number }`。
- Produces: `signOutCurrentSession(): Promise<SignOutResult>`；DEV override 下只关闭本地开关，其他环境提交服务端退出。
- Produces: `signOutAndReturn(): Promise<SignOutResult>`；DEV success 清一次缓存并 reload，生产 success 通过 `redirectToSignIn(currentReturnTo())` 清一次缓存并导航。
- Preserves: 生产退出成功后返回登录页，并携带退出前的完整站内地址。
- Preserves: dev override 退出仍只在 `import.meta.env.DEV` 为 true 时生效，且不发送网络请求。
- Removes: Linkjob 自己的 10 分钟 One Tap localStorage cooldown；保留最小触发间隔和 in-flight 去重。

- [ ] **Step 1: 写退出成功与失败导航回归测试**

```js
test("signOutAndReturn seeds CSRF, clears cache once, and redirects after success", async () => {
  const { sessionStorage } = installBrowser({
    sessionSeed: { "account.me.v1": "cached" },
  });
  const assigned = [];
  window.location.assign = (url) => assigned.push(url);
  let cookie = "";
  globalThis.document = { get cookie() { return cookie; } };
  const requests = [];
  globalThis.fetch = async (url, init = {}) => {
    requests.push({ url: String(url), init });
    if (requests.length === 1) {
      cookie = "csrf_token=seeded";
      return jsonResponse(401, { authenticated: false });
    }
    return new Response(null, { status: 204 });
  };
  const { signOutAndReturn } = await loadAccountModule("src/lib/account/authFlow.ts");
  assert.deepEqual(await signOutAndReturn(), { kind: "success" });
  assert.equal(requests[0].init.credentials, "include");
  assert.equal(requests[1].init.method, "POST");
  assert.equal(requests[1].init.credentials, "include");
  assert.equal(requests[1].init.headers["X-CSRF-Token"], "seeded");
  assert.equal(sessionStorage.getItem("account.me.v1"), null);
  assert.deepEqual(sessionStorage.removed, ["account.me.v1"]);
  assert.equal(assigned.length, 1);
  assert.equal(
    new URL(assigned[0]).searchParams.get("next"),
    "/pricing/?source=header#plans",
  );
});

test("signOutAndReturn keeps local state and does not navigate on failure", async () => {
  for (const failure of [403, 503, "network"]) {
    const { sessionStorage } = installBrowser({
      sessionSeed: { "account.me.v1": "cached" },
    });
    const assigned = [];
    window.location.assign = (url) => assigned.push(url);
    globalThis.document = { cookie: "csrf_token=seeded" };
    globalThis.fetch = async () => {
      if (failure === "network") throw new Error("offline");
      return jsonResponse(failure, { code: "FAILED" });
    };
    const { signOutAndReturn } = await loadAccountModule("src/lib/account/authFlow.ts");
    assert.equal((await signOutAndReturn()).kind, "unavailable");
    assert.equal(sessionStorage.getItem("account.me.v1"), "cached");
    assert.deepEqual(sessionStorage.removed, []);
    assert.deepEqual(assigned, []);
  }
});

test("signOutAndReturn disables the DEV override without fetching", async () => {
  const { sessionStorage } = installBrowser({
    sessionSeed: { "account.me.v1": "cached" },
  });
  window.localStorage.setItem("account.dev.authenticated", "1");
  const assigned = [];
  window.location.assign = (url) => assigned.push(url);
  let reloads = 0;
  window.location.reload = () => { reloads += 1; };
  let fetchCalls = 0;
  globalThis.fetch = async () => {
    fetchCalls += 1;
    throw new Error("DEV sign-out must not fetch");
  };

  const { signOutAndReturn } = await loadAccountModule(
    "src/lib/account/authFlow.ts",
    { dev: true },
  );
  assert.deepEqual(await signOutAndReturn(), { kind: "success" });
  assert.equal(fetchCalls, 0);
  assert.equal(window.localStorage.getItem("account.dev.authenticated"), "0");
  assert.deepEqual(sessionStorage.removed, ["account.me.v1"]);
  assert.deepEqual(assigned, []);
  assert.equal(reloads, 1);
});
```

- [ ] **Step 2: 运行测试并确认当前实现失败**

```bash
npm run test:account
```

Expected: FAIL，因为通用退出函数不存在，当前 AccountNav 会在 finally 中无条件清缓存导航。

- [ ] **Step 3: 实现双提交 CSRF 退出与成功导航封装**

在 `authFlow.ts` 增加 cookie 读取、纯服务端退出函数和成功后返回登录页的薄封装：

```ts
export type SignOutResult =
  | { kind: "success" }
  | { kind: "unavailable"; status?: number };

export async function signOutCurrentSession(): Promise<SignOutResult> {
  if (hasDevAuthOverride()) {
    try {
      window.localStorage.setItem(DEV_AUTH_STORAGE_KEY, "0");
      return { kind: "success" };
    } catch {
      return { kind: "unavailable" };
    }
  }

  let token = readCookie("csrf_token");
  if (!token) {
    try {
      await fetch(ME_URL, { credentials: "include" });
    } catch {
      return { kind: "unavailable" };
    }
    token = readCookie("csrf_token");
  }
  if (!token) return { kind: "unavailable" };

  try {
    const response = await fetch(SIGN_OUT_URL, {
      method: "POST",
      credentials: "include",
      headers: { "X-CSRF-Token": token },
    });
    if (!response.ok) return { kind: "unavailable", status: response.status };
    return { kind: "success" };
  } catch {
    return { kind: "unavailable" };
  }
}

export async function signOutAndReturn(): Promise<SignOutResult> {
  const devOverride = hasDevAuthOverride();
  const result = await signOutCurrentSession();
  if (result.kind === "success") {
    if (devOverride) {
      clearMeCache();
      window.location.reload();
    } else {
      redirectToSignIn(currentReturnTo());
    }
  }
  return result;
}
```

`authFlow.ts` 从 constants 导入 `DEV_AUTH_STORAGE_KEY`，从 session 导入 `hasDevAuthOverride()`；该 helper 自带 `import.meta.env.DEV` 边界，生产构建不会进入本地分支。

AccountNav 删除现有 DEV 专用退出分支，只调用 `signOutAndReturn()`；结果为 unavailable 时 `setSigningOut(false)` 并保留已登录 UI，不再自行写 localStorage、清缓存或导航。DEV success 的缓存清理与 reload、生产 success 的缓存清理与 `/auth/sign-in?next=<当前 pathname+query+hash>` 导航都由封装完成。

- [ ] **Step 4: 删除 Linkjob 长期 One Tap cooldown**

从 constants 和 `oneTap.ts` 删除 `ONE_TAP_COOLDOWN_KEY`、`ONE_TAP_COOLDOWN_MS`、`getCooldownUntil()`、`setCooldownUntil()`；保留：

```ts
if (now - lastTriggerTs < ONE_TAP_MIN_INTERVAL_MS) return;
if (oneTapInFlight) return;
```

Auth 的 24 小时 dismissed cooldown 不改。

- [ ] **Step 5: 运行账户测试和类型基线**

```bash
npm run test:account
./node_modules/.bin/tsc --noEmit --incremental false
```

Expected: 账户测试 PASS；仍只有 6 个既有非账户错误。

- [ ] **Step 6: 提交退出与 One Tap 修复**

```bash
git add src/lib/account/authFlow.ts src/lib/account/constants.ts src/lib/account/oneTap.ts src/layouts/helpers/AccountNav.tsx scripts/account-auth.test.mjs
git commit -m "fix: make account sign-out fail closed"
```

---

### Task 7: Linkjob 纯 Customer Portal 客户端

**Repository:** `/Users/silvia/Documents/dist/linkjob`

**Files:**
- Create: `src/lib/account/customerPortal.ts`
- Modify: `src/lib/account/constants.ts`
- Modify: `scripts/account-auth.test.mjs`

**Interfaces:**
- Produces: `createCustomerPortal(): Promise<CustomerPortalResult>`。
- Has no side effects: 不导航、不打开 URL、不清缓存、不调用登录。

- [ ] **Step 1: 写成功解析和关键失败映射测试**

```js
test("createCustomerPortal parses Stripe and Creem portal responses", async () => {
  installBrowser();
  const requests = [];
  globalThis.fetch = async (url, init = {}) => {
    requests.push({ url: String(url), init });
    return jsonResponse(200, {
      provider: "stripe",
      url: "https://billing.stripe.com/p/session",
      expiresAt: "2026-12-01T00:00:00.000Z",
    });
  };
  const { createCustomerPortal } = await loadAccountModule(
    "src/lib/account/customerPortal.ts",
  );
  assert.deepEqual(await createCustomerPortal(), {
    kind: "success",
    provider: "stripe",
    url: "https://billing.stripe.com/p/session",
    subscriptionExpiresAt: "2026-12-01T00:00:00.000Z",
  });
  assert.equal(requests[0].init.method, undefined);
  assert.equal(requests[0].init.credentials, "include");
  assert.equal(requests[0].init.body, undefined);
  assert.equal(requests[0].init.headers, undefined);

  globalThis.fetch = async () => jsonResponse(200, {
    provider: "creem",
    url: "https://app.creem.io/customer-portal/session",
    expiresAt: null,
  });
  assert.deepEqual(await createCustomerPortal(), {
    kind: "success",
    provider: "creem",
    url: "https://app.creem.io/customer-portal/session",
    subscriptionExpiresAt: null,
  });
});

test("createCustomerPortal maps auth, missing subscription, outage, and invalid payload", async () => {
  installBrowser({ sessionSeed: { "account.me.v1": "cached" } });
  const assigned = [];
  window.location.assign = (url) => assigned.push(url);
  window.open = (url) => assigned.push(url);
  const { createCustomerPortal } = await loadAccountModule(
    "src/lib/account/customerPortal.ts",
  );

  globalThis.fetch = async () => new Response(null, { status: 401 });
  assert.deepEqual(await createCustomerPortal(), { kind: "authenticationRequired" });

  globalThis.fetch = async () => jsonResponse(404, { code: "NO_MANAGEABLE_SUBSCRIPTION" });
  assert.deepEqual(await createCustomerPortal(), { kind: "noManageableSubscription" });

  globalThis.fetch = async () => new Response(null, { status: 404 });
  assert.deepEqual(await createCustomerPortal(), { kind: "invalidResponse" });

  for (const code of ["BILLING_UNAVAILABLE", "PAYMENT_PROVIDER_UNAVAILABLE"]) {
    globalThis.fetch = async () => jsonResponse(503, { code });
    assert.deepEqual(await createCustomerPortal(), {
      kind: "unavailable",
      retryable: true,
    });
  }

  for (const status of [502, 503]) {
    globalThis.fetch = async () => new Response("<html>upstream unavailable</html>", {
      status,
      headers: { "Content-Type": "text/html" },
    });
    assert.deepEqual(await createCustomerPortal(), {
      kind: "unavailable",
      retryable: true,
    });
  }

  globalThis.fetch = async () => jsonResponse(200, {
    provider: "stripe",
    url: "http://unsafe.example/portal",
    expiresAt: null,
  });
  assert.deepEqual(await createCustomerPortal(), { kind: "invalidResponse" });
  assert.deepEqual(assigned, []);
  assert.equal(window.sessionStorage.getItem("account.me.v1"), "cached");
});
```

- [ ] **Step 2: 运行测试并确认失败**

```bash
npm run test:account
```

Expected: FAIL，因为 `customerPortal.ts` 尚不存在。

- [ ] **Step 3: 实现无 UI 副作用客户端**

```ts
export type CustomerPortalResult =
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

export async function createCustomerPortal(): Promise<CustomerPortalResult> {
  let response: Response;
  try {
    response = await fetch(CUSTOMER_PORTAL_URL, { credentials: "include" });
  } catch {
    return { kind: "unavailable", retryable: true };
  }

  if (response.status === 401) {
    return { kind: "authenticationRequired" };
  }
  if (response.status >= 500) {
    return { kind: "unavailable", retryable: true };
  }

  let body: unknown;
  try {
    body = await response.json();
  } catch {
    return { kind: "invalidResponse" };
  }

  const code = body && typeof body === "object" && "code" in body
    ? (body as { code?: unknown }).code
    : undefined;
  if (response.status === 404) {
    return code === "NO_MANAGEABLE_SUBSCRIPTION"
      ? { kind: "noManageableSubscription" }
      : { kind: "invalidResponse" };
  }
  if (!response.ok || !isValidPortalBody(body)) return { kind: "invalidResponse" };
  return {
    kind: "success",
    provider: body.provider,
    url: body.url,
    subscriptionExpiresAt: body.expiresAt,
  };
}
```

`isValidPortalBody()` 只接受 `provider` 为 `stripe|creem`、`url` 可解析且 protocol 为 `https:`、`expiresAt` 为 null 或可解析日期；返回时重命名为 `subscriptionExpiresAt`。401 在读取 body 前返回 authenticationRequired；所有 5xx（包括 HTML/不可解析 body）返回可重试 unavailable。404 读取 JSON 仅为识别 `NO_MANAGEABLE_SUBSCRIPTION`，未知 code 或不可解析 body 返回 invalidResponse；其他未知非 2xx 状态也返回 invalidResponse。

- [ ] **Step 4: 运行账户测试和类型基线**

```bash
npm run test:account
./node_modules/.bin/tsc --noEmit --incremental false
```

Expected: 账户测试 PASS；仍只有 6 个既有非账户错误。

- [ ] **Step 5: 提交 Customer Portal 客户端**

```bash
git add src/lib/account/customerPortal.ts src/lib/account/constants.ts scripts/account-auth.test.mjs
git commit -m "feat: add customer portal client"
```

---

### Task 8: 双仓库回归验证与生产同源 smoke test

**Repositories:** 两个仓库；此任务不修改业务代码。

**Files:**
- Verify only: Auth 和 Linkjob 上述全部文件。

**Interfaces:**
- Consumes: Tasks 1–7 的最终提交。
- Produces: 可审阅的验证记录；不产生新抽象、测试框架或顺手修复。

- [ ] **Step 1: 验证 Auth 全量测试和类型检查**

```bash
cd /Users/silvia/Documents/dist/auth
npm test
npm run build
git status --short
```

Expected: 全部 Vitest PASS；build exit 0；状态只包含计划内文件或完全干净。

- [ ] **Step 2: 验证 Linkjob 定向测试和类型基线**

```bash
cd /Users/silvia/Documents/dist/linkjob
npm run test:account
./node_modules/.bin/tsc --noEmit --incremental false
git status --short
```

Expected: account tests PASS；TS1360 消失，只有记录的 6 个历史错误。

- [ ] **Step 3: 执行 Linkjob 构建，不触发远端同步**

`npm run build` 会先运行 `sync-public` 并访问 R2，不用于默认本地验证。直接调用 Astro：

```bash
ASTRO_BASE=/ node --max-old-space-size=8192 ./node_modules/.bin/astro build
```

Expected: Astro build 成功；随后只检查构建产物，不提交 `dist/`。

- [ ] **Step 4: 执行本地联调矩阵**

检查：

1. `/pricing/?source=header#plans` 登录链接的 `next` 完整。
2. 登录 anchor 有真实 href 和 `data-astro-reload`；普通点击清缓存，复制/新标签页行为正常。
3. fresh signed-out cache 在新 document 首次加载仍请求一次 `/api/me`；Astro 连续站内切页不每页重请求。
4. 401 执行带 next 登录；503、离线和网络失败不跳登录。
5. `signOutAndReturn()` 在服务端 sign-out 200 时调用一次 `redirectToSignIn(currentReturnTo())`，最终进入 `/auth/sign-in?next=<原 pathname+query+hash>`；DEV override 成功关闭时不发 fetch、不 assign，清一次缓存并 reload。403/503/网络失败保留账户 UI 且不导航，行为测试中的 assignment/reload 断言同时通过。
6. One Tap 只在 Auth `/api/me` 401 时出现。
7. Desktop 和 Legacy Claim 流程仍可完成。

- [ ] **Step 5: 执行一次生产同源 smoke test**

在生产或等价同源预发布环境验证 Header 登录点击直接整页导航到 `/auth/sign-in`，不是 Astro fetch/swap；完成 Google/GitHub 登录后回到发起页面。不要在本任务部署生产，使用项目既有发布流程提供的环境。

- [ ] **Step 6: 审查两个仓库 diff 和提交边界**

```bash
git -C /Users/silvia/Documents/dist/auth diff --check
git -C /Users/silvia/Documents/dist/auth log --oneline -3
git -C /Users/silvia/Documents/dist/linkjob diff --check
git -C /Users/silvia/Documents/dist/linkjob log --oneline -4
```

Expected: 无 whitespace 错误；没有 Pricing、邮件产品、多语言、Billing 契约或无关文件改动。验证任务不创建额外提交。

## Execution Notes

- 推荐按 Task 1→3 完成 Auth，再按 Task 4→7 完成 Linkjob，最后执行 Task 8；不要并行修改共享文件 `app.js`、`AccountNav.tsx`、`session.ts` 或 `scripts/account-auth.test.mjs`。
- 每个任务通过自己的定向验证后立即提交，便于单独审阅和回滚。
- 若执行时两个仓库 HEAD 或调用链已变化，先更新本计划中的文件行号和测试基线，再开始该任务；不得盲套旧 diff。
- Pricing 接入必须另开需求与分支；本计划完成后只提供通用 API，不连接具体支付按钮。
