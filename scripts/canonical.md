# Canonical URL 统一 + 图片迁移到 Cloudflare R2

## 概述

这篇文章记录了将多个 .astro 页面中各自手写的 canonical URL 统一到 `Base.astro` 自动计算，以及将 `/images/`、`/fonts/`、`/videos/` 等静态资源迁移到 Cloudflare R2 的过程。

所有改动记录了 git commit：`262df0f`、`d18682ad`、`8dd5398f`。其他语言目录可按本文指引逐一修改。

---

## 涉及文件

| 文件 | 操作 | 目的 |
|---|---|---|
| `src/layouts/Base.astro` | 修改 | 移除 canonical prop，改为自动计算 |
| `src/pages/*.astro`（约 10 个） | 修改 | 删除各页面手写的 canonical 计算和传参 |
| `src/content/**/-index.md`（约 11 个） | 修改 | 删除 content 中的 canonical 字段 |
| `astro.config.mjs` | 修改 | 支持 ASTRO_BASE 环境变量 + R2 资源路径替换 |
| `src/config/config.json` | 修改 | 新增 `asset_base_url` 字段 |
| `package.json` | 修改 | 新增 ASTRO_BASE、predev/prebuild rclone 同步 |
| `rclone.conf` | 新建 | R2 同步凭证配置 |

---

## 1. `Base.astro` — 统一 canonical 计算

### 修改前

Canonical 通过 `Props` 由每个页面自行计算后传入：

```astro
export interface Props {
  canonical?: string;   // ← 删除
  ...
}

const { ..., canonical } = Astro.props;  // ← 删除

{canonical && <link rel="canonical" href={canonical} item-prop="url" />}  // ← 条件渲染
```

### 修改后

移除 `canonical` prop，在 `Base.astro` 内部根据当前 URL 自动计算：

```astro
// Props 中删除 canonical 字段
export interface Props {
  title?: string;
  meta_title?: string;
  description?: string;
  image?: string;
  noindex?: boolean;
  prev_url?: string;
  next_url?: string;
  hideHeader?: boolean;
  hideFooter?: boolean;
  footerVariant?: "default" | "home";
}

// destructure 中删除 canonical
const { title, meta_title, description, image, noindex, prev_url, next_url, hideHeader = false, hideFooter = false, footerVariant = "default" } =
  Astro.props;

// 自动计算 canonical URL，确保末尾有 /
const canonicalUrl = new URL(
  Astro.url.pathname.endsWith("/") ? Astro.url.pathname : Astro.url.pathname + "/",
  Astro.site
).href;
```

模板中 **始终渲染** canonical（不再条件判断）：

```astro
<link rel="canonical" href={canonicalUrl} item-prop="url" />
```

### 关键点

- `Astro.site` 来自 `astro.config.mjs` 的 `site` 配置 → 即 `config.site.base_url`
- `Astro.url.pathname` 已包含 locale 前缀（build 时由 `ASTRO_BASE` 决定）
- 末尾 `/` 补齐：首页 pathname 可能是 `/` 或 `/es`，不加判断会导致 canonical 变成 `https://www.senseiai.me` 而非 `https://www.senseiai.me/`

### 应用到其他语言

此文件改动**与语言无关**，可直接复制到其他语言目录。

---

## 2. 页面文件（`src/pages/*.astro`）— 删除手写 canonical

### 2.1 修改范围

以下页面各自有手写 canonical 逻辑，需要删除：

| 文件 | 原写法 | 改动 |
|---|---|---|
| `index.astro` | `const canonicalsite = ${Astro.site}; const canonicalUrl = canonicalsite;` → `<Base canonical={canonicalUrl}>` | 删除 3 行，`<Base>` 不传 canonical |
| `pricing.astro` | `const canonicalUrl = ${Astro.site}pricing/;` → `<Base canonical={canonicalUrl}>` | 删除 2 行 |
| `features.astro` | `const canonical = featuresPageData?.data?.canonical \|\| 'features';` → `const canonicalUrl = ${Astro.site}${canonical}/;` | 删除 2 行 |
| `about.astro` | 从 data 解构 `canonical` → `const canonicalUrl = ${Astro.site}${canonical};` | 删除解构 + canonicalUrl |
| `contact.astro` | `const canonical = "/contact"` 默认值 → `const canonicalUrl = ${Astro.site}${canonical};` | 删除 2 行 |
| `downloads.astro` | 从 data 解构 `canonical` → `const canonicalUrl = ${Astro.site}${canonical \|\| 'downloads'}/;` | 删除解构 + canonicalUrl |
| `interview-copilot.astro` | `const { canonical, ... } = data; const canonicalUrl = ${Astro.site}${canonical}/;` | 删除解构 + canonicalUrl |
| `ai-mock-interview.astro` | `const { canonical, ... } = data; const canonicalUrl = ${Astro.site}${canonical}/;` | 删除解构 + canonicalUrl |
| `coding-interview-copilot.astro` | `const { canonical, ... } = data; const canonicalUrl = ${Astro.site}${canonical}/;` | 删除解构 + canonicalUrl |
| `[regular].astro` | `const canonicalUrl = ${Astro.site}${slug}/;` | 删除 slug 变量 + canonicalUrl |

