# Locale Preference Cookie Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans (recommended) or superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Persist Linkjob's last explicitly effective website language in a one-year first-party cookie and document the contract for future consumers without changing Dashboard, Auth, or `/checkout/continue/`.

**Architecture:** A focused `localePreference` module owns validation and cookie serialization using `i18n.config.json` through the existing i18n configuration module. The shared Linkjob layout records only explicit non-default URL prefixes, while the existing language switcher records successful selections and the actual English fallback. Consumers remain decoupled and integrate later through the documented `linkjob_locale` cookie contract.

**Tech Stack:** Astro 5, TypeScript, browser cookies, Node's built-in test runner, esbuild test bundling.

**Spec:** `docs/superpowers/specs/2026-09-25-locale-preference-cookie-design.md`

## Global Constraints

- Cookie name is exactly `linkjob_locale`.
- Cookie path is `/`, lifetime is `Max-Age=31536000`, and `SameSite=Lax`.
- Add `Secure` on HTTPS and omit it for local HTTP development.
- Do not set `Domain` or `HttpOnly`.
- Values are canonical lowercase locales from Linkjob's published locale set; `i18n.config.json` remains the Linkjob source of truth.
- Explicit supported URL locale takes precedence over cookie; valid cookie takes precedence over `defaultLocale`.
- Unprefixed paths do not automatically write `en`.
- Do not modify Auth, Dashboard, Billing, product mappings, or `/checkout/continue/`.
- Create `LANGUAGE_PREFERENCE_COOKIE.html` in the Linkjob repository root.
- Do not add dependencies, test frameworks, automatic redirects, database state, or deployment steps.
- All new user-visible UI text remains English; the root integration guide may explain the contract in Chinese with English identifiers and code examples.

## Review Focus

- A tampered cookie such as `zh-Hant`, an unsupported locale, or malformed encoding resolves to no preference and is never copied into a URL; Task 1's invalid-cookie test covers this.
- An unprefixed workflow path such as `/checkout/continue/` does not overwrite an existing locale; Task 1's path-persistence test covers this.
- HTTPS writes include `Secure`, while local HTTP writes do not; Task 1's cookie-attribute test covers this.
- A failed locale target probe records the actual English fallback, not the attempted locale; Task 2's focused browser verification covers this existing Astro-script integration without adding a browser-test framework.
- Modified/new-tab language-link clicks retain native behavior and are not intercepted; Task 2 preserves the existing `shouldSkipLocaleIntercept` guard and checks it during diff review.

---

### Task 1: Locale Preference Cookie Module

**Files:**
- Create: `src/lib/i18n/localePreference.ts`
- Create: `scripts/i18n-locale-preference.test.mjs`

**Interfaces:**
- Consumes: `DEFAULT_LOCALE` and `PUBLISHED_LOCALES` from `src/lib/i18n/config.ts`.
- Produces: `readLocalePreference(): string | null`, `writeLocalePreference(locale: string): boolean`, and `rememberExplicitLocaleFromPath(pathname: string): boolean`.

- [ ] **Step 1: Write the two focused failing tests**

Create `scripts/i18n-locale-preference.test.mjs` using the existing esbuild-based module loader pattern from `scripts/account-auth.test.mjs`. Use a small cookie jar fake whose setter keeps only the `name=value` pair, as a browser's `document.cookie` getter does.

```js
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { resolve } from "node:path";
import test from "node:test";
import { build } from "esbuild";

async function loadLocaleModule() {
  const result = await build({
    entryPoints: ["src/lib/i18n/localePreference.ts"],
    bundle: true,
    format: "esm",
    platform: "browser",
    write: false,
    alias: { "@": resolve("src") },
  });
  const source = result.outputFiles[0].text;
  return import(`data:text/javascript;base64,${Buffer.from(source).toString("base64")}#${randomUUID()}`);
}

function installCookieBrowser({ protocol = "https:", cookie = "" } = {}) {
  let jar = cookie;
  let lastWrite = "";
  globalThis.window = { location: { protocol } };
  globalThis.document = {
    get cookie() { return jar; },
    set cookie(value) {
      lastWrite = String(value);
      jar = String(value).split(";", 1)[0];
    },
  };
  return { get jar() { return jar; }, get lastWrite() { return lastWrite; } };
}

