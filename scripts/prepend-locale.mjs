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