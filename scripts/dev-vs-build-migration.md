# 多语言 Astro 项目 dev / build locale 路径分离方案

## 背景

本项目是多语言 Astro 静态站点（SSG）。由于 Astro 的 `base` 配置会影响所有 URL（页面 + 静态资源 + JS/CSS bundle），直接固定 `base="/es"` 会导致：

- `npm run dev` 时，`/es/` 路由和本地文件系统的路由不匹配，资源 404
- `npm run build` 时，必须带 `/es/` 前缀才能正确部署到 CDN 子目录

因此需要一套**dev 和 build 行为分离**的方案：dev 下不加 locale 前缀，build 时自动注入。

---

## 涉及文件（8 个）

| 文件 | 操作 | 目的 |
|---|---|---|
| `package.json` | 修改 | 脚本和环境变量控制 |
| `scripts/sync-public.mjs` | 新建 | 交互式 rclone 同步询问 |
| `i18n.config.json` | 修改 | 修正默认语言声明 |
| `src/config/config.json` | 修改 | 移除硬编码 locale 前缀 |
| `src/config/menu.json` | 修改 | 移除所有 URL 中的硬编码 locale 前缀 |
| `scripts/prepend-locale.mjs` | 新建 | build 前注入 locale 前缀 |
| `scripts/restore-menu.mjs` | 新建 | build 后恢复源码干净状态 |
| `.gitignore` | 修改 | 忽略临时备份文件 |

---

## 1. `package.json` — 脚本和环境变量

### 改动说明

用 `ASTRO_BASE` 环境变量显式控制 dev 和 build 的 `base` 值，不再依赖 `config.json` 的 `base_path`。

新增 `postbuild` 钩子在构建后自动恢复被修改的配置文件。

新增 `prebuild` 钩子注入 locale 前缀（在交互式 rclone 同步之后执行）。

rclone 同步改为交互式：`predev` / `prebuild` 通过 `node scripts/sync-public.mjs` 调起交互式询问，用户可选择跳过。网络不通或未安装 rclone 时自动跳过，不会阻断后续编译。

### 最终状态

```json
"scripts": {
  "sync-public": "rclone copy ./public r2:public --config ./rclone.conf --checksum --verbose",
  "predev": "node scripts/sync-public.mjs",
  "prebuild": "node scripts/sync-public.mjs && node scripts/prepend-locale.mjs",
  "postbuild": "node scripts/restore-menu.mjs",
  "dev": "ASTRO_BASE=/ node --max-old-space-size=8192 ./node_modules/.bin/astro dev",
  "build": "ASTRO_BASE=/$(node -p \"require('./i18n.config.json').activeLocale\") node --max-old-space-size=8192 ./node_modules/.bin/astro build",
  "preview": "node --max-old-space-size=8192 ./node_modules/.bin/astro preview",
  "format": "prettier -w ./src"
}
```

### 关键逻辑

`ASTRO_BASE` 的值**不是固定的**，取决于当前语言目录：

| 语言目录 | `ASTRO_BASE` |
|---|---|
| `linkjobai_es` | `/es` |
| `linkjobai_en` | `/en` |
| `linkjobai_ja` | `/ja` |
| ... | `/{locale}` |

```
dev:   ASTRO_BASE=/          → 不加 locale 前缀 → URL: /pricing, /features
build: ASTRO_BASE=/{locale}  → 加 locale 前缀   → URL: /es/pricing, /es/features
```

如果在其他语言目录（如 `en`、`ja`），把 `/es` 替换为对应 locale 即可。

---

## 2. `scripts/sync-public.mjs` — 交互式 rclone 同步（新建）

### 功能

在 `predev` / `prebuild` 钩子中被调用，执行以下逻辑：

1. 检测 `rclone` 是否已安装 → 未安装则直接退出，不中断后续流程
2. 已安装时询问用户：`Sync public assets to R2? (y/N)`
3. 输入 `y` → 执行 rclone sync
4. 输入其他（含直接回车）→ 跳过同步
5. 同步过程中出错 → 打印警告后退出，不中断后续流程

### 完整代码

