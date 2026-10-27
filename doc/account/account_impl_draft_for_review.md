# AccountNav 实现草案（供审核，按当前仓库实际代码回写）

本文件以仓库当前实现为准，列出新增/修改的关键文件与其代码（或必要节选），用于审核。

## 1) 新增：src/config/account-menu.json

[account-menu.json](file:///Users/teddy/Documents/aaa/Sensei/src/config/account-menu.json)

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

## 2) 新增：src/lib/account/menuConfig.ts（类型化配置入口）

[menuConfig.ts](file:///Users/teddy/Documents/aaa/Sensei/src/lib/account/menuConfig.ts)

```ts
import type { AccountMenuConfig } from "@/lib/account/types";
import menu from "@/config/account-menu.json";

export default menu satisfies AccountMenuConfig;
```

## 3) 新增：src/lib/account/types.ts

[types.ts](file:///Users/teddy/Documents/aaa/Sensei/src/lib/account/types.ts)

```ts
export type AccountMenuConfig = {
  buttons: {
    signIn: string;
    tryFree: string;
  };
  menu: {
    planAndBilling: string;
    signOut: string;
  };
  links: {
    login: string;
    register: string;
    billing: string;
  };
  a11y?: {
    accountMenu?: string;
  };
};

export type MeUser = {
  id: string;
  email: string;
  name?: string | null;
  emailVerified?: boolean;
  image?: string | null;
};

export type MeResponseAuthed = {
  authenticated: true;
  user: MeUser;
  sessionExpiresAt?: string;
};

export type MeResponseUnAuthed = {
  authenticated: false;
};

export type MeResponse = MeResponseAuthed | MeResponseUnAuthed;

export type MeCache = {
  ts: number;
  authenticated: boolean;
  user?: MeUser;
  sessionExpiresAt?: string;
};

export type ViewState = "unknown" | "signedOut" | "signedIn" | "error";

export const isAuthedMeResponse = (resp: MeResponse): resp is MeResponseAuthed =>
  resp.authenticated === true;
```

## 4) 新增：src/lib/account/constants.ts（单一来源常量）

[constants.ts](file:///Users/teddy/Documents/aaa/Sensei/src/lib/account/constants.ts)

```ts
import config from "@/config/config.json";

export const API_ORIGIN = config.site.base_url.replace(/\/$/, "");
export const ASSET_ORIGIN = config.site.asset_base_url.replace(/\/$/, "");

export const ME_URL = `${API_ORIGIN}/api/me`;
export const SIGN_OUT_URL = `${API_ORIGIN}/api/auth/sign-out`;

export const ME_CACHE_KEY = "account.me.v1";
export const ME_CACHE_TTL_MS = 60_000;
export const ME_EXPIRES_EARLY_MS = 1_000;

export const ME_IN_FLIGHT_MAX_AGE_MS = 5_000;
export const ME_FAIL_COOLDOWN_MS = 30_000;

export const AUTH_PATH_PREFIX = "/auth/";
export const ONE_TAP_MODULE_URL = "/auth/one-tap.js";
export const ONE_TAP_COOLDOWN_KEY = "account.oneTap.cooldownUntil";
export const ONE_TAP_COOLDOWN_MS = 10 * 60_000;
export const ONE_TAP_MIN_INTERVAL_MS = 3_000;

export const FALLBACK_AVATAR_URL = `${ASSET_ORIGIN}/images/favicon.png`;
```

## 5) 新增：src/lib/account/session.ts（缓存 + 网络层：去重/退避/离线）

[session.ts](file:///Users/teddy/Documents/aaa/Sensei/src/lib/account/session.ts)

```ts
import {
  ME_CACHE_KEY,
  ME_CACHE_TTL_MS,
  ME_EXPIRES_EARLY_MS,
  ME_FAIL_COOLDOWN_MS,
  ME_IN_FLIGHT_MAX_AGE_MS,
  ME_URL,
} from "@/lib/account/constants";
import type { MeCache, MeResponse } from "@/lib/account/types";
import { isAuthedMeResponse } from "@/lib/account/types";

type MeFetchResult =
  | { kind: "unauthorized" }
  | { kind: "ok"; data: MeResponse }
  | { kind: "error" };

export type MeRevalidateResult =
  | { kind: "skipped" }
  | { kind: "signedOut" }
  | { kind: "signedIn"; data: Extract<MeResponse, { authenticated: true }> }
  | { kind: "error" };

let meInFlight: { startedAt: number; promise: Promise<MeFetchResult> } | null = null;
let meLastFailAt = 0;

const safeJsonParse = <T,>(value: string): T | null => {
  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
};

const isOffline = () => typeof navigator !== "undefined" && navigator.onLine === false;
const isInFailCooldown = () => Date.now() - meLastFailAt < ME_FAIL_COOLDOWN_MS;
const markMeFail = () => {
  meLastFailAt = Date.now();
};

export const isMeCacheFresh = (cache: MeCache, now: number) => {
  let freshUntil = cache.ts + ME_CACHE_TTL_MS;
  if (cache.authenticated && cache.sessionExpiresAt) {
    const exp = Date.parse(cache.sessionExpiresAt);
    if (Number.isFinite(exp)) {
      freshUntil = Math.min(freshUntil, exp - ME_EXPIRES_EARLY_MS);
    }
  }
  return now < freshUntil;
};

export const readMeCache = (): MeCache | null => {
  try {
    const raw = window.sessionStorage.getItem(ME_CACHE_KEY);
    if (!raw) return null;
    const parsed = safeJsonParse<MeCache>(raw);
    if (!parsed || typeof parsed.ts !== "number" || typeof parsed.authenticated !== "boolean") {
      return null;
    }
    return parsed;
  } catch {
    /* sessionStorage 不可用时忽略 */
    return null;
  }
};

export const writeMeCache = (value: MeCache) => {
  try {
    window.sessionStorage.setItem(ME_CACHE_KEY, JSON.stringify(value));
  } catch {
    /* sessionStorage 不可用时忽略 */
  }
};

export const clearMeCache = () => {
  try {
    window.sessionStorage.removeItem(ME_CACHE_KEY);
  } catch {
    /* sessionStorage 不可用时忽略 */
  }
};

const fetchMeDeduped = () => {
  const now = Date.now();
  if (meInFlight && now - meInFlight.startedAt < ME_IN_FLIGHT_MAX_AGE_MS) {
    return meInFlight.promise;
  }

  const startedAt = now;
  const promise: Promise<MeFetchResult> = (async () => {
    try {
      const resp = await fetch(ME_URL, { credentials: "include" });
      if (resp.status === 401) return { kind: "unauthorized" } as const;
      if (!resp.ok) return { kind: "error" } as const;
      const data = (await resp.json()) as MeResponse;
      return { kind: "ok", data } as const;
    } catch {
      return { kind: "error" } as const;
    }
  })().finally(() => {
    if (meInFlight?.startedAt === startedAt) {
      meInFlight = null;
    }
  });

  meInFlight = { startedAt, promise };
  return promise;
};

export const revalidateMe = async (): Promise<MeRevalidateResult> => {
  if (isOffline() || isInFailCooldown()) return { kind: "skipped" };

  const result = await fetchMeDeduped();

  if (result.kind === "unauthorized") {
    writeMeCache({ ts: Date.now(), authenticated: false });
    return { kind: "signedOut" };
  }

  if (result.kind === "error") {
    markMeFail();
    return { kind: "error" };
  }

  const data = result.data;
  if (isAuthedMeResponse(data)) {
    writeMeCache({
      ts: Date.now(),
      authenticated: true,
      user: data.user,
      sessionExpiresAt: data.sessionExpiresAt,
    });
    return { kind: "signedIn", data };
  }

  writeMeCache({ ts: Date.now(), authenticated: false });
  return { kind: "signedOut" };
};
```

## 6) 新增：src/lib/account/oneTap.ts（动态 import + 冷却）

[oneTap.ts](file:///Users/teddy/Documents/aaa/Sensei/src/lib/account/oneTap.ts)

```ts
import {
  AUTH_PATH_PREFIX,
  ONE_TAP_COOLDOWN_KEY,
  ONE_TAP_COOLDOWN_MS,
  ONE_TAP_MIN_INTERVAL_MS,
  ONE_TAP_MODULE_URL,
} from "@/lib/account/constants";

const getCooldownUntil = () => {
  try {
    const raw = window.localStorage.getItem(ONE_TAP_COOLDOWN_KEY);
    if (!raw) return 0;
    const parsed = Number(raw);
    return Number.isFinite(parsed) ? parsed : 0;
  } catch {
    /* localStorage 不可用时忽略 */
    return 0;
  }
};

const setCooldownUntil = (until: number) => {
  try {
    window.localStorage.setItem(ONE_TAP_COOLDOWN_KEY, String(until));
  } catch {
    /* localStorage 不可用时忽略 */
  }
};

export const shouldTriggerOneTap = (pathname: string) => !pathname.startsWith(AUTH_PATH_PREFIX);

let lastTriggerTs = 0;
let oneTapInFlight: Promise<void> | null = null;

export const maybeRunOneTap = (pathname: string) => {
  if (!shouldTriggerOneTap(pathname)) return;

  const now = Date.now();
  if (now - lastTriggerTs < ONE_TAP_MIN_INTERVAL_MS) return;

  const cooldownUntil = getCooldownUntil();
  if (now < cooldownUntil) return;

  lastTriggerTs = now;
  setCooldownUntil(now + ONE_TAP_COOLDOWN_MS);

  if (oneTapInFlight) return;

  oneTapInFlight = import(/* @vite-ignore */ ONE_TAP_MODULE_URL)
    .then((m: unknown) => {
      const mod = m as { runOneTap?: () => void };
      mod.runOneTap?.();
    })
    .catch(() => {
      /* one-tap 失败时忽略 */
    })
    .finally(() => {
      oneTapInFlight = null;
    });
};
```

## 7) 新增：src/layouts/helpers/AccountNav.tsx（组件：UI + 状态编排）

[AccountNav.tsx](file:///Users/teddy/Documents/aaa/Sensei/src/layouts/helpers/AccountNav.tsx)

```tsx
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  FALLBACK_AVATAR_URL,
  SIGN_OUT_URL,
} from "@/lib/account/constants";
import { maybeRunOneTap } from "@/lib/account/oneTap";
import {
  clearMeCache,
  isMeCacheFresh,
  readMeCache,
  revalidateMe,
} from "@/lib/account/session";
import type { AccountMenuConfig, MeUser, ViewState } from "@/lib/account/types";

type LocationSnapshot = { pathname: string; search: string };

const buildNext = (pathname: string, search: string) => `${pathname}${search || ""}`;

const buildNextUrl = (base: string, next: string) => {
  const url = new URL(base, window.location.origin);
  url.searchParams.set("next", next);
  return url.toString();
};

const AccountAvatar = ({ src }: { src: string }) => (
  <img
    src={src}
    alt=""
    className="h-6 w-6 rounded-full object-cover"
    loading="lazy"
    decoding="async"
    referrerPolicy="no-referrer"
  />
);

const AccountNav = ({ menuConfig }: { menuConfig: AccountMenuConfig }) => {
  const [locationSnapshot, setLocationSnapshot] = useState<LocationSnapshot>(() => {
    if (typeof window === "undefined") return { pathname: "/", search: "" };
    return { pathname: window.location.pathname, search: window.location.search };
  });

  useEffect(() => {
    if (typeof window === "undefined") return;
    const update = () => {
      const nextLocation = {
        pathname: window.location.pathname,
        search: window.location.search,
      };
      setLocationSnapshot((prev) => {
        if (prev.pathname === nextLocation.pathname && prev.search === nextLocation.search) {
          return prev;
        }
        return nextLocation;
      });
    };
    update();
    window.addEventListener("popstate", update);
    document.addEventListener("astro:after-swap", update);
    document.addEventListener("astro:page-load", update);
    return () => {
      window.removeEventListener("popstate", update);
      document.removeEventListener("astro:after-swap", update);
      document.removeEventListener("astro:page-load", update);
    };
  }, []);

  const pathname = locationSnapshot.pathname;
  const search = locationSnapshot.search;
  const next = useMemo(() => buildNext(pathname, search), [pathname, search]);

  const [viewState, setViewState] = useState<ViewState>("unknown");
  const [user, setUser] = useState<MeUser | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const hasHydratedStateRef = useRef(false);

  const displayName = user?.name?.trim() || user?.email || "";

  const applySignedOut = useCallback(() => {
    hasHydratedStateRef.current = true;
    setUser(null);
    setViewState("signedOut");
  }, []);

  const applySignedIn = useCallback((nextUser: MeUser) => {
    hasHydratedStateRef.current = true;
    setUser(nextUser);
    setViewState("signedIn");
  }, []);

  const doRevalidate = useCallback(async () => {
    const result = await revalidateMe();

    if (result.kind === "signedIn") {
      applySignedIn(result.data.user);
      return;
    }

    if (result.kind === "signedOut") {
      applySignedOut();
      maybeRunOneTap(pathname);
      return;
    }

    if (!hasHydratedStateRef.current) {
      applySignedOut();
    }
  }, [applySignedIn, applySignedOut, pathname]);

  useEffect(() => {
    const cached = readMeCache();
    const now = Date.now();
    if (cached) {
      if (cached.authenticated && cached.user) applySignedIn(cached.user);
      else applySignedOut();
    }

    if (cached && isMeCacheFresh(cached, now)) return;
    void doRevalidate();
  }, [pathname, applySignedIn, applySignedOut, doRevalidate]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const onOnline = () => {
      const cached = readMeCache();
      const now = Date.now();
      if (cached && isMeCacheFresh(cached, now)) return;
      void doRevalidate();
    };
    window.addEventListener("online", onOnline);
    return () => window.removeEventListener("online", onOnline);
  }, [doRevalidate]);

  useEffect(() => {
    const onPointerDown = (e: PointerEvent) => {
      if (!menuOpen) return;
      const target = e.target as Node | null;
      if (!target) return;
      if (containerRef.current && !containerRef.current.contains(target)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [menuOpen]);

  const onSignOut = useCallback(async () => {
    if (signingOut) return;
    setSigningOut(true);

    try {
      await fetch(SIGN_OUT_URL, { method: "POST", credentials: "include" });
    } catch {
      /* sign-out 失败时仍清缓存并跳转 */
    } finally {
      clearMeCache();
      window.location.href = buildNextUrl(menuConfig.links.login, next);
    }
  }, [menuConfig.links.login, next, signingOut]);

  if (viewState === "unknown") {
    return <div className="h-[46px] w-[220px]" aria-hidden="true" />;
  }

  if (viewState === "signedIn" && user) {
    return (
      <div className="relative flex items-center" ref={containerRef}>
        <button
          type="button"
          className="inline-flex items-center gap-2 rounded-md border border-border px-3 py-2 text-sm font-bold text-primary transition hover:border-primary hover:text-primary"
          aria-label={menuConfig.a11y?.accountMenu || "Account menu"}
          aria-haspopup="menu"
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen((v) => !v)}
        >
          <AccountAvatar src={user.image || FALLBACK_AVATAR_URL} />
          <span className="max-w-[140px] overflow-hidden text-ellipsis whitespace-nowrap">
            {displayName}
          </span>
          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path
              d="M7 10l5 5 5-5"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>

        {menuOpen && (
          <div
            className="absolute right-0 z-50 mt-2 min-w-[220px] translate-y-0 rounded-md border border-border bg-white p-1 shadow-lg"
            role="menu"
          >
            <a
              href={menuConfig.links.billing}
              className="block rounded px-3 py-2 text-sm transition hover:bg-theme-light hover:text-primary"
              role="menuitem"
            >
              {menuConfig.menu.planAndBilling}
            </a>
            <button
              type="button"
              className="block w-full rounded px-3 py-2 text-left text-sm transition hover:bg-theme-light hover:text-primary disabled:opacity-60"
              onClick={onSignOut}
              disabled={signingOut}
              role="menuitem"
            >
              {menuConfig.menu.signOut}
            </button>
          </div>
        )}
      </div>
    );
  }

  const signInHref = buildNextUrl(menuConfig.links.login, next);
  const tryFreeHref = buildNextUrl(menuConfig.links.register, next);

  return (
    <div className="flex items-center gap-2">
      <a
        href={signInHref}
        className="inline-flex items-center gap-2 rounded-md border border-border px-3 py-2 text-sm font-bold text-primary transition hover:border-primary hover:text-primary"
      >
        {menuConfig.buttons.signIn}
      </a>
      <a className="btn btn-header-primary" href={tryFreeHref}>
        {menuConfig.buttons.tryFree}
      </a>
    </div>
  );
};

export default AccountNav;
```

## 8) 修改：src/layouts/partials/Header.astro（关键片段，按现状节选）

Header 里新增了两处挂载（mobile + desktop），均使用 `client:idle`，并用 `transition:persist + transition:name` 避免 View Transitions 下的重挂闪烁。

### import 与 mobile 区域

```astro
import menu from "@/config/menu.json";
import accountMenuConfig from "@/lib/account/menuConfig";
import AccountNav from "@/helpers/AccountNav";

<AccountNav
  client:idle
  transition:name="account-nav-mobile"
  transition:persist
  menuConfig={accountMenuConfig}
/>
```

### desktop 区域（保留语言切换器，Download 按钮保持条件渲染）

```astro
<div class="order-1 ml-auto hidden shrink-0 items-center gap-3 lg:order-2 lg:flex lg:ml-0">
  {showLocalePackageNav && (/* 语言切换器原样 */)}
  <AccountNav
    client:idle
    transition:name="account-nav-desktop"
    transition:persist
    menuConfig={accountMenuConfig}
  />
  {navigation_button.enable && (
    <a class="btn btn-header-primary" href={navigation_button.link}>
      {navigation_button.label}
    </a>
  )}
</div>
```

## 9) 行为要点（对照验收）

- View Transitions：`transition:persist` 让 island 跨导航存活；组件内部监听 `astro:after-swap`/`astro:page-load` 读取最新 `location` 用于 `next`
- 缓存：`sessionStorage` + TTL（60s）并使用 `sessionExpiresAt` 作为上界（提前 1s）
- 请求：两个 island 共享模块级 in-flight，避免同页重复请求；离线/失败进入 30s 冷却窗口，避免连续失败请求；恢复联网 `online` 事件再校验
- 未登录：`Sign in`/`Try for free` 都追加 `?next=pathname+search`
- 已登录：显示头像（`user.image`，缺失走 favicon）+ 名称；菜单包含 Billing 与 Sign out
- 退出：POST `SIGN_OUT_URL` 后清缓存并跳转 `login?next=...`
- One-tap：仅在确认未登录（`/api/me` -> 401 或 authenticated=false）后触发；避开 `/auth/`；localStorage 冷却 10 分钟；动态 import `/auth/one-tap.js`

