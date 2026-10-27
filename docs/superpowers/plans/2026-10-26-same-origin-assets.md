# Sensei Same-Origin Asset Deployment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Sensei deploy directly from its source repository with same-origin images, fonts, and videos, matching `interview-practice.ai`.

**Architecture:** Astro copies `public` assets into `dist` and all generated references remain root-relative. Cloudflare Pages builds `teddyxiong/www.senseiai.me` directly; local deployment tooling never uploads R2 assets or pushes a separate dist repository.

**Tech Stack:** Astro 5, Node.js 20, npm scripts, Node test runner, zsh deployment helper, Cloudflare Pages.

**Spec:** `docs/superpowers/specs/2026-10-26-same-origin-assets-design.md`

## Global Constraints

- Keep `ASTRO_BASE=/` for development and production builds.
- Keep `scripts/postbuild-sitemap.mjs` as the build post-step.
- Do not delete `rclone.conf`, `scripts/sync-public.mjs`, or any Cloudflare resource.
- Do not upload to R2 or push a dist repository from active scripts.
- Do not change routes, content, localization, or account behavior.

## Review Focus

- A normal `npm run dev` must not prompt for or perform an R2 upload.
- A normal `npm run build` must not prompt for or perform an R2 upload.
- Generated HTML/CSS/JS must not contain `images.senseiai.me` or `images.linkjob.ai` asset URLs.
- Fonts and representative images must exist in `dist/fonts` and `dist/images` after build.
- `deploy.sh` must not mention or push `linkjobdist`/`Senseidist` and must still provide a local preview path.

---

### Task 1: Add deployment architecture regression test

**Files:**
- Create: `scripts/same-origin-assets.test.mjs`
- Modify: `package.json`

**Interfaces:**
- Consumes: repository configuration files as UTF-8 text and JSON.
- Produces: `npm run test:same-origin-assets`, a Node test command that pins the selected architecture.

- [ ] **Step 1: Write the failing test**

Add Node tests asserting that `config.json` has no `asset_base_url`; `Base.astro` uses root-relative font paths and no asset-domain preconnect; `astro.config.mjs` has no `r2-asset-rewrite`; package lifecycle hooks do not invoke `sync-public`; and `deploy.sh` contains no dist-repository sync or push target.

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test scripts/same-origin-assets.test.mjs`

Expected: FAIL on the current R2 rewrite, lifecycle hooks, remote font paths, and dist-repository deployment flow.

- [ ] **Step 3: Add the test script entry**

Add `"test:same-origin-assets": "node --test scripts/same-origin-assets.test.mjs"` to `package.json`.

- [ ] **Step 4: Run the test through npm to confirm the same failure**

Run: `npm run test:same-origin-assets`

Expected: FAIL for the same architecture assertions.

### Task 2: Convert assets and fonts to same-origin delivery

**Files:**
- Modify: `src/config/config.json:2-6`
- Modify: `src/layouts/Base.astro:31-32,109-200`
- Modify: `astro.config.mjs:1-14,148-224`

**Interfaces:**
- Consumes: files under `public/images`, `public/fonts`, and `public/videos`.
- Produces: root-relative `/images`, `/fonts`, and `/videos` URLs copied by Astro into `dist`.

- [ ] **Step 1: Remove `site.asset_base_url` from `src/config/config.json`**

- [ ] **Step 2: Replace CDN font URLs and preloads with root-relative `/fonts/...` paths in `Base.astro`**

Remove the asset origin variables and `images.senseiai.me` preconnect. Preserve the existing page-specific image preload behavior.

- [ ] **Step 3: Remove the `r2-asset-rewrite` integration and its now-unused Node imports from `astro.config.mjs`**

- [ ] **Step 4: Run the architecture test**

Run: `npm run test:same-origin-assets`

Expected: remaining failures only concern package lifecycle hooks and `deploy.sh`.

### Task 3: Remove R2 and dist-repository actions from active workflows

**Files:**
- Modify: `package.json:8-17`
- Modify: `deploy.sh`

**Interfaces:**
- Consumes: the existing Astro build and `dist` output.
- Produces: development/build commands without R2 side effects and a local-only build/preview helper.

- [ ] **Step 1: Remove `sync-public`, `predev`, and `prebuild` from `package.json`**

Keep `dev`, `build`, `postbuild`, `preview`, existing tests, and formatting commands unchanged.

- [ ] **Step 2: Reduce `deploy.sh` to build and preview the repository's own `dist` directory**

Remove source auto-commit/push, `Senseidist` synchronization, dist-repository publish prompts, production-site opening, and IndexNow submission. Keep branch-independent local build validation and a local HTTP preview with automatic shutdown.

- [ ] **Step 3: Run the architecture test**

Run: `npm run test:same-origin-assets`

Expected: PASS.

### Task 4: Verify the complete build output

**Files:**
- Verify: `dist/**`

**Interfaces:**
- Consumes: the completed same-origin configuration.
- Produces: deployable static output for Cloudflare Pages.

- [ ] **Step 1: Run the full build**

Run: `npm run build`

Expected: exit code 0 with Astro build and sitemap post-build complete, without an R2 prompt.

- [ ] **Step 2: Verify generated assets and URLs**

Run: `test -f dist/fonts/primary/font-primary-regular.woff2 && test -f dist/images/logo.png && ! rg -n 'images\.(senseiai\.me|linkjob\.ai)' dist --glob '*.html' --glob '*.css' --glob '*.js'`

Expected: exit code 0 and no CDN-domain matches.

- [ ] **Step 3: Run targeted and existing regression tests**

Run: `npm run test:same-origin-assets && npm run test:account`

Expected: all tests pass.

- [ ] **Step 4: Confirm the worktree contains only intended source, test, and documentation changes**

Run: `git status --short && git diff --check`

Expected: no whitespace errors and no unrelated modifications.