### 2.2 通用改动模式

每个文件做 3 件事：

1. **删除** `canonical` 从 data 中的解构
2. **删除** `const canonicalUrl = ...` 的计算
3. **删除** `<Base canonical={canonicalUrl}>` 的 prop 传递，改为 `<Base ...>`

另有一些 `_` 开头的页面（如 `_pricing.astro`、`_cart.astro`）如果仍传 `canonical` prop，因 `Base.astro` 的 Props 已移除该字段，传了也会被静默忽略。建议一并清理，保持代码一致。

### 应用到其他语言

按照上述表格逐一检查对应页面文件，执行相同的删除操作。

---

## 3. Content .md 文件 — 删除 canonical frontmatter

### 修改范围

以下 content 目录的 `-index.md` 文件中有 `canonical` 字段，需要删除：

| 文件 | 原值 |
|---|---|
| `src/content/about/-index.md` | `canonical: "about/"` |
| `src/content/ai-mock-interview/-index.md` | `canonical: "ai-mock-interview"` |
| `src/content/coding-interview-copilot/-index.md` | `canonical: "coding-interview-copilot"` |
| `src/content/contact/-index.md` | `canonical: "contact/"` |
| `src/content/downloads/-index.md` | `canonical: "downloads"` |
| `src/content/features/-index.md` | `canonical: "/features/"` |
| `src/content/interview-copilot/-index.md` | `canonical: "interview-copilot"` |
| `src/content/pages/privacy-policy.md` | `canonical: "/privacy-policy/"` |
| `src/content/pages/terms.md` | `canonical: "/terms/"` |
| `src/content/pricing/-index.md` | `canonical: "pricing/"` |
| `src/content/solutions/-index.md` | `canonical: "/solutions"` |

### 改动

在每个文件的 frontmatter（`---` 之间）中，删除 `canonical: ...` 这一行。

### 应用到其他语言

逐一删除对应 content 文件中 frontmatter 里的 `canonical:` 行。不同语言的 md 文件结构可能略有差异，但 canonical 字段的格式一致。

---

## 4. `astro.config.mjs` — ASTRO_BASE + R2 资源替换

### 4.1 base 支持环境变量覆盖

```diff
- base: config.site.base_path ? config.site.base_path : "/es",
+ base: process.env.ASTRO_BASE || (config.site.base_path || "/es"),
```

这允许通过 `ASTRO_BASE` 环境变量覆盖 `config.json` 中的 `base_path`。dev 时不加前缀，build 时加 locale 前缀。

### 4.2 新增 R2 资源路径替换插件

在 `integrations` 数组中新增一个自定义插件，在 build 完成后遍历 `dist` 目录，将 HTML/JS/CSS 中的 `/images/`、`/fonts/`、`/videos/` 替换为 `config.site.asset_base_url` 的对应路径。

```js
// astro.config.mjs 顶部新增 import
import { readFile, writeFile, readdir } from "node:fs/promises";
import { join } from "node:path";
```

在 `integrations` 数组中 `mdx()` 之后新增：

```js
{
  name: 'r2-asset-rewrite',
  hooks: {
    'astro:build:done': async ({ dir }) => {
      const base = config.site.asset_base_url;
      if (!base) return;

      async function* walk(dirPath) {
        const entries = await readdir(dirPath, { withFileTypes: true });
        for (const entry of entries) {
          const full = join(dirPath, entry.name);
          if (entry.isDirectory()) {
            yield* walk(full);
          } else if (/\.(html|js|css)$/.test(entry.name)) {
            yield full;
          }
        }
      }

      const files = [];
      for await (const f of walk(dir.pathname)) {
        files.push(f);
      }

      await Promise.all(files.map(async (fullPath) => {
        let content = await readFile(fullPath, 'utf-8');
        const updated = content
          .replace(/([\"'`])\/(images|fonts|videos)\//g, `$1${base}/$2/`)
          .replace(/url\(\s*\/(images|fonts|videos)\//g, `url(${base}/$1/`);
        if (updated !== content) await writeFile(fullPath, updated, 'utf-8');
      }));
    }
  }
},
```

### 作用

- `npm run build` 后，产物中所有 `/images/xxx.png` 会被替换为 `https://images.senseiai.me/images/xxx.png`
- dev 时不触发（`astro:build:done` 只在 build 时触发）
- `/fonts/` 和 `/videos/` 同样被替换

### 应用到其他语言

`astro.config.mjs` 与语言无关，可直接复制（注意保留各自 import 的本地化模块差异）。

---

## 5. `src/config/config.json` — 新增 `asset_base_url`

### 改动

```diff
  "site": {
    "title": "...",
    "base_url": "https://www.senseiai.me/",
+   "asset_base_url": "https://images.senseiai.me",
    "base_path": "/",
```