```js
import { execSync } from "node:child_process";
import { createInterface } from "node:readline/promises";

const rcloneAvailable = (() => {
  try {
    execSync("command -v rclone", { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
})();

if (!rcloneAvailable) {
  console.log("[sync-public] rclone not found, skipping sync");
  process.exit(0);
}

const rl = createInterface({ input: process.stdin, output: process.stdout });

try {
  const answer = await rl.question("[sync-public] Sync public assets to R2? (y/N) ");
  if (answer.trim().toLowerCase() === "y") {
    console.log("[sync-public] syncing...");
    execSync(
      "rclone copy ./public r2:public --config ./rclone.conf --checksum --verbose",
      { stdio: "inherit" }
    );
    console.log("[sync-public] done");
  } else {
    console.log("[sync-public] skipped by user");
  }
} catch (err) {
  console.log("[sync-public] sync failed, continuing anyway:", err.message);
} finally {
  rl.close();
}
```

### 为什么用交互式而非 `|| true`

之前的方案是 `rclone ... || true`，网络不通时命令报错但通过 `|| true` 吞掉错误。问题是：

- **无法选择**：每次 `npm run dev` / `npm run build` 都会尝试同步，耗费时间
- **信息不可见**：用户不知道同步是否成功、是否被跳过

交互式方案让用户完全掌控：看到提示后可主动选择跳过或执行。

### 应用到其他语言

此文件**无需修改**，所有语言项目完全相同。

---

## 3. `i18n.config.json` — 修正默认语言声明

### 改动说明

`defaultLocale` 从 `"es"` 改为 `"en"`。`defaultLocale` 表示所有语言项目的共享默认语言，应为英文，而非当前语言目录的语言。

### 改动内容

```diff
 {
   "globalEnabled": true,
   "activeLocale": "es",
-  "defaultLocale": "es",
+  "defaultLocale": "en",
   "supportedLocales": [
```

### 应用到其他语言

此修改适用于**所有语言目录**，`defaultLocale` 统一设为 `"en"`，无需按语言调整。

---

## 4. `src/config/config.json` — 去掉硬编码 locale

### 改动说明

`base_path` 从 `/es` 改为 `/`，因为现在通过 `ASTRO_BASE` 环境变量控制。

`navigation_button.link` 去掉 `/es/` 前缀，因为 build 时脚本会自动注入。

### 改动内容

```diff
-    "base_path": "/es",
+    "base_path": "/",
```

```diff
  "navigation_button": {
    "enable": true,
    "label": "Descargar Gratis",
-    "link": "/es/downloads/"
+    "link": "/downloads/"
  },
```

---

## 5. `src/config/menu.json` — 去掉所有 URL 中的硬编码 locale

### 改动说明

`menu.json` 中的链接分为两类，处理方式不同：

**A 类：本语言内的页面链接（需要 locale 前缀）**

所有以 `/es/` 开头的 URL 去掉 `/es/` 前缀，改为从根路径 `/` 开始。build 时由 `prepend-locale.mjs` 自动注入。

```
/es/                              → /
/es/interview-copilot             → /interview-copilot
/es/coding-interview-copilot      → /coding-interview-copilot
/es/ai-mock-interview             → /ai-mock-interview
/es/pricing                       → /pricing
/es/about                         → /about
/es/contact                       → /contact
/es/privacy-policy                → /privacy-policy
/es/terms                         → /terms
/es/features                      → /features
```

**B 类：跨语言 / 跨版块链接（不需要 locale 前缀）**

`hub/`、`interview-questions/` 等版块不属于当前语言的子目录，直接使用完整 URL `https://www.senseiai.me/...`。这样既不需要 locale 前缀，dev 和 build 行为也完全一致，脚本无需处理。

改动清单：

```
/hub/                                            → https://www.senseiai.me/hub/
/interview-questions/                            → https://www.senseiai.me/interview-questions/
/hub/customize-...-faq/                          → https://www.senseiai.me/hub/customize-...-faq/
/account/subscription                            → https://www.senseiai.me/account/subscription
/hub/parakeet-ai-review-.../                     → https://www.senseiai.me/hub/parakeet-ai-review-.../
/interview-questions/free-ai-interview-assistant/→ https://www.senseiai.me/interview-questions/.../
...（所有 quickLinks / Alternatives / Undetectable Help / Reviews 同理）
```

