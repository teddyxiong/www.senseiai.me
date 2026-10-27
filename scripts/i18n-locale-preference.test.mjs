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
  return import(
    `data:text/javascript;base64,${Buffer.from(source).toString("base64")}#${randomUUID()}`
  );
}

function installCookieBrowser({ protocol = "https:", cookie = "" } = {}) {
  let jar = cookie;
  let lastWrite = "";
  globalThis.window = { location: { protocol } };
  globalThis.document = {
    get cookie() {
      return jar;
    },
    set cookie(value) {
      lastWrite = String(value);
      jar = String(value).split(";", 1)[0];
    },
  };
  return {
    get jar() {
      return jar;
    },
    get lastWrite() {
      return lastWrite;
    },
  };
}

test("locale preference persists published locales and explicit localized paths", async () => {
  const browser = installCookieBrowser();
  const locale = await loadLocaleModule();

  assert.equal(locale.writeLocalePreference("fr"), true);
  assert.equal(locale.readLocalePreference(), "fr");
  assert.match(
    browser.lastWrite,
    /^Sensei_locale=fr; Path=\/; Max-Age=31536000; SameSite=Lax; Secure$/,
  );

  assert.equal(locale.rememberExplicitLocaleFromPath("/ja/pricing/"), true);
  assert.equal(locale.readLocalePreference(), "ja");
  assert.equal(
    locale.rememberExplicitLocaleFromPath("/checkout/continue/"),
    false,
  );
  assert.equal(locale.readLocalePreference(), "ja");

  assert.equal(locale.rememberExplicitLocaleFromPath("/pricing/"), false);
  assert.equal(locale.readLocalePreference(), "ja");
  assert.equal(locale.writeLocalePreference("en"), true);
  assert.equal(locale.readLocalePreference(), "en");

  const httpBrowser = installCookieBrowser({ protocol: "http:" });
  assert.equal(locale.writeLocalePreference("en"), true);
  assert.doesNotMatch(httpBrowser.lastWrite, /Secure/);
});

test("locale preference rejects malformed, incorrectly cased, and unsupported values", async () => {
  const browser = installCookieBrowser({ cookie: "Sensei_locale=zh-Hant" });
  const locale = await loadLocaleModule();

  assert.equal(locale.readLocalePreference(), null);
  assert.equal(locale.writeLocalePreference("zh-Hant"), false);
  assert.equal(locale.writeLocalePreference("xx"), false);
  assert.equal(browser.lastWrite, "");

  installCookieBrowser({ cookie: "Sensei_locale=%E0%A4%A" });
  assert.equal(locale.readLocalePreference(), null);

  globalThis.document = {
    get cookie() {
      throw new DOMException("Cookies are disabled", "SecurityError");
    },
    set cookie(_value) {
      throw new DOMException("Cookies are disabled", "SecurityError");
    },
  };
  assert.equal(locale.readLocalePreference(), null);
  assert.equal(locale.writeLocalePreference("fr"), false);
});
