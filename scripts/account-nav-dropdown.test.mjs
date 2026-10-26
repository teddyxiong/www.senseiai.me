import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = await readFile("src/layouts/helpers/AccountNav.tsx", "utf8");

test("account dropdown reuses the navbar hover and focus interaction", () => {
  assert.match(source, /className="[^"]*\bgroup\b[^"]*\brelative\b[^"]*"/);
  assert.match(
    source,
    /className="inline-flex h-\[35px\] items-center gap-1 rounded-md border border-border bg-white px-2 py-1 text-sm font-semibold text-primary transition hover:border-primary hover:text-primary"/,
  );
  assert.match(source, /className="account-dropdown-panel [^"]+"/);
  assert.match(source, /className="menu-dropdown-link"/);
  assert.match(
    source,
    /className="menu-dropdown-link w-full text-left disabled:opacity-60"/,
  );
  assert.match(source, /group-hover:visible/);
  assert.match(source, /group-focus-within:visible/);
  assert.doesNotMatch(source, /onMouseEnter|onMouseLeave|supportsHoverRef/);
});

test("account navigation preserves return targets without breaking native link actions", () => {
  assert.match(
    source,
    /type LocationSnapshot = \{ pathname: string; search: string; hash: string \}/,
  );
  assert.match(source, /hashchange/);
  assert.match(source, /data-astro-reload/);
  assert.doesNotMatch(source, /tryFreeHref/);
  assert.match(source, /event\.button !== 0/);
  assert.match(source, /event\.metaKey/);
  assert.match(source, /event\.ctrlKey/);
  assert.match(source, /event\.shiftKey/);
  assert.match(source, /viewState === "unknown" \|\| viewState === "error"/);
  assert.match(source, /className="group relative"/);
  assert.match(source, /className="flex items-center gap-2"/);
  assert.doesNotMatch(source, /account-nav-slot/);
});

test("the signed-in account button renders only the avatar", () => {
  assert.match(
    source,
    /<AccountAvatar src=\{user\.image \|\| FALLBACK_AVATAR_URL\} \/>/,
  );
  assert.doesNotMatch(source, /displayName/);
});
