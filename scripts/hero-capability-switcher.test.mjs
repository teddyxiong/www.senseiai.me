import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";
import {
  capabilityIndexFromScroll,
  minimumRunwayTravel,
  runwayGeometryFromMeasurements,
  scrollTopForCapability,
  switchMountedCapability,
} from "../src/lib/hero/capabilitySwitcher.mjs";
import * as capabilitySwitcher from "../src/lib/hero/capabilitySwitcher.mjs";

class FakeClassList {
  values = new Set();

  add(name) {
    this.values.add(name);
  }

  remove(name) {
    this.values.delete(name);
  }

  toggle(name, force) {
    if (force) this.add(name);
    else this.remove(name);
  }

  contains(name) {
    return this.values.has(name);
  }
}

class FakeElement extends EventTarget {
  constructor() {
    super();
    this.classList = new FakeClassList();
    this.attributes = new Map();
    this.children = [];
    this.parentElement = null;
    this.hidden = false;
    this.tabIndex = -1;
  }

  append(child) {
    child.remove();
    this.children.push(child);
    child.parentElement = this;
  }

  remove() {
    if (!this.parentElement) return;
    this.parentElement.children = this.parentElement.children.filter(
      (child) => child !== this,
    );
    this.parentElement = null;
  }

  setAttribute(name, value) {
    this.attributes.set(name, value);
  }

  focus() {}

  get isConnected() {
    return this.parentElement !== null;
  }
}

test("rapid capability switches keep exactly one animation mounted", () => {
  const tabs = [new FakeElement(), new FakeElement()];
  const panels = [new FakeElement(), new FakeElement()];
  const animations = [new FakeElement(), new FakeElement()];
  panels.forEach((panel, index) => panel.append(animations[index]));

  let activeIndex = -1;
  for (let index = 0; index < 20; index += 1) {
    activeIndex = switchMountedCapability({
      tabs,
      panels,
      animations,
      activeIndex,
      nextIndex: index % 2,
    });

    assert.equal(
      animations.filter((animation) => animation.isConnected).length,
      1,
    );
    assert.equal(animations[activeIndex].parentElement, panels[activeIndex]);
    assert.equal(panels.filter((panel) => !panel.hidden).length, 1);
  }
});

test("scrolling across the runway midpoint selects the second capability", () => {
  const geometry = {
    runwayTop: 1_000,
    runwayHeight: 1_600,
    stickyHeight: 600,
    capabilityCount: 2,
  };

  assert.equal(capabilityIndexFromScroll(999, geometry), 0);
  assert.equal(capabilityIndexFromScroll(1_499, geometry), 0);
  assert.equal(capabilityIndexFromScroll(1_500, geometry), 1);
  assert.equal(capabilityIndexFromScroll(2_500, geometry), 1);
});

test("clicking a capability lands inside a stable scroll segment", () => {
  const geometry = {
    runwayTop: 1_000,
    runwayHeight: 1_600,
    stickyHeight: 600,
    capabilityCount: 2,
  };

  assert.equal(scrollTopForCapability(0, geometry), 1_250);
  assert.equal(scrollTopForCapability(1, geometry), 1_750);

  for (const jitter of [-2, 0, 2]) {
    assert.equal(
      capabilityIndexFromScroll(
        scrollTopForCapability(1, geometry) + jitter,
        geometry,
      ),
      1,
    );
  }
});

test("degenerate runway geometry stays on the first capability", () => {
  const geometry = {
    runwayTop: 1_000,
    runwayHeight: 600,
    stickyHeight: 600,
    capabilityCount: 2,
  };

  assert.equal(capabilityIndexFromScroll(5_000, geometry), 0);
  assert.equal(scrollTopForCapability(1, geometry), 1_000);
});

test("sticky top offset keeps the final capability below the fixed header", () => {
  const geometry = runwayGeometryFromMeasurements({
    runwayDocumentTop: 1_000,
    runwayHeight: 1_600,
    stickyHeight: 600,
    stickyTop: 72,
    capabilityCount: 2,
  });

  assert.equal(scrollTopForCapability(1, geometry), 1_678);
});

test("sticky positioning centers the animation without crossing the header", () => {
  assert.equal(
    capabilitySwitcher.stickyTopForViewport?.({
      viewportHeight: 1_000,
      stickyHeight: 600,
      reservedTop: 65,
      minimumTop: 65,
    }),
    232.5,
  );
  assert.equal(
    capabilitySwitcher.stickyTopForViewport?.({
      viewportHeight: 700,
      stickyHeight: 600,
      reservedTop: 65,
      minimumTop: 65,
    }),
    82.5,
  );
  assert.equal(
    capabilitySwitcher.stickyTopForViewport?.({
      viewportHeight: 600,
      stickyHeight: 600,
      reservedTop: 65,
      minimumTop: 65,
    }),
    65,
  );
});

