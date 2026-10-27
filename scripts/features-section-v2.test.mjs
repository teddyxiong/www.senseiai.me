import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const expectedCopy = [
  "100% Invisible and Undetctable",
  "Works on Any Platform",
  "Answers That Sound Like You",
  "Multilingual Support",
  "Interview in any language. Get accurate, natural answers across multiple languages.",
  "Real-Time Answers You Can Rely On",
  "One AI Assistant for Every Interview",
];

test("homepage feature content matches the approved Figma copy", async () => {
  const content = await readFile(
    "src/content/sections/featuresectionv2.md",
    "utf8",
  );

  assert.match(content, /title_line_1: "Unlock Your"/);
  assert.match(content, /title_line_2: "Stealth AI Interview Copilot"/);
  for (const copy of expectedCopy) assert.ok(content.includes(copy), copy);
});

test("homepage feature cards use the approved three-plus-two composition", async () => {
  const component = await readFile(
    "src/layouts/partials/FeaturesSectionV2.astro",
    "utf8",
  );

  assert.match(component, /data-feature-row="three-up"/);
  assert.match(component, /data-feature-row="two-up"/);
  assert.match(component, /data-feature-card="platform"/);
  assert.match(component, /data-feature-card="personalized"/);
  assert.match(component, /data-feature-card="multilingual"/);
  assert.match(component, /data-feature-card="realtime"/);
  assert.match(component, /data-feature-card="interview-types"/);
});

test("approved existing animations remain attached to their new cards", async () => {
  const [content, component] = await Promise.all([
    readFile("src/content/sections/featuresectionv2.md", "utf8"),
    readFile("src/layouts/partials/FeaturesSectionV2.astro", "utf8"),
  ]);

  for (const label of [
    "Based on Your Resume",
    "Tailored to Your Role",
    "Relevant Examples",
    "Natural Wording",
  ]) {
    assert.ok(content.includes(label), label);
  }

  assert.match(component, /rotating-container/);
  assert.match(component, /personalized-pill/);
  assert.match(component, /data-realtime-interviewer-audio/);
});

test("design assets live directly in images/features", async () => {
  const [config, content, component] = await Promise.all([
    readFile("astro.config.mjs", "utf8"),
    readFile("src/content/sections/featuresectionv2.md", "utf8"),
    readFile("src/layouts/partials/FeaturesSectionV2.astro", "utf8"),
  ]);

  assert.doesNotMatch(config, /features\/figma/);
  assert.doesNotMatch(content, /images\/features\/figma/);
  assert.doesNotMatch(component, /images\/features\/figma/);
  assert.doesNotMatch(config, /r2-asset-rewrite/);
});

test("section heading uses the approved layout without changing its color treatment", async () => {
  const [component, styles] = await Promise.all([
    readFile("src/layouts/partials/FeaturesSectionV2.astro", "utf8"),
    readFile("src/styles/features-section.css", "utf8"),
  ]);

  assert.match(component, /<h2\s+class="mb-6 mx-auto text-center"/);
  assert.match(
    component,
    /style="max-width: 750px; font-family: Asul, serif; font-weight: 700; line-height: 1\.2;"/,
  );
  assert.match(component, /<span class="text-\[#5b9cf2\]">/);
  assert.doesNotMatch(styles, /\.features-v2-section\s*>\s*div\s*>\s*h2/);
});

test("rich platform copy is rendered as HTML instead of escaped text", async () => {
  const component = await readFile(
    "src/layouts/partials/FeaturesSectionV2.astro",
    "utf8",
  );

  assert.match(component, /import \{ markdownify \}/);
  assert.match(
    component,
    /set:html=\{markdownify\(data\.cards\.platform\.description\)\}/,
  );
});

