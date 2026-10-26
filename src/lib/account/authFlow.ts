import {
  DEFAULT_AFTER_AUTH,
  DEV_AUTH_STORAGE_KEY,
  MAX_NEXT_LENGTH,
  ME_URL,
  SIGN_IN_URL,
  SIGN_OUT_URL,
} from "@/lib/account/constants";
import {
  checkMe,
  clearMeCache,
  hasDevAuthOverride,
} from "@/lib/account/session";
import type { MeUser } from "@/lib/account/types";

export type AuthGateResult =
  | { kind: "authenticated"; user: MeUser }
  | { kind: "redirecting" }
  | { kind: "unavailable"; status?: number };

export type SignOutResult =
  | { kind: "success" }
  | { kind: "unavailable"; status?: number };

const readCookie = (name: string): string | null => {
  const match = document.cookie.match(new RegExp(`(?:^|;\\s*)${name}=([^;]+)`));
  if (!match) return null;
  try {
    return decodeURIComponent(match[1]);
  } catch {
    return match[1];
  }
};

const safeReturnTo = (raw: string | undefined): string => {
  if (
    !raw ||
    raw.length > MAX_NEXT_LENGTH ||
    !raw.startsWith("/") ||
    raw.startsWith("//") ||
    raw.includes("\\")
  ) {
    return DEFAULT_AFTER_AUTH;
  }
  try {
    const url = new URL(raw, window.location.origin);
    const pathname = decodeURIComponent(url.pathname);
    if (
      ["/auth", "/api"].some(
        (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
      )
    ) {
      return DEFAULT_AFTER_AUTH;
    }
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
      headers: {
        "Content-Type": "application/json",
        "X-CSRF-Token": token,
      },
      body: JSON.stringify({}),
    });
    if (!response.ok) return { kind: "unavailable", status: response.status };
    return { kind: "success" };
  } catch {
    return { kind: "unavailable" };
  }
}

export async function signOutAndReturn(): Promise<SignOutResult> {
  const result = await signOutCurrentSession();
  if (result.kind === "success") {
    clearMeCache();
    window.location.reload();
  }
  return result;
}