test("locale preference persists published locales and explicit localized paths", async () => {
  const browser = installCookieBrowser();
  const locale = await loadLocaleModule();

  assert.equal(locale.writeLocalePreference("fr"), true);
  assert.equal(locale.readLocalePreference(), "fr");
  assert.match(browser.lastWrite, /^linkjob_locale=fr; Path=\/; Max-Age=31536000; SameSite=Lax; Secure$/);

  assert.equal(locale.rememberExplicitLocaleFromPath("/ja/pricing/"), true);
  assert.equal(locale.readLocalePreference(), "ja");
  assert.equal(locale.rememberExplicitLocaleFromPath("/checkout/continue/"), false);
  assert.equal(locale.readLocalePreference(), "ja");

  const httpBrowser = installCookieBrowser({ protocol: "http:" });
  assert.equal(locale.writeLocalePreference("en"), true);
  assert.doesNotMatch(httpBrowser.lastWrite, /Secure/);
});

test("locale preference rejects malformed, incorrectly cased, and unsupported values", async () => {
  const browser = installCookieBrowser({ cookie: "linkjob_locale=zh-Hant" });
  const locale = await loadLocaleModule();

  assert.equal(locale.readLocalePreference(), null);
  assert.equal(locale.writeLocalePreference("zh-Hant"), false);
  assert.equal(locale.writeLocalePreference("xx"), false);
  assert.equal(browser.lastWrite, "");

  installCookieBrowser({ cookie: "linkjob_locale=%E0%A4%A" });
  assert.equal(locale.readLocalePreference(), null);
});
```

- [ ] **Step 2: Run the test and verify RED**

Run:

```bash
node --test scripts/i18n-locale-preference.test.mjs
```

Expected: FAIL because `src/lib/i18n/localePreference.ts` does not exist.

- [ ] **Step 3: Implement the minimal cookie module**

Create `src/lib/i18n/localePreference.ts`:

```ts
import {
  DEFAULT_LOCALE,
  PUBLISHED_LOCALES,
} from "@/lib/i18n/config";

const COOKIE_NAME = "linkjob_locale";
const COOKIE_MAX_AGE = 31_536_000;
const publishedLocales = new Set(PUBLISHED_LOCALES);

const isPublishedLocale = (value: string): boolean =>
  publishedLocales.has(value);

