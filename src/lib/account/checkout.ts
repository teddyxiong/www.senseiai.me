import { CHECKOUT_URL, PAYPAL_CAPTURE_URL } from "@/lib/account/constants";

export type PaymentProvider = "stripe" | "paypal" | "creem";

export type CheckoutInput = {
  provider: PaymentProvider;
  productId: number;
  idempotencyKey: string;
};

type CheckoutBody = {
  checkoutId: string;
  provider: PaymentProvider;
  productId: number;
  url: string;
};

export type CheckoutResult =
  | {
      kind: "success";
      checkoutId: string;
      provider: PaymentProvider;
      productId: number;
      url: string;
    }
  | { kind: "authenticationRequired" }
  | { kind: "verificationRequired" }
  | { kind: "unavailable"; retryable: boolean; status?: number }
  | { kind: "invalidResponse" };

export type PaypalCaptureResult =
  | { kind: "success"; checkoutId: string }
  | { kind: "authenticationRequired" }
  | { kind: "verificationRequired" }
  | { kind: "unavailable"; retryable: boolean; status?: number }
  | { kind: "invalidResponse" };

// Hosted redirect URL examples from the providers' current official API docs:
// https://docs.stripe.com/api/checkout/sessions#checkout_session_object-url
// https://developer.paypal.com/api/rest/integration/orders-api/api-use-cases/standard/
// https://developer.paypal.com/platforms/subscriptions/integrate/
// https://docs.creem.io/skills/creem-api/REFERENCE#checkouts-api
const CHECKOUT_HOSTS: Record<PaymentProvider, ReadonlySet<string>> = {
  stripe: new Set(["checkout.stripe.com"]),
  paypal: new Set(["www.paypal.com", "www.sandbox.paypal.com"]),
  creem: new Set(["checkout.creem.io"]),
};

const readCookie = (name: string): string | null => {
  const match = document.cookie.match(new RegExp(`(?:^|;\\s*)${name}=([^;]+)`));
  if (!match) return null;
  try {
    return decodeURIComponent(match[1]);
  } catch {
    return match[1];
  }
};

const errorCode = (value: unknown): string | null => {
  if (!value || typeof value !== "object" || !("code" in value)) return null;
  return typeof value.code === "string" ? value.code : null;
};

const isValidCheckoutBody = (
  value: unknown,
  input: CheckoutInput,
): value is CheckoutBody => {
  if (!value || typeof value !== "object") return false;
  const body = value as Record<string, unknown>;
  if (
    typeof body.checkoutId !== "string" ||
    !body.checkoutId ||
    body.provider !== input.provider ||
    body.productId !== input.productId ||
    typeof body.url !== "string"
  )
    return false;
  try {
    const url = new URL(body.url);
    return (
      url.protocol === "https:" &&
      CHECKOUT_HOSTS[input.provider].has(url.hostname)
    );
  } catch {
    return false;
  }
};

export async function createCheckout(
  input: CheckoutInput,
): Promise<CheckoutResult> {
  const csrfToken = readCookie("csrf_token");
  if (!csrfToken) return { kind: "invalidResponse" };

  let response: Response;
  try {
    response = await fetch(CHECKOUT_URL, {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        "Idempotency-Key": input.idempotencyKey,
        "X-CSRF-Token": csrfToken,
      },
      body: JSON.stringify({
        provider: input.provider,
        productId: input.productId,
      }),
    });
  } catch {
    return { kind: "unavailable", retryable: true };
  }

  if (response.status === 401) return { kind: "authenticationRequired" };
  if (response.status >= 500) {
    return { kind: "unavailable", retryable: true, status: response.status };
  }

  let body: unknown;
  try {
    body = await response.json();
  } catch {
    return { kind: "invalidResponse" };
  }
  if (
    response.status === 403 &&
    errorCode(body) === "EMAIL_VERIFICATION_REQUIRED"
  ) {
    return { kind: "verificationRequired" };
  }
  if (!response.ok || !isValidCheckoutBody(body, input)) {
    return { kind: "invalidResponse" };
  }
  return {
    kind: "success",
    checkoutId: body.checkoutId,
    provider: body.provider,
    productId: body.productId,
    url: body.url,
  };
}

export async function capturePaypalCheckout(
  checkoutId: string,
): Promise<PaypalCaptureResult> {
  const csrfToken = readCookie("csrf_token");
  if (!csrfToken || !checkoutId.trim()) return { kind: "invalidResponse" };

  let response: Response;
  try {
    response = await fetch(PAYPAL_CAPTURE_URL, {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        "X-CSRF-Token": csrfToken,
      },
      body: JSON.stringify({ checkoutId: checkoutId.trim() }),
    });
  } catch {
    return { kind: "unavailable", retryable: true };
  }

  if (response.status === 401) return { kind: "authenticationRequired" };
  if (response.status >= 500) {
    return { kind: "unavailable", retryable: true, status: response.status };
  }

  let body: unknown;
  try {
    body = await response.json();
  } catch {
    return { kind: "invalidResponse" };
  }
  if (
    response.status === 403 &&
    errorCode(body) === "EMAIL_VERIFICATION_REQUIRED"
  ) {
    return { kind: "verificationRequired" };
  }
  if (!response.ok || !body || typeof body !== "object") {
    return { kind: "invalidResponse" };
  }
  const capture = body as Record<string, unknown>;
  if (
    capture.checkoutId !== checkoutId.trim() ||
    capture.provider !== "paypal" ||
    capture.status !== "completed"
  ) {
    return { kind: "invalidResponse" };
  }
  return { kind: "success", checkoutId: checkoutId.trim() };
}