> 注意：`https://discord.com/...` 无需修改。

### 为什么 B 类用完整 URL

跨语言/跨版块的链接服务于所有语言，如果使用相对路径 `/hub/...`，在 `base=/es` 的 build 产物中会被解析为 `/es/hub/...`，但 `hub` 版块实际部署在根路径下，并非 `/es/` 子目录。使用完整 URL 彻底规避了 locale 前缀对跨版块链接的干扰。

### 应用到其他语言

如果要将此方案复制到其他语言目录（如 `en`、`ja`）：

- A 类链接：把所有 `/{locale}/` 前缀去掉即可
- B 类链接：维持完整 URL `https://www.senseiai.me/...`，无需修改

---

## 6. `scripts/prepend-locale.mjs` — build 前注入脚本（新建）

### 功能

在 `npm run build` 执行前（`prebuild` 钩子），
1. 从 `i18n.config.json` 读取 `activeLocale`，动态获取当前语言的 locale（如 `es`、`en`、`ja`）
2. 备份 `menu.json` → `menu.json.bak`
3. 给 `menu.json` 中指定页面的 URL 注入 `/{locale}/` 前缀
4. 备份 `config.json` → `config.json.bak`
5. 给 `config.json` 中 `navigation_button.link` 注入 `/{locale}/` 前缀

locale 值不再硬编码，而是从 `i18n.config.json` 动态读取，因此该脚本在所有语言目录中**无需修改**即可正常工作。

### 完整代码

```js
import { copyFile, readFile, writeFile } from "node:fs/promises";

const i18nConfig = JSON.parse(await readFile("i18n.config.json", "utf-8"));
const locale = i18nConfig.activeLocale;

const MENU_PATH = "src/config/menu.json";
const MENU_BAK_PATH = "src/config/menu.json.bak";
const CONFIG_PATH = "src/config/config.json";
const CONFIG_BAK_PATH = "src/config/config.json.bak";

const pages = [
  "about",
  "contact",
  "privacy-policy",
  "terms",
  "account/subscription",
  "features",
  "interview-copilot",
  "coding-interview-copilot",
  "ai-mock-interview",
  "pricing",
];

const pattern = new RegExp(
  `"url":\\s*"/(${pages.join("|")})([/"]|$)`,
  "g"
);

const raw = await readFile(MENU_PATH, "utf-8");
await copyFile(MENU_PATH, MENU_BAK_PATH);

let replaced = raw.replace(pattern, (match, page, suffix) => {
  if (suffix === "/") {
    return `"url": "/${locale}/${page}/"`;
  }
  if (suffix === '"') {
    return `"url": "/${locale}/${page}"`;
  }
  return `"url": "/${locale}/${page}${suffix}"`;
});

replaced = replaced.replace(`"url": "/"`, `"url": "/${locale}/"`);

await writeFile(MENU_PATH, replaced, "utf-8");
console.log(`[prebuild] menu.json: /${locale}/ prefix injected`);

const configRaw = await readFile(CONFIG_PATH, "utf-8");
await copyFile(CONFIG_PATH, CONFIG_BAK_PATH);
const configReplaced = configRaw.replace(
  /"link":\s*"\/(downloads\/?)"/g,
  `"link": "/${locale}/$1"`
);
await writeFile(CONFIG_PATH, configReplaced, "utf-8");
console.log(`[prebuild] config.json: /${locale}/ prefix injected for navigation_button.link`);
```

### `pages` 数组说明

`pages` 数组列出了所有属于当前语言子目录的页面。脚本的正则只匹配以 `"/` 开头的 `"url"` 字段，所以被转为完整 URL 的 `account/subscription`（现在是 `https://www.senseiai.me/account/subscription`）不会被匹配到。保留在数组中无害，也可以移除。

### 应用到其他语言

此文件**无需修改**，所有语言项目完全相同。locale 值自动从 `i18n.config.json` 中读取。

---

## 7. `scripts/restore-menu.mjs` — build 后恢复脚本（新建）