export function readLocalePreference(): string | null {
  const entry = document.cookie
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${COOKIE_NAME}=`));
  if (!entry) return null;
  try {
    const value = decodeURIComponent(entry.slice(COOKIE_NAME.length + 1));
    return isPublishedLocale(value) ? value : null;
  } catch {
    return null;
  }
}

export function writeLocalePreference(locale: string): boolean {
  if (!isPublishedLocale(locale)) return false;
  const secure = window.location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `${COOKIE_NAME}=${encodeURIComponent(locale)}; Path=/; Max-Age=${COOKIE_MAX_AGE}; SameSite=Lax${secure}`;
  return true;
}

export function rememberExplicitLocaleFromPath(pathname: string): boolean {
  const segment = pathname.split("/").filter(Boolean)[0];
  if (!segment || segment === DEFAULT_LOCALE || !isPublishedLocale(segment)) {
    return false;
  }
  return writeLocalePreference(segment);
}
```

- [ ] **Step 4: Run the focused test and verify GREEN**

Run:

```bash
node --test scripts/i18n-locale-preference.test.mjs
```

Expected: 2 tests pass, 0 fail.

- [ ] **Step 5: Check the module diff and commit the slice**

Run:

```bash
git diff --check
git add src/lib/i18n/localePreference.ts scripts/i18n-locale-preference.test.mjs
git commit -m "feat: persist locale preference in a cookie"
```

### Task 2: Record Effective Locale in Linkjob Navigation

**Files:**
- Modify: `src/layouts/Base.astro:271-284`
- Modify: `src/layouts/partials/Header.astro:48-52, 115-128, 282-295, 335-348, 499-546`
- Test: `scripts/i18n-locale-preference.test.mjs`

**Interfaces:**
- Consumes: `rememberExplicitLocaleFromPath(pathname: string): boolean` and `writeLocalePreference(locale: string): boolean` from Task 1.
- Produces: automatic persistence for explicit non-default URL prefixes and normal language-switch persistence for successful targets or English fallback.

- [ ] **Step 1: Extend the focused test with the default-locale contract**

Add these assertions to the first Task 1 test before the local HTTP assertion:

```js
assert.equal(locale.rememberExplicitLocaleFromPath("/pricing/"), false);
assert.equal(locale.readLocalePreference(), "ja");
assert.equal(locale.writeLocalePreference("en"), true);
assert.equal(locale.readLocalePreference(), "en");
```

This locks the rule that an unprefixed page does not overwrite the cookie, while an explicit English switch can store `en`.

- [ ] **Step 2: Run the focused test and confirm it remains GREEN before wiring callers**

Run:

```bash
node --test scripts/i18n-locale-preference.test.mjs
```

Expected: 2 tests pass, proving the module interface is ready for the layout and switcher callers.

- [ ] **Step 3: Wire explicit path persistence into the shared layout**

In the existing client script in `src/layouts/Base.astro`, import the Task 1 function and invoke it on the initial page and Astro page loads:

```ts
import { rememberExplicitLocaleFromPath } from "@/lib/i18n/localePreference";

function rememberPageLocale() {
  rememberExplicitLocaleFromPath(window.location.pathname);
}

rememberPageLocale();
document.addEventListener("astro:page-load", rememberPageLocale);
```

Keep the existing AOS and manage-subscription initialization unchanged.

- [ ] **Step 4: Give every switcher link its canonical locale**

For each of the three existing `.js-locale-switch-link` anchor renderings in `src/layouts/partials/Header.astro`, add:

```astro
data-locale={locale}
```

Add the configured default to the existing `<header>` element:

```astro
data-default-locale={DEFAULT_LOCALE}
```

- [ ] **Step 5: Persist the actual switch outcome**

At the top of Header's client script, import:

```ts
import { writeLocalePreference } from "@/lib/i18n/localePreference";
```

Inside the existing normal-click handler, read validated source values from the rendered data attributes:

```ts
const targetLocale = link.dataset.locale;
const header = document.querySelector<HTMLElement>("header.header");
const defaultLocale = header?.dataset.defaultLocale;
```

Immediately before successful target navigation, write the target locale:

```ts
if (targetLocale) writeLocalePreference(targetLocale);
window.location.href = targetUrl.toString();
```

Immediately before English fallback navigation, write the configured default:

```ts
if (defaultLocale) writeLocalePreference(defaultLocale);
window.location.href = fallbackUrl.toString();
```

Do not move the existing `shouldSkipLocaleIntercept` check; modified clicks and `_blank` links must retain native behavior.

- [ ] **Step 6: Run focused and existing tests**

Run:

```bash
node --test scripts/i18n-locale-preference.test.mjs
npm run test:account
```

Expected: locale tests 2/2 pass and the full existing account suite passes with 0 failures.

- [ ] **Step 7: Build locally without invoking R2 synchronization**

Run:

```bash
ASTRO_BASE=/ node --max-old-space-size=8192 ./node_modules/.bin/astro build
```

Expected: exit code 0 and generated localized-link client code. Existing remote image/RSS or PostCSS warnings may be reported but must not cause build failure.

- [ ] **Step 8: Perform focused browser verification**

Serve `dist/` locally and verify with an isolated/system Chrome profile:

1. Load an explicit localized page such as `/fr/` and confirm `linkjob_locale=fr`; rely on the focused serialization test for the exact `Path`, max-age, `SameSite`, and HTTPS `Secure` attributes because the local static server uses HTTP.
2. Load an unprefixed route and confirm it does not overwrite an existing `fr` value.
3. Exercise a normal language-switch target and confirm the selected locale is recorded immediately before navigation.
4. Confirm no new console errors.

Do not use a production login session and do not call deployment commands.

- [ ] **Step 9: Commit the navigation wiring**

Run:

```bash
git diff --check
git add src/layouts/Base.astro src/layouts/partials/Header.astro scripts/i18n-locale-preference.test.mjs
git commit -m "feat: remember effective site language"
```

### Task 3: Consumer Integration HTML Guide

**Files:**
- Create: `LANGUAGE_PREFERENCE_COOKIE.html`

**Interfaces:**
- Consumes: the exact `linkjob_locale` contract implemented by Tasks 1 and 2.
- Produces: a standalone human-readable integration guide for Dashboard and future consumers; no runtime code consumes this file.

- [ ] **Step 1: Create the standalone root HTML guide**

Create `LANGUAGE_PREFERENCE_COOKIE.html` with semantic HTML and embedded CSS only. It must include these sections and exact facts:

```html
<h1>Linkjob Language Preference Cookie</h1>
<section id="contract">...</section>
<section id="write-rules">...</section>
<section id="consumer-example">...</section>
<section id="dashboard-known-issues">...</section>
<section id="checkout-continuation">...</section>
<section id="non-goals">...</section>
```

The consumer example must validate against its own supported set before constructing a URL:

```js
const COOKIE_NAME = "linkjob_locale";
const SUPPORTED_LOCALES = new Set(["en", "fr", "ja", "zh-hant"]);

function readPreferredLocale(cookie = document.cookie) {
  const entry = cookie.split(";").map((part) => part.trim())
    .find((part) => part.startsWith(`${COOKIE_NAME}=`));
  if (!entry) return "en";
  try {
    const value = decodeURIComponent(entry.slice(COOKIE_NAME.length + 1));
    return SUPPORTED_LOCALES.has(value) ? value : "en";
  } catch {
    return "en";
  }
}

function buildMainSiteUrl(path, locale = readPreferredLocale()) {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  const prefix = locale === "en" ? "" : `/${encodeURIComponent(locale)}`;
  return `https://www.senseiai.me${prefix}${normalizedPath}`;
}
```

Document these current Dashboard issues without changing them:

- Dashboard is served from Auth at `/dashboard/`, so its pathname has no public-site locale.
- `public/dashboard/sidebar.js` incorrectly derives locale from the Dashboard pathname.
- Dashboard uses `zh-Hant`, while Linkjob's canonical locale is `zh-hant`.
- Home, Pricing, Downloads, logo, plan, and provider-less subscription links include fixed English destinations.
- Dashboard does not yet read `linkjob_locale`.

Document this deferred checkout issue without changing it:

- `/checkout/continue/` currently falls back to `/pricing/` when the pending checkout return destination is unavailable, so that fallback can lose the stored locale.

- [ ] **Step 2: Validate the guide and scope**

Open the HTML file directly in a browser and confirm:

- It renders without external assets or console errors.
- The cookie attributes and code example match the implementation exactly.
- The Dashboard and checkout items are explicitly labeled as known, unresolved consumer issues.
- It contains no secrets, tokens, deployment instructions, or claims that Dashboard is already fixed.

Run:

```bash
git diff --check
git status --short
```

Expected: only the guide is uncommitted at this task boundary.

- [ ] **Step 3: Commit the guide**

Run:

```bash
git add LANGUAGE_PREFERENCE_COOKIE.html
git commit -m "docs: document locale cookie integration"
```

### Task 4: Final Verification and Handoff

**Files:**
- Verify only; no production files should change.

**Interfaces:**
- Consumes: all deliverables from Tasks 1–3.
- Produces: verification evidence and a clean, reviewable branch.

- [ ] **Step 1: Run all relevant automated checks**

Run:

```bash
node --test scripts/i18n-locale-preference.test.mjs
npm run test:account
ASTRO_BASE=/ node --max-old-space-size=8192 ./node_modules/.bin/astro build
```

Expected: all tests pass and build exits 0.

- [ ] **Step 2: Audit scope and generated artifacts**

Run:

```bash
git status --short --branch
git diff --check HEAD~3..HEAD
git diff --stat HEAD~3..HEAD
git log -4 --oneline
```

Confirm:

- No Auth, Dashboard, Billing, product-mapping, or `/checkout/continue/` source file changed.
- `dist/`, screenshots, temporary browser fixtures, and dependency artifacts are not committed.
- The working tree is clean.
- No deploy or push command ran.

- [ ] **Step 3: Report the handoff**

Report the cookie contract, modified files, test/build evidence, commit hashes, known build warnings, and the explicit fact that Dashboard and `/checkout/continue/` remain unresolved consumers.
