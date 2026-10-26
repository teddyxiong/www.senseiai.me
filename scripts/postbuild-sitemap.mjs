import { readFile, copyFile, writeFile } from "node:fs/promises";

const I18N_PATH = "i18n.config.json";
const SITEMAP_INDEX = "dist/sitemap-index.xml";
const SITEMAP_URLS = "dist/sitemap-0.xml";
const SITEMAP = "dist/sitemap.xml";
const BASE_URL = "https://www.senseiai.me";
const EXCLUDED_URLS = new Set([
  `${BASE_URL}/cart/`,
  `${BASE_URL}/checkout/continue/`,
]);

const i18nConfig = JSON.parse(await readFile(I18N_PATH, "utf-8"));

if (i18nConfig.activeLocale !== "en") {
  console.log("[postbuild-sitemap] activeLocale is not 'en', skipping sitemap enrichment");
  process.exit(0);
}

let sitemapUrls = await readFile(SITEMAP_URLS, "utf-8");
sitemapUrls = sitemapUrls.replace(/<url>[\s\S]*?<\/url>/g, (urlNode) => {
  const location = urlNode.match(/<loc>([^<]+)<\/loc>/)?.[1];
  return location && EXCLUDED_URLS.has(location) ? "" : urlNode;
});
await writeFile(SITEMAP_URLS, sitemapUrls, "utf-8");
console.log("[postbuild-sitemap] excluded private flow URLs from sitemap-0.xml");

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
  entries.push(`  <sitemap>
    <loc>${BASE_URL}/glossary/sitemap.xml</loc>
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