### 说明

`asset_base_url` 是图片/字体/视频资源的 CDN 域名。astro.config.mjs 中的 `r2-asset-rewrite` 插件读取此字段进行路径替换。

### 应用到其他语言

所有语言目录共享同一个 `asset_base_url`，直接加上即可。

---

## 6. `rclone.conf` — R2 同步凭证（新建）

### 内容

```ini
[r2]
type = s3
provider = Cloudflare
access_key_id = a8b9cfc9cb667244211c278b097be829
secret_access_key = 8d05b58ec0ea4a5a89b2ff30b15c08d3645b6e145d4023e866c3c72f34a89aec
endpoint = https://7b0f327661ef320f0543f2fa66fc6c36.r2.cloudflarestorage.com
region = auto
```

### 说明

`rclone.conf` 是 rclone 连接 Cloudflare R2 的凭证文件。`npm run dev` 或 `npm run build` 前会通过 `scripts/sync-public.mjs` 交互式询问是否将 `public/` 目录同步到 R2 bucket `public` 中（即 `https://images.senseiai.me/` 对应的存储）。

### 应用到其他语言

此文件与语言无关，直接复制。

---

## 7. `package.json` — 脚本变更

### 改动

```diff
  "scripts": {
+   "sync-public": "rclone copy ./public r2:public --config ./rclone.conf --checksum --verbose",
+   "predev": "node scripts/sync-public.mjs",
+   "prebuild": "node scripts/sync-public.mjs && node scripts/prepend-locale.mjs",
+   "postbuild": "node scripts/restore-menu.mjs",
-   "dev": "node --max-old-space-size=8192 ./node_modules/.bin/astro dev",
+   "dev": "ASTRO_BASE=/ node --max-old-space-size=8192 ./node_modules/.bin/astro dev",
    "build": "ASTRO_BASE=/$(node -p \"require('./i18n.config.json').activeLocale\") node --max-old-space-size=8192 ./node_modules/.bin/astro build",
    ...
  }
```

### 说明

- `ASTRO_BASE=/` — dev 时不加 locale 前缀
- `ASTRO_BASE=/$(...)` — build 时动态读取 `i18n.config.json` 的 `activeLocale`
- `sync-public.mjs` — 交互式询问是否将 `public/` 同步到 R2
- `prepend-locale.mjs` / `restore-menu.mjs` — 见 `dev-vs-build-migration.md`

### 应用到其他语言

- `ASTRO_BASE` 的 build 命令用 `$(node -p ...)` 动态读取，无需修改
- `sync-public.mjs`、`prepend-locale.mjs`、`restore-menu.mjs` 全部无需修改（locale 自动读取）
- 确认 `scripts/` 下三个 .mjs 文件已存在

---

## 修改清单总结

```
修改:
  src/layouts/Base.astro          — 移除 canonical prop，改为自动计算
  src/pages/index.astro           — 删除 canonical 计算
  src/pages/pricing.astro         — 删除 canonical 计算
  src/pages/features.astro        — 删除 canonical 计算
  src/pages/about.astro           — 删除 canonical 计算
  src/pages/contact.astro         — 删除 canonical 计算
  src/pages/downloads.astro       — 删除 canonical 计算
  src/pages/interview-copilot.astro       — 删除 canonical 计算
  src/pages/ai-mock-interview.astro       — 删除 canonical 计算
  src/pages/coding-interview-copilot.astro— 删除 canonical 计算
  src/pages/[regular].astro       — 删除 canonical 计算
  src/content/about/-index.md     — 删除 canonical: 字段
  src/content/ai-mock-interview/-index.md        — 同上
  src/content/coding-interview-copilot/-index.md — 同上
  src/content/contact/-index.md                  — 同上
  src/content/downloads/-index.md                — 同上
  src/content/features/-index.md                 — 同上
  src/content/interview-copilot/-index.md        — 同上
  src/content/pages/privacy-policy.md            — 同上
  src/content/pages/terms.md                     — 同上
  src/content/pricing/-index.md                  — 同上
  src/content/solutions/-index.md               — 同上
  astro.config.mjs               — ASTRO_BASE 环境变量 + R2 asset rewrite
  src/config/config.json          — 新增 asset_base_url
  package.json                   — ASTRO_BASE、predev/prebuild、postbuild

新建:
  rclone.conf                    — R2 同步凭证

可选清理:
  src/pages/_pricing.astro       — canonical prop 已被 Base.astro 忽略
  src/pages/_cart.astro          — canonical prop 已被 Base.astro 忽略
  src/pages/_downloads.astro     — canonical prop 已被 Base.astro 忽略
  src/pages/_membership.astro    — canonical prop 已被 Base.astro 忽略
  src/pages/_payments.astro      — canonical prop 已被 Base.astro 忽略
  src/pages/_lynccontainer.astro — canonical prop 已被 Base.astro 忽略
  （这些 _ 页面仍传递 canonical prop，但因 Base.astro 不再接收，已被静默忽略）
```
