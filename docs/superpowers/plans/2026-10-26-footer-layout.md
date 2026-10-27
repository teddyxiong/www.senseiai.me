# Footer Layout Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Recompose the existing footer into a compact, responsive three-column layout.

**Architecture:** Reuse the current Astro component and Bootstrap-style grid utilities. Merge the two existing content rows into one responsive row while leaving the copyright row and footer behavior intact.

**Tech Stack:** Astro, Tailwind utility classes, existing project grid utilities

**Spec:** `docs/superpowers/specs/2026-10-26-footer-layout-design.md`

## Global Constraints

- Preserve existing copy, URLs, colors, hover behavior, and accessibility.
- Add no dependencies, abstractions, or new components.
- Mobile order is logo, description/social link, About Us links.

## Review Focus

- Desktop columns align at the top without the previous large vertical gap.
- Tablet widths do not squeeze the description or links unnaturally.
- Mobile content stacks in the required order without horizontal overflow.
- Discord link and all About Us links remain reachable.
- Copyright divider and text remain unchanged beneath the main row.

---

### Task 1: Recompose the shared footer

**Files:**
- Modify: `src/layouts/partials/Footer.astro`
- Verify: `dist/index.html`

**Interfaces:**
- Consumes: existing `footer`, `social.main`, and `copyright` data
- Produces: the same footer content in a responsive three-column layout

- [ ] **Step 1: Record the current structure**

Verify that the source contains two separate main content rows and that the About Us block is in the second row.

- [ ] **Step 2: Recompose the layout**

Move the logo, description/social content, and About Us block into one responsive row with desktop widths of 3, 6, and 3 columns. Preserve the copyright block as a separate row.

- [ ] **Step 3: Verify source structure**

Use an assertion-based source check to confirm one main responsive row contains all three content blocks in the required order.

- [ ] **Step 4: Build the site**

Run: `npm run build`

Expected: Astro exits with status 0 and generates `dist/index.html`.

- [ ] **Step 5: Inspect the generated footer**

Confirm the generated home page contains the logo, existing description, Discord link, About Us links, and copyright.