test("logo clearance expands only when the surrounding layout needs it", () => {
  assert.equal(
    capabilitySwitcher.runwayTravelForLogoVisibility?.({
      viewportHeight: 769,
      stickyTop: 247,
      stickyHeight: 275,
      trailingGap: 31,
      minimumTravel: 280,
    }),
    592,
  );
  assert.equal(
    capabilitySwitcher.runwayTravelForLogoVisibility?.({
      viewportHeight: 1_077,
      stickyTop: 323.5,
      stickyHeight: 430,
      trailingGap: 346,
      minimumTravel: 280,
    }),
    280,
  );
  assert.equal(
    capabilitySwitcher.runwayTravelForLogoVisibility?.({
      viewportHeight: 1_200,
      stickyTop: 100,
      stickyHeight: 300,
      trailingGap: 0,
      minimumTravel: 480,
    }),
    640,
  );
});

test("capability switching requires a longer scroll runway", () => {
  assert.equal(minimumRunwayTravel(700), 480);
  assert.equal(minimumRunwayTravel(1_000), 500);
  assert.equal(minimumRunwayTravel(1_600), 640);
});

test("mobile uses a shorter bounded scroll runway", () => {
  assert.equal(minimumRunwayTravel(700, 440), 360);
  assert.equal(minimumRunwayTravel(1_000, 440), 420);
  assert.equal(minimumRunwayTravel(1_200, 440), 440);
});

test("mobile keeps the capability runway sticky and scroll-driven", async () => {
  const source = await readFile(
    "src/layouts/partials/HeroCapabilitySwitcher.astro",
    "utf8",
  );

  assert.match(
    source,
    /\.hero-capability-sticky\s*\{[^}]*position:\s*sticky[^}]*top:\s*var\(--hero-capability-sticky-top/s,
  );
  assert.match(source, /\.hero-capability-runway\s*\{[^}]*height:\s*calc\(/s);
  assert.doesNotMatch(
    source,
    /if \(!desktop\.matches \|\| reduceMotion\) return/,
  );
  assert.doesNotMatch(source, /desktop\.matches && !reduceMotion/);
});

test("desktop capability tabs sit higher beside the animation", async () => {
  const source = await readFile(
    "src/layouts/partials/HeroCapabilitySwitcher.astro",
    "utf8",
  );

  const tabsRule =
    source.match(/\.hero-capability-tabs\s*\{([^}]*)\}/s)?.[1] || "";
  assert.match(tabsRule, /align-self:\s*start/);
  assert.match(tabsRule, /margin-block-start:\s*clamp\(40px,\s*4vw,\s*56px\)/);
  assert.doesNotMatch(tabsRule, /transform:/);
});

test("capability tabs include the matching descriptive copy", async () => {
  const source = await readFile(
    "src/layouts/partials/HeroCapabilitySwitcher.astro",
    "utf8",
  );

  const liveTab =
    source.match(/id="hero-capability-tab-live"[\s\S]*?<\/button>/)?.[0] || "";
  const dualDeviceTab =
    source.match(
      /id="hero-capability-tab-dual-device"[\s\S]*?<\/button>/,
    )?.[0] || "";
  const normalizedLiveTab = liveTab.replace(/\s+/g, " ");
  const normalizedDualDeviceTab = dualDeviceTab.replace(/\s+/g, " ");

  assert.match(liveTab, /hero-capability-tab-title[^>]*>\s*Live Interview/);
  assert.ok(
    normalizedLiveTab.includes(
      "Get AI answers through an invisible overlay for any meeting platform or browser-based test.",
    ),
  );
  assert.match(dualDeviceTab, /hero-capability-tab-title[^>]*>\s*Dual-device/);
  assert.ok(
    normalizedDualDeviceTab.includes(
      "Get AI answers on your phone to avoid detection by desktop monitoring software.",
    ),
  );
});

test("capability descriptions stack below their titles and wrap responsively", async () => {
  const source = await readFile(
    "src/layouts/partials/HeroCapabilitySwitcher.astro",
    "utf8",
  );

  assert.match(
    source,
    /grid-template-columns:\s*clamp\(260px,\s*22vw,\s*320px\) minmax\(0,\s*1fr\)/,
  );
  assert.match(
    source,
    /\.hero-capability-tab\s*\{[^}]*display:\s*flex[^}]*flex-direction:\s*column/s,
  );
  assert.match(
    source,
    /\.hero-capability-tab-description\s*\{[^}]*font-size:\s*16px[^}]*font-weight:\s*400/s,
  );
  assert.match(
    source,
    /@media \(max-width:\s*1023px\)[\s\S]*?\.hero-capability-tab\s*\{[^}]*flex:\s*1 1 0/,
  );
});

