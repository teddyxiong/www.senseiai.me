import mdx from "@astrojs/mdx";
import react from "@astrojs/react";
import sitemap from "@astrojs/sitemap";
import tailwind from "@astrojs/tailwind";
import AutoImport from "astro-auto-import";
import { defineConfig } from "astro/config";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { readFile, writeFile, readdir } from "node:fs/promises";
import { join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";
import remarkCollapse from "remark-collapse";
import remarkToc from "remark-toc";
import config from "./src/config/config.json";
//import node from "@astrojs/node";

const i18nConfig = JSON.parse(
  readFileSync(new URL("./i18n.config.json", import.meta.url), "utf-8"),
);
if (!i18nConfig || typeof i18nConfig !== "object") {
  throw new Error("Invalid i18n.config.json");
}


// https://astro.build/config
export default defineConfig({
  site: config.site.base_url ? config.site.base_url : "https://www.senseiai.me",
  base: process.env.ASTRO_BASE || (config.site.base_path || "/en"),
  //trailingSlash: config.site.trailing_slash ? "always" : "never",
  trailingSlash: "ignore",
  image: {
    // service: {
    //   entrypoint: "astro/assets/services/sharp",
    // },
  },


  integrations: [
    react(),
    sitemap({
      filenameBase: 'sitemap',
      filter: (page) => {
        // Exclude admin and test pages
        if (page.includes('/admin/') || page.includes('/test/')|| page.includes('/solutions/')|| page.includes('/sections/')|| page.includes('/tags/')|| page.includes('/categories/')|| page.includes('/blog/')|| page.includes('/case-study/')|| page.includes('/payment-success/')|| page.includes('/interview-notes-privacy-policy/')) {
          return false;
        }
        // Exclude case-study pages with numeric patterns like /case-study/case-1/
        if (/\/case-study\/case-\d+\//i.test(page)) {
          return false;
        }
        return true;
      },
      changefreq: 'monthly', // 默认更新频率
      priority: 0.5, // 默认优先级
      lastmod: new Date(),
      // Limit the number of URLs in each sitemap file
      entryLimit: 1000,
      
      // Customize sitemap grouping
      serialize: (item) => {
       
        // Get the first level directory from URL
        const urlPath = new URL(item.url).pathname;
        const pathParts = urlPath.split('/');
        const firstDir = pathParts[2];
        const secondDir = pathParts[3];
        
        // Return different configurations based on directory
        const baseConfig = {
          url: item.url,
          lastmod: item.lastmod,
        };
    
        // 首页配置
        if (urlPath === '/ja/' || urlPath === '/ja') {
          return {
            ...baseConfig,
            changefreq: 'monthly',
            priority: 1.0,
            sitemap: 'sitemap-homepage'
          };
        }
        
        // 其余配置保持不变...
        // 博客列表页和分类列表页配置
        if (firstDir === 'blog' && !secondDir) {
          return {
            ...baseConfig,
            changefreq: 'weekly',
            priority: 0.8,
            sitemap: 'sitemap-blog-index'
          };
        }
        
        if (firstDir === 'categories' && !secondDir) {
          return {
            ...baseConfig,
            changefreq: 'weekly',
            priority: 0.8,
            sitemap: 'sitemap-categories-index'
          };
        }
        
        // 博客文章页面配置
        if (firstDir === 'blog' && secondDir) {
          return {
            ...baseConfig,
            url: item.url.endsWith('/') ? item.url.slice(0, -1) : item.url,
            changefreq: 'monthly',
            priority: 0.5,
            sitemap: 'sitemap-blog-posts'
          };
        }
        
        // 具体分类页面配置
        if (firstDir === 'categories' && secondDir) {
          return {
            ...baseConfig,
            changefreq: 'weekly',
            priority: 0.8,
            sitemap: 'sitemap-categories-detail'
          };
        }        
        // 默认配置
        return {
          ...baseConfig,
          changefreq: 'monthly',
          priority: 0.5,
          sitemap: 'sitemap-others'
        };
      },
    }),
    tailwind({
      applyBaseStyles: false,
    }),
    AutoImport({
      imports: [
        "@/shortcodes/Button",
        "@/shortcodes/Accordion",
        "@/shortcodes/Notice",
        "@/shortcodes/Video",
        "@/shortcodes/Youtube",
        "@/shortcodes/Tabs",
        "@/shortcodes/Tab",
      ],
    }),
mdx(),
    {
      name: 'r2-asset-rewrite',
      hooks: {
        'astro:build:done': async ({ dir }) => {
          const base = config.site.asset_base_url;
          if (!base) return;
          const publicDir = fileURLToPath(new URL("./public/", import.meta.url));

          async function* walk(dirPath) {
            const entries = await readdir(dirPath, { withFileTypes: true });
            for (const entry of entries) {
              const full = join(dirPath, entry.name);
              if (entry.isDirectory()) {
                yield* walk(full);
              } else {
                yield full;
              }
            }
          }

          const assetVersions = new Map();
          for await (const file of walk(publicDir)) {
            const assetPath = relative(publicDir, file).split(sep).join("/");
            if (!/^(images|fonts|videos)\//.test(assetPath)) continue;
            const hash = createHash("sha256")
              .update(await readFile(file))
              .digest("hex")
              .slice(0, 12);
            assetVersions.set(assetPath, hash);
          }

          const versionedAssetUrl = (type, assetPath) => {
            if (
              type === "images" &&
              (assetPath.startsWith("features/icon_") ||
                assetPath === "features/interviewer.png" ||
                assetPath === "features/linkjob-mark.png")
            ) {
              return `/${type}/${assetPath}`;
            }
            if (type === "images" && assetPath.startsWith("dual-device/")) {
              return `/${type}/${assetPath}`;
            }
            const version = assetVersions.get(`${type}/${assetPath}`);
            return `${base}/${type}/${assetPath}${version ? `?v=${version}` : ""}`;
          };
          const escapedBase = base.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
          const absoluteAssetPattern = new RegExp(
            `${escapedBase}/(images|fonts|videos)/([^\\"'\`\\s)<>?#]+)`,
            "g",
          );

          const files = [];
          for await (const f of walk(dir.pathname)) {
            if (/\.(html|js|css)$/.test(f)) files.push(f);
          }

          await Promise.all(files.map(async (fullPath) => {
            let content = await readFile(fullPath, 'utf-8');
            const updated = content
              .replace(
                absoluteAssetPattern,
                (_, type, assetPath) => versionedAssetUrl(type, assetPath),
              )
              .replace(
                /([\"'`])\/(?:[a-z]{2}(?:-[a-z]+)?\/)?(images|fonts|videos)\/([^\"'`\s)<>?#]+)/g,
                (_, quote, type, assetPath) => `${quote}${versionedAssetUrl(type, assetPath)}`,
              )
              .replace(
                /url\(\s*(['"])?\s*\/(?:[a-z]{2}(?:-[a-z]+)?\/)?(images|fonts|videos)\/([^'"\s)<>?#]+)/g,
                (_, quote, type, assetPath) => `url(${quote || ""}${versionedAssetUrl(type, assetPath)}`,
              );
            if (updated !== content) await writeFile(fullPath, updated, 'utf-8');
          }));
        }
      }
    },
  ],

  markdown: {
    remarkPlugins: [
      remarkToc,
      [
        remarkCollapse,
        {
          test: "Table of contents",
        },
      ],
    ],
    shikiConfig: {
      theme: "one-dark-pro",
      wrap: true,
      defaultLang: 'text',
    },
    extendDefaultPlugins: true,
    sanitize: false, // Allow HTML rendering
  },

  //adapter: node({
  //  mode: "standalone",
  //}),
  output: "static",
});
