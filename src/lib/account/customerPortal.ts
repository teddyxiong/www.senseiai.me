import { CUSTOMER_PORTAL_URL } from "@/lib/account/constants";

type PortalBody = {
  provider: "stripe" | "creem";
  url: string;
  expiresAt: string | null;
};

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

const isValidPortalBody = (value: unknown): value is PortalBody => {
  if (!value || typeof value !== "object") return false;
  const body = value as Partial<PortalBody>;
  if (body.provider !== "stripe" && body.provider !== "creem") return false;
  if (typeof body.url !== "string") return false;
  try {
    if (new URL(body.url).protocol !== "https:") return false;
  } catch {
    return false;
  }
  return body.expiresAt === null || (
    typeof body.expiresAt === "string" &&
    Number.isFinite(Date.parse(body.expiresAt))
  );
};

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