test("medium-width screens give the animation the full row", async () => {
  const source = await readFile(
    "src/layouts/partials/HeroCapabilitySwitcher.astro",
    "utf8",
  );

  assert.match(source, /@media \(max-width:\s*1023px\)/);
  assert.match(
    source,
    /@media \(max-width:\s*1023px\)[\s\S]*?\.hero-capability-layout\s*\{[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\)/,
  );
  assert.match(
    source,
    /@media \(max-width:\s*1023px\)[\s\S]*?\.hero-capability-tabs\s*\{[^}]*flex-direction:\s*row/,
  );
  assert.match(
    source,
    /@media \(max-width:\s*1023px\)[\s\S]*?\.hero-capability-tab-description\s*\{[^}]*font-size:\s*14px/,
  );
  assert.match(source, /matchMedia\("\(min-width: 1024px\)"\)/);
});

test("mobile runway skips desktop-only logo clearance expansion", async () => {
  const source = await readFile(
    "src/layouts/partials/HeroCapabilitySwitcher.astro",
    "utf8",
  );

  assert.match(source, /if \(logoMarquee && window\.innerWidth >= 768\)/);
});

test("click navigation updates the scroll stop atomically", async () => {
  const source = await readFile(
    "src/layouts/partials/HeroCapabilitySwitcher.astro",
    "utf8",
  );

  assert.match(source, /behavior:\s*"auto"/);
  assert.doesNotMatch(source, /behavior:\s*"smooth"/);
});

test("the switcher only preloads assets explicitly managed by it", async () => {
  const [switcher, dualDevice] = await Promise.all([
    readFile("src/layouts/partials/HeroCapabilitySwitcher.astro", "utf8"),
    readFile("src/layouts/partials/DualDeviceAnimation.astro", "utf8"),
  ]);

  assert.match(switcher, /animation\.matches\("\[data-switcher-managed\]"\)/);
  assert.match(dualDevice, /data-switcher-managed/);
});

test("tab keyboard controls cover horizontal and vertical orientations", async () => {
  const source = await readFile(
    "src/layouts/partials/HeroCapabilitySwitcher.astro",
    "utf8",
  );

  assert.match(source, /aria-orientation="horizontal"/);
  assert.match(source, /"ArrowRight"/);
  assert.match(source, /"ArrowLeft"/);
  assert.match(source, /setAttribute\(\s*"aria-orientation"/);
});

test("the sticky stage is centered, borderless, and leaves a moderate logo gap", async () => {
  const source = await readFile(
    "src/layouts/partials/HeroCapabilitySwitcher.astro",
    "utf8",
  );

  assert.match(source, /--hero-capability-sticky-top/);
  assert.match(source, /--hero-capability-sticky-height/);
  assert.match(source, /--hero-capability-runway-travel/);
  assert.match(source, /\[data-company-logo-marquee\]/);
  assert.doesNotMatch(source, /calc\(100svh - var/);
  assert.doesNotMatch(source, /padding-bottom:\s*clamp/);
  assert.doesNotMatch(source, /height:\s*calc\(100svh \+ 520px\)/);
  assert.doesNotMatch(source, /min-height:\s*1080px/);
  assert.doesNotMatch(source, /border:\s*2px solid/);
  assert.doesNotMatch(source, /border-radius:/);
});

test("dual-device uses the new highlight layer and flashes it exactly twice", async () => {
  const source = await readFile(
    "src/layouts/partials/DualDeviceAnimation.astro",
    "utf8",
  );

  assert.match(source, /\/images\/dual-device\/highlight\.webp/);
  assert.match(
    source,
    /class="dual-device-layer dual-device-highlight-one"[\s\S]*?width="1861"[\s\S]*?height="1124"/,
  );
  assert.match(
    source,
    /\.dual-device-layer\s*\{[^}]*inset:\s*0[^}]*object-fit:\s*contain/s,
  );
  assert.match(
    source,
    /\.dual-device-highlight-one\s*\{[^}]*top:\s*-0\.36%[^}]*bottom:\s*auto/s,
  );
  assert.doesNotMatch(source, /highlight1\.webp|highlight2\.webp/);
  assert.doesNotMatch(source, /dual-device-highlight-two/);
  assert.doesNotMatch(source, /dual-highlight-two/);
  assert.match(source, /8\.82%,\s*14\.71%/);
  assert.match(source, /14\.72%,\s*20\.59%/);
  assert.match(source, /20\.61%,\s*26\.47%/);
});

test("dual-device removes the question interval from the loop", async () => {
  const source = await readFile(
    "src/layouts/partials/DualDeviceAnimation.astro",
    "utf8",
  );

  assert.match(source, /dual-highlight-one 5\.44s/);
  assert.match(source, /dual-answer 5\.44s/);
  assert.doesNotMatch(source, /dual-question/);
  assert.doesNotMatch(source, /7\.48s|9\.04s|10s/);
  assert.match(source, /44\.85%[^}]*scale\(0\.92\)/s);
  assert.match(source, /55\.15%[^}]*scale\(1\.08\)/s);
  assert.match(source, /59\.56%,\s*96\.32%[^}]*scale\(1\)/s);
  assert.doesNotMatch(source, /translate[XY]?\(/);
  assert.doesNotMatch(source, /filter:\s*(?:drop-shadow|brightness)/);
});