test("multilingual support renders three alternating marquee rows", async () => {
  const [content, component, styles] = await Promise.all([
    readFile("src/content/sections/featuresectionv2.md", "utf8"),
    readFile("src/layouts/partials/FeaturesSectionV2.astro", "utf8"),
    readFile("src/styles/features-section.css", "utf8"),
  ]);

  for (const language of [
    "Xin chào",
    "Kumusta",
    "Helo",
    "สวัสดี",
    "Привіт",
    "Halo",
  ]) {
    assert.ok(content.includes(`- "${language}"`), language);
  }

  assert.match(component, /const languageRows =/);
  assert.match(component, /languages\.slice\(0, 7\)/);
  assert.match(component, /languages\.slice\(7, 13\)/);
  assert.match(component, /languages\.slice\(13\)/);
  assert.match(component, /language-marquee-row/);
  assert.match(component, /language-marquee-track/);
  assert.match(styles, /@keyframes features-v2-language-left/);
  assert.match(styles, /@keyframes features-v2-language-right/);
  assert.match(styles, /\.language-marquee-track \{[\s\S]*width: max-content/);
  assert.match(styles, /\.language-marquee-group \{[\s\S]*flex: none/);
  assert.doesNotMatch(styles, /\.language-marquee-track \{[\s\S]*?width: 200%/);
  assert.match(
    styles,
    /\.language-marquee-row:nth-child\(2\)[\s\S]*features-v2-language-right/,
  );
});

test("realtime flow uses fifteen bars and four sequential animated arrows", async () => {
  const [content, component, styles] = await Promise.all([
    readFile("src/content/sections/featuresectionv2.md", "utf8"),
    readFile("src/layouts/partials/FeaturesSectionV2.astro", "utf8"),
    readFile("src/styles/features-section.css", "utf8"),
  ]);

  assert.match(content, /bar_count: 15/);
  assert.match(component, /flow-line-progress-source/);
  assert.match(component, /flow-line-progress-top/);
  assert.match(component, /flow-line-progress-middle/);
  assert.match(component, /flow-line-progress-bottom/);
  for (const asset of ["3315", "3227", "3313", "3311"]) {
    assert.ok(!component.includes(`icon_3730_${asset}.svg`), asset);
  }
  assert.match(styles, /@keyframes features-v2-flow-source/);
  assert.match(styles, /@keyframes features-v2-flow-top/);
  assert.match(styles, /@keyframes features-v2-flow-middle/);
  assert.match(styles, /@keyframes features-v2-flow-bottom/);
});

test("interview types use the approved composition and staggered blue cycle", async () => {
  const [component, styles] = await Promise.all([
    readFile("src/layouts/partials/FeaturesSectionV2.astro", "utf8"),
    readFile("src/styles/features-section.css", "utf8"),
  ]);

  assert.match(component, /--interview-index: \$\{index\}/);
  assert.match(styles, /animation: features-v2-interview-type-cycle/);
  assert.match(
    styles,
    /animation-delay: calc\(var\(--interview-index\) \* 2\.8s\)/,
  );
  assert.match(component, /class="interview-type-icon"/);
  assert.match(styles, /mask-image: var\(--interview-icon\)/);
  assert.match(styles, /background-color: #eef6ff/);
  assert.match(styles, /#6dabff/i);
});

test("narrow layouts reflow instead of shrinking fixed canvases", async () => {
  const styles = await readFile("src/styles/features-section.css", "utf8");

  assert.doesNotMatch(styles, /transform:\s*scale\(0\.52\)/);
  assert.doesNotMatch(styles, /margin:[^;]*-9[46]px/);
  assert.match(
    styles,
    /@media \(max-width: 479px\)[\s\S]*\.interview-types-visual \{[\s\S]*grid-template-columns: 1fr/,
  );
  assert.match(
    styles,
    /@media \(max-width: 479px\)[\s\S]*\.personalized-visual \{[\s\S]*grid-template-columns: 1fr/,
  );
});

test("the five lower feature cards use a gradient and inner shadow", async () => {
  const styles = await readFile("src/styles/features-section.css", "utf8");

  assert.match(
    styles,
    /\.feature-card \{[\s\S]*background:\s*linear-gradient\(180deg, #f8fbff 0%, #eff6ff 100%\)/,
  );
  assert.match(styles, /\.feature-card \{[\s\S]*box-shadow:\s*inset /);
});

test("the shared feature stylesheet keeps interview-copilot legacy hooks", async () => {
  const [styles, types] = await Promise.all([
    readFile("src/styles/features-section.css", "utf8"),
    readFile("src/content/config.ts", "utf8"),
  ]);

  for (const selector of [
    ".feature-card-base",
    ".feature-card-title",
    ".feature-card-desc",
    ".ai-bubble",
    ".interview-badge",
    ".interview-badge-wave-bar",
  ]) {
    assert.ok(styles.includes(selector), selector);
  }

  assert.match(types, /resume_image\?: string/);
  assert.match(types, /badges: \{/);
});
