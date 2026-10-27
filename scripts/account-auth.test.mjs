import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import test from "node:test";
import { build } from "esbuild";

async function loadAccountModule(
  entry,
  { dev = false, publicDevAuth } = {},
) {
  const result = await build({
    entryPoints: [entry],
    bundle: true,
    format: "esm",
    platform: "browser",
    write: false,
    alias: { "@": resolve("src") },
    define: {
      "import.meta.env.DEV": JSON.stringify(dev),
      "import.meta.env.PUBLIC_ACCOUNT_DEV_AUTH":
        publicDevAuth === undefined ? "undefined" : JSON.stringify(publicDevAuth),
      "import.meta.env.PUBLIC_ACCOUNT_DEV_USER": "undefined",
    },
  });
  const source = result.outputFiles[0].text;
  return import(
    `data:text/javascript;base64,${Buffer.from(source).toString("base64")}#${randomUUID()}`
  );
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

const jsonResponse = (status, body) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

test("checkMe accepts authenticated responses without sessionExpiresAt", async () => {
  installBrowser();
  globalThis.fetch = async () =>
    jsonResponse(200, {
      authenticated: true,
      user: { id: "u1", email: "u@example.com" },
    });
  const { checkMe } = await loadAccountModule("src/lib/account/session.ts");
  assert.equal((await checkMe({ force: true })).kind, "authenticated");
});

test("DEV mode defaults to authenticated despite a stale local sign-out", async () => {
  installBrowser();
  window.localStorage.setItem("account.dev.authenticated", "0");
  let fetchCalls = 0;
  globalThis.fetch = async () => {
    fetchCalls += 1;
    return jsonResponse(401, { authenticated: false });
  };

  const { checkMe } = await loadAccountModule("src/lib/account/session.ts", {
    dev: true,
  });

  assert.equal((await checkMe({ force: true })).kind, "authenticated");
  assert.equal(fetchCalls, 0);
});

test("checkMe separates 401, 503, invalid payload, and forced offline attempts", async () => {
  installBrowser();
  globalThis.fetch = async () => jsonResponse(401, { authenticated: false });
  let session = await loadAccountModule("src/lib/account/session.ts");
  assert.deepEqual(await session.checkMe({ force: true }), {
    kind: "unauthorized",
  });

  installBrowser();
  globalThis.fetch = async () =>
    jsonResponse(503, { code: "BILLING_UNAVAILABLE" });
  session = await loadAccountModule("src/lib/account/session.ts");
  assert.deepEqual(await session.checkMe({ force: true }), {
    kind: "unavailable",
    status: 503,
  });

  installBrowser();
  globalThis.fetch = async () =>
    jsonResponse(200, { authenticated: true, user: {} });
  session = await loadAccountModule("src/lib/account/session.ts");
  assert.deepEqual(await session.checkMe({ force: true }), {
    kind: "invalidResponse",
  });

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

test("AccountNav revalidates a fresh anonymous cache so sign-in can recover", async () => {
  const source = await readFile("src/layouts/helpers/AccountNav.tsx", "utf8");

  assert.match(
    source,
    /if \(cached\?\.authenticated && isMeCacheFresh\(cached, Date\.now\(\)\)\) return;/,
  );
  assert.doesNotMatch(
    source,
    /if \(cached && isMeCacheFresh\(cached, Date\.now\(\)\)\) return;/,
  );
});

test("buildSignInUrl preserves pathname, query, and hash", async () => {
  installBrowser();
  const { currentReturnTo, buildSignInUrl } = await loadAccountModule(
    "src/lib/account/authFlow.ts",
  );
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
    new URL(buildSignInUrl("/" + "a".repeat(2047))).searchParams.get("next")
      ?.length,
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
    sessionSeed: {
      "account.me.v1": JSON.stringify({ ts: Date.now(), authenticated: false }),
    },
  });
  window.location.assign = (url) => assigned.push(url);
  globalThis.fetch = async () => jsonResponse(401, { authenticated: false });
  let authFlow = await loadAccountModule("src/lib/account/authFlow.ts");
  assert.deepEqual(await authFlow.requireAuthenticated(), {
    kind: "redirecting",
  });
  assert.equal(sessionStorage.getItem("account.me.v1"), null);
  assert.equal(assigned.length, 1);
  assert.equal(
    new URL(assigned[0]).searchParams.get("next"),
    "/pricing/?source=header#plans",
  );

  installBrowser();
  const unavailableAssignments = [];
  window.location.assign = (url) => unavailableAssignments.push(url);
  globalThis.fetch = async () =>
    jsonResponse(503, { code: "BILLING_UNAVAILABLE" });
  authFlow = await loadAccountModule("src/lib/account/authFlow.ts");
  assert.deepEqual(await authFlow.requireAuthenticated(), {
    kind: "unavailable",
    status: 503,
  });
  assert.deepEqual(unavailableAssignments, []);
});

test("resolveManageSubscriptionUrl routes anonymous users and provider-less users", async () => {
  installBrowser();
  globalThis.fetch = async () => jsonResponse(401, { authenticated: false });
  let subscription = await loadAccountModule(
    "src/lib/account/manageSubscription.ts",
  );
  assert.equal(
    await subscription.resolveManageSubscriptionUrl(),
    "https://www.senseiai.me/auth/sign-in",
  );

  installBrowser();
  window.location.pathname = "/ja/features/";
  globalThis.fetch = async () =>
    jsonResponse(200, {
      authenticated: true,
      user: { id: "u1", email: "u@example.com" },
      sessionExpiresAt: "2026-12-01T00:00:00.000Z",
      billing: {
        plan: "trial",
        canceled: false,
        provider: null,
        expiresAt: null,
        cancellationUrls: {
          paypal: "https://www.paypal.com/billing/subscriptions",
          creem: "https://www.creem.io/my-orders/login",
          stripe: "https://billing.stripe.com/p/login/example",
        },
      },
    });
  subscription = await loadAccountModule(
    "src/lib/account/manageSubscription.ts",
  );
  assert.equal(
    await subscription.resolveManageSubscriptionUrl(),
    "/ja/pricing/",
  );
});

test("resolveManageSubscriptionUrl uses only the authenticated provider's HTTPS URL", async () => {
  const urls = {
    paypal: "https://www.paypal.com/billing/subscriptions",
    creem: "https://www.creem.io/my-orders/login",
    stripe: "https://billing.stripe.com/p/login/example",
  };

  for (const provider of ["paypal", "creem", "stripe"]) {
    installBrowser();
    globalThis.fetch = async () =>
      jsonResponse(200, {
        authenticated: true,
        user: { id: "u1", email: "u@example.com" },
        billing: {
          plan: "monthly",
          canceled: false,
          provider,
          expiresAt: null,
          cancellationUrls: urls,
        },
      });
    const subscription = await loadAccountModule(
      "src/lib/account/manageSubscription.ts",
    );
    assert.equal(
      await subscription.resolveManageSubscriptionUrl(),
      urls[provider],
    );
  }

  installBrowser();
  globalThis.fetch = async () =>
    jsonResponse(200, {
      authenticated: true,
      user: { id: "u1", email: "u@example.com" },
      billing: {
        plan: "monthly",
        canceled: false,
        provider: "stripe",
        expiresAt: null,
        cancellationUrls: { ...urls, stripe: "javascript:alert(1)" },
      },
    });
  const subscription = await loadAccountModule(
    "src/lib/account/manageSubscription.ts",
  );
  assert.equal(await subscription.resolveManageSubscriptionUrl(), null);
});

test("manage subscription click handling runs before Astro client routing", async () => {
  installBrowser();
  const registrations = [];
  globalThis.document = {
    addEventListener: (type, _listener, options) => {
      registrations.push({
        type,
        capture: options === true || options?.capture === true,
      });
    },
  };

  await loadAccountModule("src/lib/account/manageSubscriptionClient.ts");

  assert.deepEqual(registrations, [{ type: "click", capture: true }]);
});

test("signOutAndReturn sends the JSON sign-out contract, clears cache, and reloads the current page", async () => {
  const { sessionStorage } = installBrowser({
    sessionSeed: { "account.me.v1": "cached" },
  });
  const assigned = [];
  window.location.assign = (url) => assigned.push(url);
  let reloads = 0;
  window.location.reload = () => {
    reloads += 1;
  };
  let cookie = "";
  globalThis.document = {
    get cookie() {
      return cookie;
    },
  };
  const requests = [];
  globalThis.fetch = async (url, init = {}) => {
    requests.push({ url: String(url), init });
    if (requests.length === 1) {
      cookie = "csrf_token=seeded";
      return jsonResponse(401, { authenticated: false });
    }
    return new Response(null, { status: 204 });
  };
  const { signOutAndReturn } = await loadAccountModule(
    "src/lib/account/authFlow.ts",
  );
  assert.deepEqual(await signOutAndReturn(), { kind: "success" });
  assert.equal(requests[0].init.credentials, "include");
  assert.equal(requests[1].init.method, "POST");
  assert.equal(requests[1].init.credentials, "include");
  assert.equal(requests[1].init.headers["X-CSRF-Token"], "seeded");
  assert.equal(requests[1].init.headers["Content-Type"], "application/json");
  assert.equal(requests[1].init.body, JSON.stringify({}));
  assert.equal(sessionStorage.getItem("account.me.v1"), null);
  assert.deepEqual(sessionStorage.removed, ["account.me.v1"]);
  assert.deepEqual(assigned, []);
  assert.equal(reloads, 1);
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
    const { signOutAndReturn } = await loadAccountModule(
      "src/lib/account/authFlow.ts",
    );
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
  window.location.reload = () => {
    reloads += 1;
  };
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

  globalThis.fetch = async () =>
    jsonResponse(200, {
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
  assert.deepEqual(await createCustomerPortal(), {
    kind: "authenticationRequired",
  });

  globalThis.fetch = async () =>
    jsonResponse(404, { code: "NO_MANAGEABLE_SUBSCRIPTION" });
  assert.deepEqual(await createCustomerPortal(), {
    kind: "noManageableSubscription",
  });

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
    globalThis.fetch = async () =>
      new Response("<html>upstream unavailable</html>", {
        status,
        headers: { "Content-Type": "text/html" },
      });
    assert.deepEqual(await createCustomerPortal(), {
      kind: "unavailable",
      retryable: true,
    });
  }

  globalThis.fetch = async () =>
    jsonResponse(200, {
      provider: "stripe",
      url: "http://unsafe.example/portal",
      expiresAt: null,
    });
  assert.deepEqual(await createCustomerPortal(), { kind: "invalidResponse" });
  assert.deepEqual(assigned, []);
  assert.equal(window.sessionStorage.getItem("account.me.v1"), "cached");
});

test("createCheckout sends the trusted purchase request and accepts an official HTTPS URL", async () => {
  installBrowser();
  globalThis.document = { cookie: "theme=dark; csrf_token=checkout-csrf" };
  const requests = [];
  globalThis.fetch = async (url, init = {}) => {
    requests.push({ url: String(url), init });
    return jsonResponse(200, {
      checkoutId: "checkout-1",
      provider: "stripe",
      productId: 1,
      url: "https://checkout.stripe.com/c/pay/cs_live_example",
    });
  };
  const { createCheckout } = await loadAccountModule(
    "src/lib/account/checkout.ts",
  );
  const idempotencyKey = "0199aeda-f9e1-7d6b-b811-e265f8493296";

  assert.deepEqual(
    await createCheckout({
      provider: "stripe",
      productId: 1,
      idempotencyKey,
    }),
    {
      kind: "success",
      checkoutId: "checkout-1",
      provider: "stripe",
      productId: 1,
      url: "https://checkout.stripe.com/c/pay/cs_live_example",
    },
  );
  assert.equal(requests.length, 1);
  assert.equal(requests[0].url, "https://www.senseiai.me/api/billing/checkout");
  assert.equal(requests[0].init.method, "POST");
  assert.equal(requests[0].init.credentials, "include");
  assert.deepEqual(requests[0].init.headers, {
    "Content-Type": "application/json",
    "Idempotency-Key": idempotencyKey,
    "X-CSRF-Token": "checkout-csrf",
  });
  assert.equal(
    requests[0].init.body,
    JSON.stringify({ provider: "stripe", productId: 1 }),
  );
});

test("createCheckout classifies failures and rejects untrusted payment URLs", async () => {
  installBrowser();
  globalThis.document = { cookie: "csrf_token=checkout-csrf" };
  const { createCheckout } = await loadAccountModule(
    "src/lib/account/checkout.ts",
  );
  const input = {
    provider: "paypal",
    productId: 4,
    idempotencyKey: "0199aeda-f9e1-7d6b-b811-e265f8493296",
  };

  globalThis.fetch = async () =>
    jsonResponse(401, { code: "AUTHENTICATION_REQUIRED" });
  assert.deepEqual(await createCheckout(input), {
    kind: "authenticationRequired",
  });

  globalThis.fetch = async () =>
    jsonResponse(403, { code: "EMAIL_VERIFICATION_REQUIRED" });
  assert.deepEqual(await createCheckout(input), {
    kind: "verificationRequired",
  });

  globalThis.fetch = async () =>
    jsonResponse(503, { code: "PAYMENT_PROVIDER_UNAVAILABLE" });
  assert.deepEqual(await createCheckout(input), {
    kind: "unavailable",
    retryable: true,
    status: 503,
  });

  globalThis.fetch = async () => {
    throw new Error("offline");
  };
  assert.deepEqual(await createCheckout(input), {
    kind: "unavailable",
    retryable: true,
  });

  globalThis.fetch = async () =>
    jsonResponse(200, {
      checkoutId: "checkout-evil",
      provider: "paypal",
      productId: 4,
      url: "https://paypal.com.attacker.example/checkoutnow?token=ORDER-1",
    });
  assert.deepEqual(await createCheckout(input), { kind: "invalidResponse" });
});

test("startPricingCheckout uses a fresh signed-in session and reuses one idempotency key", async () => {
  installBrowser({
    sessionSeed: {
      "account.me.v1": JSON.stringify({
        ts: Date.now(),
        authenticated: true,
        user: { id: "u1", email: "buyer@example.com" },
      }),
    },
  });
  globalThis.document = { cookie: "csrf_token=checkout-csrf" };
  const assigned = [];
  window.location.assign = (url) => assigned.push(url);
  const requests = [];
  globalThis.fetch = async (url, init = {}) => {
    requests.push({ url: String(url), init });
    if (String(url).endsWith("/api/me")) {
      return jsonResponse(200, {
        authenticated: true,
        user: { id: "u1", email: "buyer@example.com", emailVerified: true },
      });
    }
    return jsonResponse(200, {
      checkoutId: "checkout-pricing-1",
      provider: "stripe",
      productId: 1,
      url: "https://checkout.stripe.com/c/pay/cs_live_pricing",
    });
  };
  const { startPricingCheckout } = await loadAccountModule(
    "src/lib/account/pricingCheckout.ts",
  );

  const [first, repeated] = await Promise.all([
    startPricingCheckout({ provider: "stripe", productId: 1 }),
    startPricingCheckout({ provider: "stripe", productId: 1 }),
  ]);

  assert.equal(first.kind, "success");
  assert.deepEqual(repeated, first);
  assert.equal(requests.filter(({ url }) => url.endsWith("/api/me")).length, 0);
  const checkoutRequests = requests.filter(({ url }) =>
    url.endsWith("/api/billing/checkout"),
  );
  assert.equal(checkoutRequests.length, 1);
  assert.match(
    checkoutRequests[0].init.headers["Idempotency-Key"],
    /^[0-9a-f-]{36}$/,
  );
  assert.equal(
    checkoutRequests[0].init.body,
    JSON.stringify({ provider: "stripe", productId: 1 }),
  );
  assert.deepEqual(assigned, [
    "https://checkout.stripe.com/c/pay/cs_live_pricing",
  ]);
});

test("startPricingCheckout sends signed-out users through checkout continuation", async () => {
  const { sessionStorage } = installBrowser({
    sessionSeed: {
      "account.me.v1": JSON.stringify({ ts: Date.now(), authenticated: false }),
    },
  });
  globalThis.document = { cookie: "csrf_token=checkout-csrf" };
  const assigned = [];
  window.location.assign = (url) => assigned.push(url);
  const requests = [];
  globalThis.fetch = async (url) => {
    requests.push(String(url));
    return jsonResponse(401, { authenticated: false });
  };
  let pricingCheckout = await loadAccountModule(
    "src/lib/account/pricingCheckout.ts",
  );

  assert.deepEqual(
    await pricingCheckout.startPricingCheckout({
      provider: "paypal",
      productId: 4,
    }),
    { kind: "redirecting" },
  );
  assert.equal(assigned.length, 1);
  assert.equal(
    new URL(assigned[0]).searchParams.get("next"),
    "/checkout/continue/?returnTo=%2Fpricing%2F%3Fsource%3Dheader%23plans",
  );
  assert.deepEqual(requests, []);
  const pendingIntent = JSON.parse(
    sessionStorage.getItem("pricing.checkout.intent.v1"),
  );
  assert.deepEqual(
    {
      provider: pendingIntent.provider,
      productId: pendingIntent.productId,
      returnTo: pendingIntent.returnTo,
    },
    {
      provider: "paypal",
      productId: 4,
      returnTo: "/pricing/?source=header#plans",
    },
  );
  assert.match(pendingIntent.idempotencyKey, /^[0-9a-f-]{36}$/);

  assigned.length = 0;
  requests.length = 0;
  globalThis.fetch = async (url) => {
    requests.push(String(url));
    return jsonResponse(503, { code: "BILLING_UNAVAILABLE" });
  };
  pricingCheckout = await loadAccountModule(
    "src/lib/account/pricingCheckout.ts",
  );
  assert.deepEqual(await pricingCheckout.resumePricingCheckout(), {
    kind: "unavailable",
    retryable: true,
    status: 503,
  });
  assert.deepEqual(requests, ["https://www.senseiai.me/api/billing/checkout"]);
  assert.deepEqual(assigned, []);
  assert.equal(
    pricingCheckout.getPricingCheckoutReturnTo(),
    "/pricing/?source=header#plans",
  );
  pricingCheckout.cancelPricingCheckout();
  assert.equal(sessionStorage.getItem("pricing.checkout.intent.v1"), null);
  sessionStorage.setItem(
    "pricing.checkout.intent.v1",
    JSON.stringify({
      provider: "paypal",
      productId: 4,
      returnTo: "https://attacker.example/checkout",
      idempotencyKey: "0199aeda-f9e1-7d6b-b811-e265f8493296",
    }),
  );
  assert.equal(pricingCheckout.getPricingCheckoutReturnTo(), null);
});

test("payment success captures a PayPal order before trusting /api/me entitlement", async () => {
  installBrowser();
  globalThis.document = { cookie: "csrf_token=paypal-capture-csrf" };
  const requests = [];
  globalThis.fetch = async (url, init = {}) => {
    requests.push({ url: String(url), init });
    if (String(url).endsWith("/api/billing/checkout/paypal/capture")) {
      return jsonResponse(200, {
        checkoutId: "checkout-paypal-1",
        provider: "paypal",
        status: "completed",
      });
    }
    return jsonResponse(200, {
      authenticated: true,
      user: { id: "u1", email: "buyer@example.com", emailVerified: true },
      billing: {
        plan: "monthly_one_time",
        canceled: false,
        provider: "paypal",
        expiresAt: "2099-10-22T00:00:00.000Z",
        cancellationUrls: { paypal: "", stripe: "", creem: "" },
      },
    });
  };

  const { resolvePaymentSuccess } = await loadAccountModule(
    "src/lib/account/paymentSuccess.ts",
  );
  assert.deepEqual(
    await resolvePaymentSuccess(
      "?provider=paypal&checkoutId=checkout-paypal-1&token=ORDER-1&PayerID=PAYER-1",
    ),
    {
      kind: "active",
      plan: "monthly_one_time",
      expiresAt: "2099-10-22T00:00:00.000Z",
    },
  );
  assert.equal(requests.length, 2);
  assert.equal(
    requests[0].url,
    "https://www.senseiai.me/api/billing/checkout/paypal/capture",
  );
  assert.equal(requests[0].init.method, "POST");
  assert.equal(requests[0].init.credentials, "include");
  assert.deepEqual(requests[0].init.headers, {
    "Content-Type": "application/json",
    "X-CSRF-Token": "paypal-capture-csrf",
  });
  assert.equal(
    requests[0].init.body,
    JSON.stringify({ checkoutId: "checkout-paypal-1" }),
  );
  assert.equal(requests[1].url, "https://www.senseiai.me/api/me");
});