test("dual-device answer pops from the frame exported by Figma", async () => {
  const source = await readFile(
    "src/layouts/partials/DualDeviceAnimation.astro",
    "utf8",
  );

  assert.doesNotMatch(source, /question\.webp|dual-device-question/);
  assert.match(
    source,
    /class="dual-device-pop-layer dual-device-answer"[\s\S]*?class="dual-device-layer dual-device-answer-image"[\s\S]*?width="420"[\s\S]*?height="815"/,
  );
  assert.match(
    source,
    /\.dual-device-pop-layer\s*\{[^}]*position:\s*absolute[^}]*transform-origin:\s*center/s,
  );
  assert.match(
    source,
    /\.dual-device-pop-layer \.dual-device-layer\s*\{[^}]*max-width:\s*none/s,
  );
  assert.match(
    source,
    /\.dual-device-answer\s*\{[^}]*left:\s*74\.59%[^}]*top:\s*11\.74%[^}]*width:\s*22\.57%[^}]*height:\s*72\.51%/s,
  );
  assert.doesNotMatch(source, /\.dual-device-answer-image\s*\{/);
});

test("idle fallback uses a non-narrowed timer global", async () => {
  const source = await readFile(
    "src/layouts/partials/LiveInterviewAnimation.astro",
    "utf8",
  );

  assert.match(source, /globalThis\.setTimeout\(run, 250\)/);
  assert.doesNotMatch(source, /window\.setTimeout\(run, 250\)/);
});

test("live interview resumes its preloaded video after being remounted", async () => {
  const source = await readFile(
    "src/layouts/partials/LiveInterviewAnimation.astro",
    "utf8",
  );

  assert.match(
    source,
    /isVisible = entry\.isIntersecting;\s*if \(isVisible && isSelected\) \{\s*scheduleVideoLoad\(\);\s*playVideo\(\);/s,
  );
});

test("live interview overlay relies on the WebP alpha channel", async () => {
  const source = await readFile(
    "src/layouts/partials/LiveInterviewAnimation.astro",
    "utf8",
  );

  assert.doesNotMatch(source, /\.live-interview-overlay\s*\{[^}]*opacity:/s);
  assert.doesNotMatch(source, /is-dynamic-ready\s+\.live-interview-overlay/);
});

test("live interview uses the clean background without a duplicate preview or blur layer", async () => {
  const source = await readFile(
    "src/layouts/partials/LiveInterviewAnimation.astro",
    "utf8",
  );

  assert.match(source, /src="\/images\/liveinterview\/background\.webp"/);
  assert.doesNotMatch(source, /static-preview\.webp/);
  assert.doesNotMatch(source, /live-interview-backdrop-blur/);
});

test("capability layers wait for decoded assets and inactive animations cannot reveal layers", async () => {
  const [switcher, liveInterview, dualDevice] = await Promise.all([
    readFile("src/layouts/partials/HeroCapabilitySwitcher.astro", "utf8"),
    readFile("src/layouts/partials/LiveInterviewAnimation.astro", "utf8"),
    readFile("src/layouts/partials/DualDeviceAnimation.astro", "utf8"),
  ]);

  assert.match(switcher, /await Promise\.all/);
  assert.match(switcher, /classList\.add\("is-assets-ready"\)/);
  assert.match(
    switcher,
    /\.hero-capability-panel:not\(\.is-active\)\s+:global\(\[data-capability-animation\]\)[^{]*\{[^}]*visibility:\s*hidden/s,
  );
  assert.match(liveInterview, /if \(!isSelected\) \{\s*clearBubbles\(\);/s);
  assert.match(liveInterview, /classList\.add\("is-assets-ready"\)/);
  assert.match(dualDevice, /\.is-active\.is-assets-ready/);
});

test("live interview assets and component use their product name", async () => {
  await assert.rejects(access("src/layouts/partials/heroanimation.astro"));
  await assert.rejects(access("public/images/heroanimation"));
});
