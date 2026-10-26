import {
  createCheckout,
  type CheckoutResult,
  type PaymentProvider,
} from "@/lib/account/checkout";
import {
  currentReturnTo,
  redirectToSignIn,
} from "@/lib/account/authFlow";
import {
  isMeCacheFresh,
  readMeCache,
  revalidateMe,
} from "@/lib/account/session";

const PRICING_CHECKOUT_INTENT_KEY = "pricing.checkout.intent.v1";

type PricingSelection = {
  provider: PaymentProvider;
  productId: number;
};

type PricingCheckoutIntent = PricingSelection & {
  returnTo: string;
  idempotencyKey: string;
};

export type PricingCheckoutResult =
  | CheckoutResult
  | { kind: "redirecting" }
  | { kind: "unavailable"; status?: number };

let inFlight: Promise<PricingCheckoutResult> | null = null;
let sessionCheck: Promise<"authenticated" | "anonymous" | "unavailable"> | null = null;

const isSafeReturnTo = (value: unknown): value is string => {
  if (
    typeof value !== "string" ||
    !value.startsWith("/") ||
    value.startsWith("//") ||
    value.includes("\\")
  ) return false;
  try {
    const url = new URL(value, window.location.origin);
    const pathname = decodeURIComponent(url.pathname);
    return !["/auth", "/api"].some(
      (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
    );
  } catch {
    return false;
  }
};

const readIntent = (): PricingCheckoutIntent | null => {
  try {
    const raw = window.sessionStorage.getItem(PRICING_CHECKOUT_INTENT_KEY);
    if (!raw) return null;
    const value = JSON.parse(raw) as Partial<PricingCheckoutIntent>;
    if (
      !["stripe", "paypal", "creem"].includes(String(value.provider)) ||
      !Number.isInteger(value.productId) ||
      Number(value.productId) < 1 ||
      Number(value.productId) > 7 ||
      !isSafeReturnTo(value.returnTo) ||
      typeof value.idempotencyKey !== "string"
    )
      return null;
    return value as PricingCheckoutIntent;
  } catch {
    return null;
  }
};

const writeIntent = (intent: PricingCheckoutIntent) => {
  try {
    window.sessionStorage.setItem(
      PRICING_CHECKOUT_INTENT_KEY,
      JSON.stringify(intent),
    );
  } catch {
    /* sessionStorage 不可用时仍可完成当前支付尝试 */
  }
};

const clearIntent = () => {
  try {
    window.sessionStorage.removeItem(PRICING_CHECKOUT_INTENT_KEY);
  } catch {
    /* sessionStorage 不可用时忽略 */
  }
};

const checkoutContinuePath = (returnTo: string) => {
  const url = new URL("/checkout/continue/", window.location.origin);
  url.searchParams.set("returnTo", returnTo);
  return `${url.pathname}${url.search}`;
};

const redirectToCheckoutSignIn = (intent: PricingCheckoutIntent) => {
  redirectToSignIn(checkoutContinuePath(intent.returnTo));
};

const cachedSessionState = (): "authenticated" | "anonymous" | null => {
  const cached = readMeCache();
  if (!cached || !isMeCacheFresh(cached, Date.now())) return null;
  return cached.authenticated ? "authenticated" : "anonymous";
};

const resolvePricingSession = () => {
  const cached = cachedSessionState();
  if (cached) return Promise.resolve(cached);
  if (sessionCheck) return sessionCheck;

  sessionCheck = revalidateMe()
    .then((result) => {
      if (result.kind === "signedIn") return "authenticated" as const;
      if (result.kind === "signedOut") return "anonymous" as const;
      return "unavailable" as const;
    })
    .finally(() => {
      sessionCheck = null;
    });
  return sessionCheck;
};

export const preloadPricingSession = () => {
  void resolvePricingSession();
};

export const getPricingCheckoutReturnTo = () => readIntent()?.returnTo ?? null;

export const cancelPricingCheckout = () => {
  clearIntent();
};

const runCheckout = async (
  intent: PricingCheckoutIntent,
  options: { resume?: boolean } = {},
): Promise<PricingCheckoutResult> => {
  if (!options.resume) {
    const session = await resolvePricingSession();
    if (session === "anonymous") {
      redirectToCheckoutSignIn(intent);
      return { kind: "redirecting" };
    }
    if (session === "unavailable") return { kind: "unavailable" };
  }

  const result = await createCheckout(intent);
  if (result.kind === "authenticationRequired") {
    redirectToCheckoutSignIn(intent);
    return { kind: "redirecting" };
  }
  if (result.kind === "success") {
    clearIntent();
    window.location.assign(result.url);
  }
  return result;
};

const beginIntent = (
  intent: PricingCheckoutIntent,
  options: { resume?: boolean } = {},
) => {
  if (inFlight) return inFlight;
  writeIntent(intent);
  inFlight = runCheckout(intent, options).finally(() => {
    inFlight = null;
  });
  return inFlight;
};

export const startPricingCheckout = (
  selection: PricingSelection,
): Promise<PricingCheckoutResult> => {
  const pending = readIntent();
  const intent =
    pending?.provider === selection.provider &&
    pending.productId === selection.productId
      ? pending
      : {
          ...selection,
          returnTo: currentReturnTo(),
          idempotencyKey: globalThis.crypto.randomUUID(),
        };
  return beginIntent(intent);
};

export const resumePricingCheckout =
  (): Promise<PricingCheckoutResult> | null => {
    const pending = readIntent();
    return pending ? beginIntent(pending, { resume: true }) : null;
  };
