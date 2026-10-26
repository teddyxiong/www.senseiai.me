# Sitemap Postbuild 补充方案

## 背景

Astro 的 `@astrojs/sitemap` 插件只能为当前 Astro 项目内的页面生成 sitemap，无法处理以下场景：

- **外部项目引用**：hub（WordPress）、interview-questions（WordPress）是独立项目，各有自己的 sitemap
- **兄弟语言站点引用**：ja、es、it、ar 是独立部署的 Astro 项目，各有自己的 sitemap-0.xml

之前这些引用通过 `deploy.sh` 中的 shell 脚本（`task_2`）在构建后手动追加，流程割裂。现在统一收拢到 npm 生命周期 `postbuild` 钩子中自动处理。

## 核心思路

利用 npm 的 `postbuild` 钩子，在 `astro build` 之后自动运行 `scripts/postbuild-sitemap.mjs`，往 `dist/sitemap-index.xml` 中追加外部 sitemap 引用，然后复制为 `sitemap.xml`。

## 判断逻辑

通过读取 `i18n.config.json` 的 `activeLocale` 字段判断当前语言：

- `activeLocale === "en"` → 执行（英文站是根站点，需要引用所有语言的外部 sitemap）
- `activeLocale !== "en"` → 跳过（日语/西语站不需要引用其他语言）

这样所有语言项目可以共用同一个脚本，无需修改。

## 涉及文件

| 文件 | 操作 | 说明 |
|---|---|---|
| `scripts/postbuild-sitemap.mjs` | 新建 | 核心脚本 |
| `package.json` | 修改 | 新增 `postbuild` 脚本 |

---

## 1. `scripts/postbuild-sitemap.mjs`（新建）

```js
import { readFile, copyFile, writeFile } from "node:fs/promises";

const I18N_PATH = "i18n.config.json";
const SITEMAP_INDEX = "dist/sitemap-index.xml";
const SITEMAP = "dist/sitemap.xml";
const BASE_URL = "https://www.senseiai.me";

const i18nConfig = JSON.parse(await readFile(I18N_PATH, "utf-8"));

if (i18nConfig.activeLocale !== "en") {
  console.log("[postbuild-sitemap] activeLocale is not 'en', skipping sitemap enrichment");
  process.exit(0);
}

let content = await readFile(SITEMAP_INDEX, "utf-8");

// Append external sitemap references before </sitemapindex>
content = content.replace("</sitemapindex>", (() => {
  const entries = [];

  // Step A: hub + interview-questions
  entries.push(`  <sitemap>
    <loc>${BASE_URL}/interview-questions/sitemap.xml</loc>
  </sitemap>`);
  entries.push(`  <sitemap>
    <loc>${BASE_URL}/hub/sitemap.xml</loc>
  </sitemap>`);

  // Step B: locale sitemaps for non-en published locales
  const publishedLocales = i18nConfig.publishedLocales || [];
  for (const locale of publishedLocales) {
    if (locale === "en") continue;
    entries.push(`  <sitemap>
    <loc>${BASE_URL}/${locale}/sitemap-0.xml</loc>
  </sitemap>`);
  }

  return entries.join("\n") + "\n</sitemapindex>";
})());

await writeFile(SITEMAP_INDEX, content, "utf-8");
console.log("[postbuild-sitemap] sitemap-index.xml enriched");

// Step C: copy to sitemap.xml
await copyFile(SITEMAP_INDEX, SITEMAP);
console.log("[postbuild-sitemap] sitemap-index.xml copied to sitemap.xml");
```

### 步骤说明

| 步骤 | 内容 |
|---|---|
| 读取 `i18n.config.json` | 获取 `activeLocale` 和 `publishedLocales` |
| 判断 `activeLocale` | 不是 `en` → 跳过并输出提示 |
| Step A | 追加 `interview-questions/sitemap.xml` 和 `hub/sitemap.xml` 引用 |
| Step B | 遍历 `publishedLocales`，跳过 `en`，为每个语言追加 `/ja/sitemap-0.xml` 等引用 |
| Step C | 复制 `sitemap-index.xml` → `sitemap.xml` |

### 输出结果

与线上 `https://www.senseiai.me/sitemap-index.xml` 完全一致：

```xml
<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <sitemap>
    <loc>https://www.senseiai.me/sitemap-0.xml</loc>       ← Astro 原生产出
    <lastmod>2026-05-27T13:32:03.339Z</lastmod>
  </sitemap>
  <sitemap>
    <loc>https://www.senseiai.me/interview-questions/sitemap.xml</loc>  ← Step A
  </sitemap>
  <sitemap>
    <loc>https://www.senseiai.me/hub/sitemap.xml</loc>                  ← Step A
  </sitemap>
  <sitemap>
    <loc>https://www.senseiai.me/ja/sitemap-0.xml</loc>                 ← Step B
  </sitemap>
  <sitemap>
    <loc>https://www.senseiai.me/es/sitemap-0.xml</loc>                 ← Step B
  </sitemap>
  <sitemap>
    <loc>https://www.senseiai.me/it/sitemap-0.xml</loc>                 ← Step B
  </sitemap>
  <sitemap>
    <loc>https://www.senseiai.me/ar/sitemap-0.xml</loc>                 ← Step B
  </sitemap>
</sitemapindex>
```

---

## 2. `package.json` — 新增 `postbuild` 脚本

```diff
  "scripts": {
    ...
    "build": "ASTRO_BASE=/ node --max-old-space-size=8192 ./node_modules/.bin/astro build",
+   "postbuild": "node scripts/postbuild-sitemap.mjs",
    "preview": "...",
    ...
  },
```

---

## 构建流程

```
npm run build
  ├── prebuild: sync-public.mjs          (R2 资源同步)
  ├── astro build (ASTRO_BASE=/)
  │     └── 产出: dist/sitemap-index.xml (仅含 Astro 自己的 sitemap-0.xml)
  └── postbuild: postbuild-sitemap.mjs
        ├── activeLocale === "en" ?
        │     ├── 追加 interview-questions/hub 外部 sitemap
        │     ├── 追加 ja/es/it/ar 语言 sitemap
        │     └── sitemap-index.xml → sitemap.xml
        └── activeLocale !== "en" → 跳过
```

---

## 应用到其他语言

**无需修改。** 直接复制 `scripts/postbuild-sitemap.mjs` 到其他语言项目的 `scripts/` 目录，并在 `package.json` 中添加 `postbuild` 脚本即可。

脚本会自动检测 `activeLocale`，非 `en` 时跳过，不会往其他语言的 sitemap 中塞入不需要的外部引用。

---

## 注意事项

- 如果新增/下线语言，只需修改 `i18n.config.json` 的 `publishedLocales`，脚本会自动适配
- `deploy.sh` 中的 `task_2` 与本脚本功能重复，后续废弃 `deploy.sh` 时可直接移除
- `sitemap-0.xml` 中 comet/lynccontainer/membership/cart 等隐藏页面的排除未在本方案中处理，暂时保留在 `deploy.sh` task_2 中（未来应改为在 `astro.config.mjs` 的 sitemap `filter` 中排除）
