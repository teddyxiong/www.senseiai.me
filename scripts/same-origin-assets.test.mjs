import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("site configuration keeps static assets on the site origin", async () => {
  const config = JSON.parse(await read("src/config/config.json"));
  const base = await read("src/layouts/Base.astro");
  const accountConstants = await read("src/lib/account/constants.ts");
  const astroConfig = await read("astro.config.mjs");

  assert.equal(config.site.asset_base_url, undefined);
  assert.doesNotMatch(base, /images\.(?:senseiai\.me|linkjob\.ai)/);
  assert.match(base, /path: "\/fonts\/primary\/font-primary-regular\.woff2"/);
  assert.match(base, /path: "\/fonts\/secondary\/font-secondary-bold\.woff2"/);
  assert.doesNotMatch(accountConstants, /asset_base_url/);
  assert.match(accountConstants, /FALLBACK_AVATAR_URL = "\/images\/favicon\.png"/);
  assert.doesNotMatch(astroConfig, /r2-asset-rewrite/);
});

test("normal development and build commands do not upload to R2", async () => {
  const pkg = JSON.parse(await read("package.json"));

  assert.equal(pkg.scripts["sync-public"], undefined);
  assert.equal(pkg.scripts.predev, undefined);
  assert.equal(pkg.scripts.prebuild, undefined);
});

test("local deploy helper cannot publish a dist repository", async () => {
  const deploy = await read("deploy.sh");

  assert.doesNotMatch(deploy, /(?:linkjobdist|senseidist)/i);
  assert.doesNotMatch(deploy, /\brsync\b/);
  assert.doesNotMatch(deploy, /\bgit\s+(?:-C\s+[^\s]+\s+)?push\b/);
});
