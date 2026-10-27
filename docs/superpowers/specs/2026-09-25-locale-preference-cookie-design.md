# Locale Preference Cookie Design

## Status

Proposed for implementation after user review.

## Goal

Persist the last effective Sensei website language in the same browser so that locale-neutral pages and future consumers can recover it after the locale disappears from the URL.

This phase establishes the producer and the shared cookie contract in the Sensei repository. It does not update Dashboard, Auth, or any other consumer.

## Scope

### In scope

- Add a Sensei locale-preference module backed by a first-party cookie.
- Treat `i18n.config.json` as the Sensei source of truth for valid locales.
- Record a non-default locale when an explicit localized URL becomes effective.
- Record the actual fallback locale when the language switcher falls back to English.
- Avoid overwriting the preference from locale-neutral pages.
- Add focused tests for validation, cookie serialization, and effective-locale behavior.
- Add an HTML guide in the Sensei repository root that documents the contract, producer behavior, consumer integration, and known Dashboard issues.

### Out of scope

- Do not modify Auth or Dashboard.
- Do not repair Dashboard home, Pricing, Downloads, logo, or other fixed URLs.
- Do not repair Dashboard's hard-coded locale list or the `zh-Hant` versus `zh-hant` mismatch.
- Do not localize Dashboard.
- Do not store locale preferences in the user account or synchronize them across browsers.
- Do not add automatic locale redirects at the edge or on English routes.
- Do not change `/checkout/continue/`; document its locale-neutral status and the unresolved integration requirement only.
- Do not deploy.

## Cookie Contract

| Property | Value |
| --- | --- |
| Name | `Sensei_locale` |
| Value | A canonical lowercase locale from the published locale set, such as `en`, `fr`, or `zh-hant` |
| Path | `/` |
| Lifetime | `Max-Age=31536000` (one year), refreshed when a language becomes effective |
| SameSite | `Lax` |
| Secure | Enabled on HTTPS; omitted for local HTTP development |
| HttpOnly | No, because browser consumers must read it |
| Domain | Omitted, producing a host-only cookie for `www.senseiai.me` |

The value is a display preference only. Consumers must treat it as user-controlled input, validate it before use, and never use it for authentication or authorization.

## Resolution Rules

The shared precedence contract is:

1. An explicit, supported locale in the current URL.
2. A valid `Sensei_locale` cookie.
3. `defaultLocale` from `i18n.config.json`.

The default locale is stored explicitly as `en` when the user selects English or when the language switcher actually falls back to English. When no cookie exists, consumers resolve the configured default without requiring an `en` cookie.

Invalid, unsupported, incorrectly cased, or malformed values are ignored. Sensei may expire an invalid cookie while resolving the default locale.

## Sensei Producer Design

Add one module under `src/lib/i18n/` with a small interface:

```ts
readLocalePreference(): string | null
writeLocalePreference(locale: string): boolean
```

The implementation owns locale validation and cookie parsing/serialization. Callers do not construct cookie strings and do not maintain their own locale allowlists.

### Page load

The shared client initialization records a locale only when the current URL has an explicit supported non-default locale prefix, such as `/fr/` or `/zh-hant/pricing/`. It must run both on the initial page load and after Astro view transitions.

Unprefixed paths do not write `en` automatically. They may be English content or locale-neutral workflow routes, and this phase deliberately does not add a route-classification system. A missing cookie already resolves to the configured default locale.

### Language switcher

The existing switcher probes whether the target page exists.

- When the requested target exists, persist the target locale immediately before navigation.
- When the probe fails and navigation falls back to the English URL, persist `en` immediately before fallback navigation.
- Modified clicks and new-tab navigation retain native browser behavior. The destination page remains responsible for recording its effective locale when it loads.

The cookie therefore records the last effective language, not merely the last attempted selection.

## Locale-Neutral Pages

Locale-neutral pages preserve the existing cookie because unprefixed paths are not persisted automatically.

`/checkout/continue/` is a known locale-neutral workflow page. This phase does not modify it. Its current missing-intent fallback is hard-coded to `/pricing/`, so it can return to English instead of the stored language. The root HTML guide must record that a future integration should read the validated preference when it needs a localized fallback destination.

## Consumer Contract

Future consumers such as Dashboard must:

1. Read `Sensei_locale` from the first-party cookie.
2. Validate the value against the consumer's supported locale set.
3. Use canonical lowercase locale codes.
4. Fall back to `en` when the cookie is missing or invalid.
5. Prefer an explicit supported URL locale over the cookie if the consumer later adds localized URLs.
6. Encode or map the validated value before placing it into a URL.

The producer contract does not prescribe whether a future localized Dashboard uses `/fr/dashboard/`, a locale-neutral `/dashboard/` with translated content, or another routing scheme.

## Known Dashboard Problems to Document, Not Fix

- Dashboard is served by the Auth repository under `/dashboard/`, so its pathname contains no public-site locale.
- `public/dashboard/sidebar.js` currently attempts to derive locale from the Dashboard pathname and therefore resolves to English.
- Its hard-coded list uses `zh-Hant`, while Sensei's canonical configured value is `zh-hant`.
- Dashboard contains fixed English URLs for the home page, Pricing, Downloads, logo navigation, plan links, and provider-less subscription management.
- Dashboard currently has no shared reader for `Sensei_locale`.
- Aligning those consumers is a separate task.

## Root HTML Guide

After implementation, add `LANGUAGE_PREFERENCE_COOKIE.html` at the Sensei repository root. It must be readable directly in a browser and include:

- The cookie table and security characteristics.
- Sensei write timing and precedence rules.
- JavaScript examples for safely reading and validating the cookie.
- URL construction examples for `en`, `fr`, and `zh-hant`.
- Guidance for future localized and locale-neutral consumers.
- The known Dashboard problems above.
- The deferred `/checkout/continue/` issue.
- An explicit list of what this implementation does not fix.

The guide documents the public contract; it must not contain secrets, production tokens, or deployment instructions.

## Error and Fallback Behavior

- If cookies are unavailable, the current page continues normally without persistence.
- An unsupported locale is not written.
- A malformed cookie is ignored and resolves to the configured default.
- Language navigation is not blocked by a cookie write failure.
- Cookie state never grants access or changes authentication state.

## Verification

Use the repository's existing test framework. Add only focused coverage for the new behavior:

1. Valid locales serialize the required first-party cookie and invalid locales do not.
2. Explicit localized URLs and the language switch path record the actual destination locale, including English fallback, while unprefixed paths do not overwrite the preference.

Then run:

- `npm run test:account`
- A local Astro build without invoking the interactive R2 synchronization step.
- A local browser check that switching language produces the expected cookie and that locale-neutral behavior is documented but not changed.

## Expected Files

- `src/lib/i18n/localePreference.ts` — cookie module.
- `src/layouts/Base.astro` and/or the smallest existing shared client entry — page-load persistence hook.
- `src/layouts/partials/Header.astro` — successful-target and English-fallback persistence.
- Existing focused test file(s), without new test infrastructure.
- One descriptive HTML guide in the Sensei repository root.

No Auth or Billing files are changed.
