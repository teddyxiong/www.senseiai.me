import { capturePaypalCheckout } from "@/lib/account/checkout";
import { checkMe } from "@/lib/account/session";

const PAID_PLANS = new Set([
  "monthly",
  "monthly_one_time",
  "quarterly",
  "quarterly_one_time",
  "annually",
  "annually_one_time",
  "lifetime",
]);

type ActiveState = {
  kind: "active";
  plan: string;
  expiresAt: string | null;
};

export type PaymentSuccessState =
  | ActiveState
  | { kind: "processing" }
  | { kind: "unavailable" };

const readBilling = (
  value: unknown,
): ActiveState | { kind: "processing" } | null => {
  if (!value || typeof value !== "object" || !("billing" in value)) return null;
  const billing = value.billing;
  if (!billing || typeof billing !== "object") return null;
  const record = billing as Record<string, unknown>;
  if (typeof record.plan !== "string") return null;
  if (record.plan === "trial") return { kind: "processing" };
  if (!PAID_PLANS.has(record.plan)) return null;
  if (
    record.expiresAt !== null &&
    (typeof record.expiresAt !== "string" ||
      !Number.isFinite(Date.parse(record.expiresAt)))
  ) {
    return null;
  }
  if (
    record.plan !== "lifetime" &&
    (record.expiresAt === null ||
      Date.parse(record.expiresAt as string) <= Date.now())
  ) {
    return { kind: "processing" };
  }
  return {
    kind: "active",
    plan: record.plan,
    expiresAt: record.expiresAt as string | null,
  };
};

export async function readPaymentEntitlement(): Promise<PaymentSuccessState> {
  const result = await checkMe({ force: true });
  if (result.kind !== "authenticated") return { kind: "unavailable" };
  return readBilling(result.data) ?? { kind: "unavailable" };
}

export async function resolvePaymentSuccess(
  search = window.location.search,
): Promise<PaymentSuccessState> {
  const params = new URLSearchParams(search);
  if (params.get("provider") === "paypal" && params.has("token")) {
    const checkoutId = params.get("checkoutId")?.trim();
    if (!checkoutId) return { kind: "unavailable" };
    const capture = await capturePaypalCheckout(checkoutId);
    if (capture.kind !== "success") return { kind: "unavailable" };
  }
  return readPaymentEntitlement();
}
