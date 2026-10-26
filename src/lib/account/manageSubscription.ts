/**
 * Resolves the footer's Manage Subscription destination from the latest
 * `/api/me` response. This keeps the routing rules independent of DOM events
 * and makes them directly testable.
 */
import { SIGN_IN_URL } from "@/lib/account/constants";
import { checkMe } from "@/lib/account/session";
import { buildLocalizedPath, resolveLocaleFromPath } from "@/lib/i18n/config";

const PROVIDERS = ["paypal", "creem", "stripe"] as const;
type Provider = (typeof PROVIDERS)[number];

const isProvider = (value: unknown): value is Provider =>
  PROVIDERS.includes(value as Provider);

const isHttpsUrl = (value: unknown): value is string => {
  if (typeof value !== "string") return false;
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
};

export async function resolveManageSubscriptionUrl(): Promise<string | null> {
  const result = await checkMe({ force: true });
  if (result.kind === "unauthorized") return SIGN_IN_URL;
  if (result.kind !== "authenticated") return null;

  const billing = (result.data as { billing?: unknown }).billing;
  if (!billing || typeof billing !== "object") return null;

  const { provider, cancellationUrls } = billing as {
    provider?: unknown;
    cancellationUrls?: unknown;
  };
  if (provider === null) {
    const locale = resolveLocaleFromPath(window.location.pathname);
    return buildLocalizedPath("/pricing/", locale);
  }
  if (
    !isProvider(provider) ||
    !cancellationUrls ||
    typeof cancellationUrls !== "object"
  ) {
    return null;
  }

  const url = (cancellationUrls as Record<string, unknown>)[provider];
  return isHttpsUrl(url) ? url : null;
}