### 功能

在 `npm run build` 执行后（`postbuild` 钩子），
1. 用 `menu.json.bak` 恢复 `menu.json`，删除备份
2. 用 `config.json.bak` 恢复 `config.json`，删除备份
3. 任一备份缺失时跳过对应文件（不中断）

### 完整代码

```js
import { existsSync } from "node:fs";
import { copyFile, rm } from "node:fs/promises";

function restorable(bakPath, label) {
  if (!existsSync(bakPath)) {
    console.log(`[postbuild] ${label} no backup found, skip restore`);
    return false;
  }
  return true;
}

const MENU_BAK_PATH = "src/config/menu.json.bak";
const MENU_PATH = "src/config/menu.json";

if (restorable(MENU_BAK_PATH, "menu.json")) {
  await copyFile(MENU_BAK_PATH, MENU_PATH);
  await rm(MENU_BAK_PATH);
  console.log("[postbuild] menu.json: restored from backup");
}

const CONFIG_BAK_PATH = "src/config/config.json.bak";
const CONFIG_PATH = "src/config/config.json";

if (restorable(CONFIG_BAK_PATH, "config.json")) {
  await copyFile(CONFIG_BAK_PATH, CONFIG_PATH);
  await rm(CONFIG_BAK_PATH);
  console.log("[postbuild] config.json: restored from backup");
}
```

### 应用到其他语言

此文件**无需修改**，它在所有语言项目中完全相同。

---

## 8. `.gitignore` — 忽略备份文件

### 改动内容

在文件末尾添加一行：

```
*.bak
```

### 目的

`prebuild` 脚本会生成 `*.bak` 备份文件，`postbuild` 脚本会删除它们。但如果 build 中途中断，残留的 `.bak` 文件不应被 Git 追踪。

---

## 完整构建流程

```
npm run build

  ├── prebuild:
  │     ├── sync-public.mjs: 交互式询问是否 rclone 同步
  │     ├── prepend-locale.mjs: 备份 → 注入 /es/ 前缀 → 写入
  │     │    menu.json:    "/pricing" → "/es/pricing"
  │     │    config.json:  "/downloads/" → "/es/downloads/"
  │     └── .bak 备份文件已就位
  │
  ├── astro build (ASTRO_BASE=/es)
  │     └── 产物路径: /es/_astro/...   /es/images/...
  │         页面 URL:  /es/pricing     /es/features
  │         导航链接:  /es/pricing     /es/features  ← 来自注入后的 menu.json
  │
  └── postbuild:
        ├── restore-menu.mjs: 覆盖 → 删除备份
        │    menu.json    → 恢复为 "/pricing" 等
        │    config.json  → 恢复为 "/downloads/"
        └── .bak 文件全部清理，源码干净 ✅
```

## dev 流程

```
npm run dev

  ├── predev: sync-public.mjs (交互式询问是否 rclone 同步)
  ├── astro dev (ASTRO_BASE=/)
  │     └── 页面 URL:   /pricing     /features    (无 /es/ 前缀)
  │     └── 资源路径:   /images/...  /_astro/...  (无 /es/ 前缀)
  │     └── 导航链接:   /pricing     /features    ← menu.json 中无 /es/
```

---

## 复制到其他语言目录的步骤

假设要将 `ja` 语言的项目也应用此方案：

1. **`i18n.config.json`**：
   - `activeLocale` 设为目标语言（如 `"ja"`），`package.json` 的 build 命令会自动读取
   - `defaultLocale` 应为 `"en"`，如果不是请修改

2. **`config.json`**：确认 `base_path` 为 `"/"`，`navigation_button.link` 无 locale 前缀

3. **`menu.json`**：确认所有 URL 无 `/ja/` 前缀（与当前 `es` 项目的最终状态一致）

4. **`scripts/sync-public.mjs`**：无需修改，所有语言项目完全相同

5. **`scripts/prepend-locale.mjs`**：无需修改，locale 自动从 `i18n.config.json` 读取

6. **`scripts/restore-menu.mjs`**：无需修改

7. **`.gitignore`**：确保包含 `*.bak`
