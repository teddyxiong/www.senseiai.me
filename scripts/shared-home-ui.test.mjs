import assert from "node:assert/strict";
import { readFile, readdir, stat } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import test, { before } from "node:test";

before(() => {
  const build = spawnSync(
    process.execPath,
    ["--max-old-space-size=8192", "./node_modules/.bin/astro", "build"],
    {
      cwd: process.cwd(),
      encoding: "utf8",
      env: { ...process.env, ASTRO_BASE: "/" },
    },
  );

  assert.equal(
    build.status,
    0,
    `Astro build failed:\n${build.stdout}\n${build.stderr}`,
  );
});

test('every "See plans" button lifts on hover', async () => {
  const assetNames = await readdir("dist/_astro");
  const stylesheets = await Promise.all(
    assetNames
      .filter((name) => name.endsWith(".css"))
      .map((name) => readFile(`dist/_astro/${name}`, "utf8")),
  );

  assert.match(
    stylesheets.join("\n"),
    /\.btn-download-secondary:hover\{[^}]*transform:translateY\(-1px\)/,
  );
});

test("every published FAQ uses the homepage style and keeps its own content", async () => {
  const pages = [
    ["dist/index.html", "What is an AI interview assistant"],
    ["dist/about/index.html", "What is an AI interview assistant"],
    ["dist/pricing/index.html", "What is your refund policy"],
    ["dist/interview-copilot/index.html", "What is an AI interview copilot"],
    [
      "dist/coding-interview-copilot/index.html",
      "Why can Sensei AI remain completely undetectable",
    ],
    ["dist/ai-mock-interview/index.html", "What is AI Mock Interview"],
  ];

  for (const [path, expectedQuestion] of pages) {
    const html = await readFile(path, "utf8");
    assert.match(html, /class="section pb-0 faq-home /, path);
    assert.match(html, new RegExp(expectedQuestion), path);
  }

  const pricing = await readFile("dist/pricing/index.html", "utf8");
  assert.match(pricing, /id="faq-1"/);
});

test("the featured popular post renders trusted inline HTML in its title", async () => {
  const homepage = await readFile("dist/index.html", "utf8");

  assert.match(
    homepage,
    /Invisible AI Interview Assistant:<br\s*\/?>How Sensei AI Works/,
  );
  assert.doesNotMatch(homepage, /Invisible AI Interview Assistant:&lt;br/);
});

test("RSS article thumbnails render at a consistent 11:6 ratio", async () => {
  const assetNames = await readdir("dist/_astro");
  const [rssCardSource, stylesheets] = await Promise.all([
    readFile("src/layouts/components/RSSCard.astro", "utf8"),
    Promise.all(
      assetNames
        .filter((name) => name.endsWith(".css"))
        .map((name) => readFile(`dist/_astro/${name}`, "utf8")),
    ),
  ]);

  assert.match(
    rssCardSource,
    /<img\s+class="[^"]*aspect-square[^"]*md:aspect-\[11\/6\][^"]*"/,
  );
  assert.match(
    rssCardSource,
    /text-\[16px\] font-bold leading-snug[^"']*md:text-\[18px\] md:font-medium lg:text-\[20px\]/,
  );
  assert.match(
    rssCardSource,
    /loading="lazy"[\s\S]*?decoding="async"[\s\S]*?fetchpriority="low"/,
  );
  assert.match(
    rssCardSource,
    /width="660"[\s\S]*?height="360"[\s\S]*?sizes="\(min-width: 1280px\) 33vw, \(min-width: 768px\) 50vw, 84px"/,
  );
  assert.match(stylesheets.join("\n"), /aspect-ratio:11\/6/);
});

test("platform rows reserve separate responsive columns for their status", async () => {
  const homepage = await readFile("dist/index.html", "utf8");

  assert.match(
    homepage,
    /xl:grid-cols-\[minmax\(180px,1fr\)_minmax\(0,2fr\)_auto\]/,
  );
  assert.doesNotMatch(homepage, /lg:absolute lg:left-\[52%\]/);
});

test("article CTA arrows stay hidden until the buttons have enough width", async () => {
  const homepage = await readFile("dist/index.html", "utf8");
  const arrowClasses = [
    ...homepage.matchAll(
      /<img[^>]+src="[^"]*\/images\/icons\/arrow-white\.png(?:\?v=[a-f0-9]{12})?"[^>]+class="([^"]+)"/g,
    ),
  ].map((match) => match[1]);

  const responsiveArrowClasses = arrowClasses.filter((className) =>
    className.includes("xl:block"),
  );
  assert.equal(responsiveArrowClasses.length, 2);
  for (const className of responsiveArrowClasses) {
    assert.match(className, /\bhidden\b/);
  }
});

test("RSS cards are build-time HTML with no client refresh bundle", async () => {
  const assetNames = await readdir("dist/_astro");
  const rssScriptName = assetNames.find(
    (name) => name.startsWith("RSSFeed.astro_") && name.endsWith(".js"),
  );
  const rssSource = await readFile(
    "src/layouts/components/RSSFeed.astro",
    "utf8",
  );
  const rssUtils = await readFile("src/lib/utils/rssUtils.ts", "utf8");

  assert.equal(rssScriptName, undefined);
  assert.doesNotMatch(rssSource, /refreshRSSData|setInterval|astro:page-load/);
  assert.doesNotMatch(rssUtils, /localStorage|refreshRSSData/);
});

test("homepage defers non-critical scripts and live interview video bytes", async () => {
  const [homepage, baseSource, liveInterviewSource] = await Promise.all([
    readFile("dist/index.html", "utf8"),
    readFile("src/layouts/Base.astro", "utf8"),
    readFile("src/layouts/partials/LiveInterviewAnimation.astro", "utf8"),
  ]);

  assert.equal(
    (baseSource.match(/https:\/\/www\.googletagmanager\.com\//g) || []).length,
    2,
    "only the GTM script and noscript iframe should remain",
  );
  assert.doesNotMatch(baseSource, /gtag\/js\?id=/);
  assert.match(baseSource, /requestIdleCallback/);
  assert.match(baseSource, /pointerdown/);
  assert.doesNotMatch(baseSource, /autoDownloadClient\.ts\?url/);
  assert.doesNotMatch(baseSource, /data-home-hero-video/);
  assert.doesNotMatch(homepage, /data:video\/mp2t/);

  assert.match(
    liveInterviewSource,
    /data-src="\/images\/liveinterview\/people\.webm"/,
  );
  assert.match(
    liveInterviewSource,
    /src="\/images\/liveinterview\/background\.webp"/,
  );
  assert.doesNotMatch(liveInterviewSource, /static-preview\.webp/);
  assert.match(
    liveInterviewSource,
    /data-src="\/images\/liveinterview\/(?:overlay|listening|questionbubble|answerbubble)\.webp"/,
  );
  assert.equal(
    (liveInterviewSource.match(/fetchpriority="high"/g) || []).length,
    1,
    "only the clean hero background should receive high priority",
  );
  assert.match(liveInterviewSource, /preload="none"/);
  assert.match(liveInterviewSource, /\bloop\b/);
  assert.doesNotMatch(liveInterviewSource, /\sautoplay(?:\s|>)/);
  assert.match(liveInterviewSource, /capability:activate/);
  assert.match(liveInterviewSource, /IntersectionObserver/);
  assert.match(liveInterviewSource, /visibilitychange/);
});

test("homepage preloads only the two above-the-fold font weights", async () => {
  const homepage = await readFile("dist/index.html", "utf8");
  assert.doesNotMatch(homepage, /rel="preconnect" href="https:\/\/images\./);
  assert.equal((homepage.match(/rel="preload" as="font"/g) || []).length, 2);
  assert.match(homepage, /href="\/fonts\/primary\/font-primary-regular\.woff2"/);
  assert.match(homepage, /href="\/fonts\/secondary\/font-secondary-bold\.woff2"/);
  assert.doesNotMatch(homepage, /font-primary-normal\.woff2/);
});

test("largest local homepage images stay within their transfer budgets", async () => {
  const budgets = {
    "public/images/undetectable/overlay.webp": 110_000,
    "public/images/features/interview-copilot-cover.webp": 120_000,
    "public/images/undetectable/lynccontainer.webp": 100_000,
    "public/images/liveinterview/background.webp": 110_000,
    "public/images/liveinterview/people.webm": 500_000,
  };

  for (const [path, maxBytes] of Object.entries(budgets)) {
    const file = await stat(path);
    assert.ok(
      file.size <= maxBytes,
      `${path} is ${file.size} bytes; budget is ${maxBytes}`,
    );
  }
});

test("production assets stay on the site origin", async () => {
  const [homepage, astroConfig, packageJson] = await Promise.all([
    readFile("dist/index.html", "utf8"),
    readFile("astro.config.mjs", "utf8"),
    readFile("package.json", "utf8"),
  ]);

  assert.doesNotMatch(homepage, /indexbg-gradient\.webp/);
  assert.doesNotMatch(homepage, /https:\/\/images\.(?:senseiai\.me|linkjob\.ai)/i);
  assert.doesNotMatch(astroConfig, /r2-asset-rewrite/);
  assert.doesNotMatch(packageJson, /sync-public|rclone copy/);
});

test("the production build keeps dual-device layers on the site origin", async () => {
  const homepage = await readFile("dist/index.html", "utf8");

  for (const file of ["background", "highlight", "answer"]) {
    assert.match(
      homepage,
      new RegExp(`(?:src|data-src)="/images/dual-device/${file}\\.webp"`),
    );
    assert.doesNotMatch(
      homepage,
      new RegExp(
        `images\\.(?:senseiai\\.me|linkjob\\.ai)/images/dual-device/${file}\\.webp`,
        "i",
      ),
    );
  }

  assert.doesNotMatch(
    homepage,
    /\/images\/dual-device\/(?:highlight1|highlight2|question)\.webp/,
  );

  assert.match(homepage, /\/images\/liveinterview\/background\.webp/);
  assert.doesNotMatch(homepage, /https:\/\/images\./);
});

test("homepage components do not retain superseded demo and RSS styles", async () => {
  const [undetectableSource, rssFeedSource, componentStyles] =
    await Promise.all([
      readFile("src/layouts/partials/undetectable.astro", "utf8"),
      readFile("src/layouts/components/RSSFeed.astro", "utf8"),
      readFile("src/styles/components.scss", "utf8"),
    ]);

  assert.doesNotMatch(
    undetectableSource,
    /\{\/\*\s*<div\s+class="undetectable-demo-video/,
  );
  assert.doesNotMatch(
    undetectableSource,
    /@media \(max-width: 639px\)[\s\S]*?\.undetectable-demo-grid\.has-active-card/,
  );
  assert.doesNotMatch(undetectableSource, /grid-area:\s*1\s*\/\s*1/);
  assert.match(
    undetectableSource,
    /const ResizeObserverConstructor = window\.ResizeObserver;[\s\S]*?if \(typeof ResizeObserverConstructor === "function"\)[\s\S]*?new ResizeObserverConstructor\(syncWidth\)[\s\S]*?\}\s*else\s*\{\s*window\.addEventListener\("resize", syncWidth\);/,
  );
  assert.doesNotMatch(rssFeedSource, /\.rss-item/);
  assert.doesNotMatch(componentStyles, /indexbg-indexbg-gradient\.webp/);
  assert.doesNotMatch(componentStyles, /indexbg-gradient\.webp/);
  assert.match(componentStyles, /radial-gradient\(/);
  assert.match(componentStyles, /linear-gradient\([^)]*#fff/);
});

test("the navbar renders the correct breakpoint layout on the first paint", async () => {
  const homepage = await readFile("dist/index.html", "utf8");
  const assetNames = await readdir("dist/_astro");
  const [scripts, stylesheets] = await Promise.all([
    Promise.all(
      assetNames
        .filter((name) => name.endsWith(".js"))
        .map((name) => readFile(`dist/_astro/${name}`, "utf8")),
    ),
    Promise.all(
      assetNames
        .filter((name) => name.endsWith(".css"))
        .map((name) => readFile(`dist/_astro/${name}`, "utf8")),
    ),
  ]);

  assert.match(homepage, /class="navbar"/);
  assert.doesNotMatch(homepage, /class="navbar navbar-compact"/);
  assert.match(homepage, /class="[^"]*desktop-header-actions[^"]*"/);
  assert.doesNotMatch(
    scripts.join("\n"),
    /needsCompactNavbar|getBoundingClientRect\(\).*navbar/,
  );
  assert.match(
    stylesheets.join("\n"),
    /@media\(min-width:1344px\)[^{]*\{[\s\S]*?\.navbar[^,{]* \.navbar-nav[^,{]*\{[^}]*position:absolute;[^}]*left:50%;[^}]*transform:translate\(-50%\)/,
  );
  assert.match(stylesheets.join("\n"), /@media\(max-width:1343px\)/);
});

test("the header hides locale, account, and download controls", async () => {
  const homepage = await readFile("dist/index.html", "utf8");

  assert.doesNotMatch(homepage, /Language Package/);
  assert.doesNotMatch(homepage, /js-locale-switch-link/);
  assert.doesNotMatch(homepage, /account-nav-mobile/);
  assert.doesNotMatch(homepage, />Download Now</);
});

test("the homepage shows the Linkjob migration banner directly below the header", async () => {
  const homepage = await readFile("dist/index.html", "utf8");
  const headerEnd = homepage.indexOf("</header>");
  const bannerStart = homepage.indexOf("<aside data-home-migration-banner");
  const heroStart = homepage.indexOf('class="home-hero');

  assert.ok(headerEnd >= 0 && headerEnd < bannerStart);
  assert.ok(bannerStart < heroStart);
  assert.match(
    homepage,
    /<p[^>]*class="[^"]*font-secondary[^"]*"[^>]*>\s*🚀 We(?:'|&apos;|&#39;)ve Moved to Linkjob AI!\s*<\/p>/,
  );
  assert.match(homepage, /Sensei AI has officially moved to <strong[^>]*>Linkjob AI<\/strong>/);
  assert.match(homepage, /background-color:\s*#1d40b0/);
  assert.match(homepage, /href="https:\/\/www\.linkjob\.ai\/"/);
  assert.match(homepage, />\s*Go to Linkjob AI →\s*<\/a>/);
});

test("homepage headings and account controls reserve stable geometry", async () => {
  const [homepage, accountNav] = await Promise.all([
    readFile("dist/index.html", "utf8"),
    readFile("src/layouts/helpers/AccountNav.tsx", "utf8"),
  ]);

  assert.doesNotMatch(homepage, /max-w-\[30ch\]/);
  assert.match(homepage, /home-hero-title[^"']*max-w-\[1000px\]/);
  assert.match(
    accountNav,
    /viewState === "unknown" \|\| viewState === "error"/,
  );
  assert.doesNotMatch(accountNav, /account-nav-slot/);
});

test("the hero background wrapper ends before the remaining homepage sections", async () => {
  const source = await readFile("src/pages/index.astro", "utf8");
  const heroStart = source.indexOf('<section\n    class="home-hero');
  const bannerEnd = source.indexOf("<!-- /.banner -->");
  const featuresStart = source.indexOf("<!-- 3. features -->");

  assert.ok(
    heroStart > 0 && bannerEnd > heroStart && featuresStart > bannerEnd,
  );
  assert.match(source.slice(heroStart, bannerEnd), /<\/section>\s*$/);
});

test("homepage decorative backgrounds use CSS and one reusable texture", async () => {
  const [homepage, componentStyles, undetectableSource, content] =
    await Promise.all([
      readFile("dist/index.html", "utf8"),
      readFile("src/styles/components.scss", "utf8"),
      readFile("src/layouts/partials/undetectable.astro", "utf8"),
      readFile("src/content/sections/undetectable.md", "utf8"),
    ]);

  assert.doesNotMatch(
    homepage,
    /indexbg-gradient\.webp|bg-gradient\.webp|bgmedium\.webp|bgsmall\.webp/,
  );
  assert.doesNotMatch(componentStyles, /indexbg-gradient\.webp/);
  assert.doesNotMatch(
    undetectableSource,
    /background-image:\s*url\('\$\{demoBackground\}'\)/,
  );
  assert.match(undetectableSource, /radial-gradient\(/);
  assert.doesNotMatch(
    content,
    /bg-gradient\.webp|bgmedium\.webp|bgsmall\.webp/,
  );
  assert.ok((content.match(/bglarge\.webp/g) || []).length >= 3);
});

test("large below-the-fold homepage images reserve dimensions", async () => {
  const homepage = await readFile("dist/index.html", "utf8");

  for (const [name, width, height] of [
    ["testimonial1.webp", "754", "1913"],
    ["testimonial2.webp", "754", "1915"],
    ["testimonial3.webp", "766", "1914"],
    ["command.webp", "474", "470"],
    ["enter.webp", "474", "470"],
  ]) {
    const image = homepage.match(
      new RegExp(`<img[^>]+${name.replace(".", "\\.")}[^>]*>`),
    )?.[0];
    assert.ok(image, `${name} should render`);
    assert.match(image, new RegExp(`width="${width}"`));
    assert.match(image, new RegExp(`height="${height}"`));
    assert.match(image, /loading="lazy"/);
    assert.match(image, /decoding="async"/);
  }
});

test("undetectable demo cards expose the expanded and compact interaction", async () => {
  const homepage = await readFile("dist/index.html", "utf8");
  const assetNames = await readdir("dist/_astro");
  const [scripts, stylesheets] = await Promise.all([
    Promise.all(
      assetNames
        .filter((name) => name.endsWith(".js"))
        .map((name) => readFile(`dist/_astro/${name}`, "utf8")),
    ),
    Promise.all(
      assetNames
        .filter((name) => name.endsWith(".css"))
        .map((name) => readFile(`dist/_astro/${name}`, "utf8")),
    ),
  ]);

  const demoCards =
    homepage.match(/<article[^>]*data-undetectable-card[\s\S]*?<\/article>/g) ||
    [];
  assert.equal(
    demoCards.length,
    5,
    "the homepage should render five interactive demo cards",
  );
  for (const card of demoCards) {
    assert.equal(
      card.match(/<h3(?:\s|>)/g)?.length,
      1,
      "each demo card should expose exactly one h3 title",
    );
    assert.doesNotMatch(
      card,
      /<button/,
      "an interactive demo card must not contain a nested button",
    );
    assert.match(
      card,
      /class="undetectable-demo-expanded-foreground"/,
      "each expanded card should size its foreground against the visible bglarge.webp area",
    );
  }
  assert.equal(
    homepage.match(
      /<article[^>]*data-undetectable-card[^>]*aria-expanded="false"/g,
    )?.length,
    5,
    "each demo card should expose its initial collapsed state",
  );

  for (const asset of [
    "bglarge.webp",
    "screen-share.svg",
    "dock-white.svg",
    "list-x.svg",
    "arrow-left-right.svg",
    "mouse-pointer.svg",
  ]) {
    assert.match(homepage, new RegExp(`/images/undetectable/${asset}`));
  }

  for (const imageClass of [
    "undetectable-demo-media-bg",
    "undetectable-demo-expanded-bg",
    "undetectable-demo-compact-bg",
  ]) {
    assert.equal(
      homepage.match(new RegExp(`class="${imageClass}"`, "g"))?.length,
      5,
      `every ${imageClass} image should render from bglarge.webp`,
    );
  }

  assert.equal(
    homepage.match(/<video[^>]*data-undetectable-demo-video/g)?.length,
    4,
    "cards two through five should render an expanded demo video",
  );
  assert.equal(
    homepage.match(/class="compare-slider /g)?.length,
    2,
    "the first expanded card should reuse the page comparison slider",
  );
  assert.match(
    demoCards[0],
    /class="compare-slider [^>]*data-hint-cycles="3"/,
    "the second comparison slider should render inside the first demo card",
  );
  for (const video of [
    "dock.webm",
    "activity.webm",
    "tab.webm",
    "cursor.webm",
  ]) {
    assert.match(
      homepage,
      new RegExp(
        `<source data-src="[^"]*/images/undetectable/${video}(?:\\?v=[a-f0-9]{12})?" type="video/webm"`,
      ),
    );
  }
  assert.match(
    homepage,
    /<video[^>]*muted[^>]*loop[^>]*playsinline[^>]*data-undetectable-demo-video/g,
  );

  const browserCode = [homepage, ...scripts].join("\n");
  const undetectableSource = await readFile(
    "src/layouts/partials/undetectable.astro",
    "utf8",
  );
  assert.match(browserCode, /aria-expanded/);
  assert.match(browserCode, /min-width:\s*1024px/);
  assert.match(stylesheets.join("\n"), /max-width:1023px/);
  assert.match(
    undetectableSource,
    /@media \(max-width: 1023px\) \{[\s\S]*?\.undetectable-demo-expand\s*\{\s*display:\s*none;/,
  );
  assert.match(browserCode, /is-closing/);
  assert.doesNotMatch(homepage, /undetectable-demo-expand mt-3\.5/);
  assert.match(
    stylesheets.join("\n"),
    /undetectable-demo-expand[^}]*align-self:center/,
  );
  assert.doesNotMatch(undetectableSource, /closing-active/);
  assert.doesNotMatch(undetectableSource, /closing-compact/);
  assert.doesNotMatch(
    undetectableSource,
    /--undetectable-closing-content-width/,
  );
  assert.match(browserCode, /getBoundingClientRect\(\)\.height/);
  assert.match(
    stylesheets.join("\n"),
    /data-state=active[^}]*flex-basis:0;flex-grow:9/,
  );
  assert.match(
    stylesheets.join("\n"),
    /data-state=compact[^}]*flex-basis:0;flex-grow:1/,
  );
  assert.match(
    stylesheets.join("\n"),
    /undetectable-demo-expanded[^}]*grid-template-columns:281px minmax\(0,500px\)/,
  );
  const resetCardsSource = undetectableSource.match(
    /const resetCards = \(\) => \{[\s\S]*?\n\s*\};\n\n\s*const syncMode/,
  )?.[0];
  assert.ok(
    resetCardsSource,
    "the resetCards implementation should be present",
  );
  assert.match(resetCardsSource, /card\.dataset\.state = "default"/);
  assert.match(resetCardsSource, /--undetectable-copy-width/);
  assert.match(resetCardsSource, /getComputedStyle\(grid\)/);
  assert.match(
    resetCardsSource,
    /getPropertyValue\("--undetectable-demo-gap"\)/,
  );
  assert.doesNotMatch(resetCardsSource, /gridStyles\.columnGap/);
  assert.match(resetCardsSource, /borderLeftWidth/);
  assert.match(resetCardsSource, /borderRightWidth/);
  assert.match(
    undetectableSource,
    /const handleLayoutChange = \(\) => \{[\s\S]*?if \(!expandableLayout\.matches\) resetCards\(\);[\s\S]*?syncMode\(\);[\s\S]*?\};/,
  );
  assert.match(
    undetectableSource,
    /expandableLayout\.addEventListener\("change", handleLayoutChange\)/,
  );
  assert.match(
    stylesheets.join("\n"),
    /undetectable-demo-copy[^}]*width:var\(--undetectable-copy-width,\s*90%\)/,
  );
  assert.match(
    stylesheets.join("\n"),
    /undetectable-demo-card[^\s,{]*:hover[^}]*undetectable-demo-card-header[^}]*color:#71717a/,
  );
  assert.match(
    stylesheets.join("\n"),
    /undetectable-demo-card[^\s,{]*:hover[^}]*undetectable-demo-compact-number[^}]*color:#71717a/,
  );
  assert.match(
    stylesheets.join("\n"),
    /is-closing[^}]*undetectable-demo-card[^}]*cubic-bezier\(\.16,1\.14,\.28,1\)/,
  );
  assert.match(
    stylesheets.join("\n"),
    /undetectable-demo-compact-number[^}]*align-self:center/,
  );
  assert.match(
    stylesheets.join("\n"),
    /undetectable-demo-compact-media[^}]*width:100%;max-width:75px;[^}]*aspect-ratio:1/,
  );
  assert.doesNotMatch(
    stylesheets.join("\n"),
    /data-state=active[^}]*height:500px/,
  );
  assert.match(
    stylesheets.join("\n"),
    /undetectable-demo-expanded-media[^}]*max-height:100%[^}]*aspect-ratio:25\s*\/\s*23/,
    "the existing bglarge.webp frame size should remain unchanged",
  );
  assert.match(
    stylesheets.join("\n"),
    /undetectable-demo-media-bg[^}]*undetectable-demo-expanded-bg[^}]*undetectable-demo-compact-bg[^}]*box-sizing:border-box[^}]*border:1px solid (?:#ffffff1a|#fff1a|rgba\(255,255,255,\.1\)|rgb\(255 255 255\s*\/\s*10%\))[^}]*border-radius:15px/,
    "the bglarge.webp images themselves should draw the 15px radius and 10% white border",
  );
  assert.match(
    stylesheets.join("\n"),
    /undetectable-demo-expanded-bg[^}]*object-fit:cover/,
  );
  assert.match(
    stylesheets.join("\n"),
    /undetectable-demo-expanded-foreground[^}]*height:100%;[^}]*max-width:100%;[^}]*aspect-ratio:1004\s*\/\s*924/,
    "the foreground reference frame should match bglarge.webp's visible aspect ratio without resizing it",
  );
  assert.match(
    stylesheets.join("\n"),
    /undetectable-demo-expanded-compare[^}]*width:90%[^}]*border-radius:10px/,
  );
  assert.match(
    stylesheets.join("\n"),
    /undetectable-demo-expanded-compare[^,{]*,[^}]*undetectable-demo-expanded-video[^}]*position:absolute;[^}]*top:50%;[^}]*left:50%;[^}]*transform:translate\(-50%,-50%\)/,
    "the expanded foreground content should share one explicit center point",
  );
  assert.match(
    stylesheets.join("\n"),
    /undetectable-demo-expanded-video[^}]*width:90%;[^}]*height:auto;[^}]*border-radius:10px/,
    "expanded videos should derive their width from the background and preserve their aspect ratio",
  );
  assert.doesNotMatch(
    stylesheets.join("\n"),
    /undetectable-demo-expanded-video[^}]*max-(?:width|height):/,
    "the expanded video width must not be overridden by a second size constraint",
  );
  assert.equal(
    homepage.match(
      /<video[^>]*preload="none"[^>]*data-undetectable-demo-video/g,
    )?.length,
    4,
    "expanded videos should load only after their card is opened",
  );
  assert.match(browserCode, /\.play\(\)/);
  assert.match(browserCode, /\.pause\(\)/);
  assert.match(undetectableSource, /compareSliderControllers/);
  assert.match(undetectableSource, /restartHint/);
  assert.match(undetectableSource, /resetHint/);
});
