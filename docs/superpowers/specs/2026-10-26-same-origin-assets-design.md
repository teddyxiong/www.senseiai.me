# Sensei Same-Origin Asset Deployment Design

## Intent

Deploy Sensei like `interview-practice.ai`: Cloudflare Pages builds the source repository directly, and Astro publishes images, fonts, and videos together with the site under `www.senseiai.me`.

## Goals

- Serve assets from `/images`, `/fonts`, and `/videos` on the site origin.
- Remove automatic R2 uploads and post-build CDN URL rewriting.
- Prevent local deployment tooling from copying or pushing build output to any dist repository.
- Keep the existing R2 helper files available but inactive.
- Produce a normal Astro `dist/` directory suitable for direct Pages deployment.

## Non-goals

- Delete the existing R2 bucket or `images.senseiai.me` custom domain.
- Delete `rclone.conf` or `scripts/sync-public.mjs`.
- Create or configure the Cloudflare Pages project from this repository change.
- Change application content, routes, localization, or account behavior.

## Architecture

Cloudflare Pages connects to `teddyxiong/www.senseiai.me`, runs `npm run build`, and publishes `dist`. Astro copies `public/images`, `public/fonts`, and `public/videos` into `dist`, so browser requests remain same-origin. The local `deploy.sh` builds and previews only; a normal source-repository push triggers production deployment after Pages is configured.

## Approaches considered

- Separate R2 bucket plus separate dist repository: preserves the Linkjob architecture but adds infrastructure and duplicate asset synchronization.
- Direct Pages build with a separate R2 bucket: avoids a dist repository but retains cross-origin asset configuration.
- Direct Pages build with same-origin assets: selected because it matches `interview-practice.ai`, removes both collision risks, and is the smallest independent deployment model.

## Constraints

- Do not alter or delete existing Cloudflare resources.
- Do not automatically upload to R2 during development or build.
- Do not push generated output to `linkjobdist`, `Senseidist`, or any other dist repository.
- Preserve the existing `ASTRO_BASE=/` behavior and sitemap post-build step.

