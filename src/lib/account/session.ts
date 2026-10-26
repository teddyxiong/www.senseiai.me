import {
  DEV_USER_STORAGE_KEY,
  ME_CACHE_KEY,
  ME_CACHE_TTL_MS,
  ME_EXPIRES_EARLY_MS,
  ME_FAIL_COOLDOWN_MS,
  ME_IN_FLIGHT_MAX_AGE_MS,
  ME_URL,
} from "@/lib/account/constants";
import type { MeCache, MeResponse, MeUser } from "@/lib/account/types";
import { isAuthedMeResponse } from "@/lib/account/types";

type MeFetchResult =
  | { kind: "unauthorized" }
  | { kind: "ok"; data: unknown }
  | { kind: "unavailable"; status?: number };

export type MeCheckResult =
  | { kind: "authenticated"; data: Extract<MeResponse, { authenticated: true }> }
  | { kind: "unauthorized" }
  | { kind: "unavailable"; status?: number }
  | { kind: "invalidResponse" }
  | { kind: "skipped" };

export type MeRevalidateResult =
  | { kind: "skipped" }
  | { kind: "signedOut" }
  | { kind: "signedIn"; data: Extract<MeResponse, { authenticated: true }> }
  | { kind: "invalidResponse" }
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

const readDevAuth = (): { enabled: boolean; user: MeUser } | null => {
  if (!import.meta.env.DEV) return null;
  try {
    const defaultUser: MeUser = { id: "dev", email: "dev@local", name: "Dev User" };

    const rawUser =
      window.localStorage.getItem(DEV_USER_STORAGE_KEY) ??
      (typeof import.meta.env.PUBLIC_ACCOUNT_DEV_USER === "string"
        ? import.meta.env.PUBLIC_ACCOUNT_DEV_USER
        : null);
    const parsedUser = rawUser ? safeJsonParse<MeUser>(rawUser) : null;

    const user =
      parsedUser && typeof parsedUser.email === "string" && typeof parsedUser.id === "string"
        ? parsedUser
        : defaultUser;
    return { enabled: true, user };
  } catch {
    return null;
  }
};

export const hasDevAuthOverride = () => readDevAuth() !== null;

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
      if (!resp.ok) return { kind: "unavailable", status: resp.status } as const;
      const data = await resp.json();
      return { kind: "ok", data } as const;
    } catch {
      return { kind: "unavailable" } as const;
    }
  })().finally(() => {
    if (meInFlight?.startedAt === startedAt) {
      meInFlight = null;
    }
  });

  meInFlight = { startedAt, promise };
  return promise;
};

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

export const revalidateMe = async (): Promise<MeRevalidateResult> => {
  const result = await checkMe();

  if (result.kind === "unauthorized") {
    writeMeCache({ ts: Date.now(), authenticated: false });
    return { kind: "signedOut" };
  }
  if (result.kind === "authenticated") {
    const data = result.data;
    writeMeCache({
      ts: Date.now(),
      authenticated: true,
      user: data.user,
      sessionExpiresAt: data.sessionExpiresAt,
    });
    return { kind: "signedIn", data };
  }
  if (result.kind === "invalidResponse") return result;
  if (result.kind === "skipped") return result;
  return { kind: "error" };
};
