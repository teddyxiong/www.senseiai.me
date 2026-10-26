import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("home video dialog opens the YouTube embed and closes from the backdrop", async () => {
  let videoDialogModule;
  try {
    const source = await readFile("public/js/video-dialog.js", "utf8");
    videoDialogModule = await import(
      `data:text/javascript;base64,${Buffer.from(source).toString("base64")}`
    );
  } catch {
    // The first TDD run intentionally reaches this branch before the dialog exists.
  }
  assert.equal(typeof videoDialogModule?.openVideoDialog, "function");

  const listeners = new Map();
  const closeButton = {
    addEventListener(type, handler) {
      listeners.set(`close:${type}`, handler);
    },
  };
  const overlay = {
    className: "",
    innerHTML: "",
    removed: false,
    querySelector() {
      return closeButton;
    },
    addEventListener(type, handler) {
      listeners.set(`overlay:${type}`, handler);
    },
    remove() {
      this.removed = true;
    },
  };

  const originalDocument = globalThis.document;
  globalThis.document = {
    createElement() {
      return overlay;
    },
    body: {
      appendChild(node) {
        assert.equal(node, overlay);
      },
    },
  };

  try {
    videoDialogModule.openVideoDialog(
      "https://www.youtube.com/watch?v=tEF3DXagKgQ",
    );
  } finally {
    globalThis.document = originalDocument;
  }

  assert.equal(overlay.className, "home-video-overlay show video-overlay");
  assert.match(
    overlay.innerHTML,
    /https:\/\/www\.youtube\.com\/embed\/tEF3DXagKgQ\?autoplay=1/,
  );
  assert.equal(typeof listeners.get("close:click"), "function");
  assert.equal(typeof listeners.get("overlay:click"), "function");

  listeners.get("overlay:click")({ target: overlay });
  assert.equal(overlay.removed, true);
});

test("the local close icon path survives the production asset rewrite", async () => {
  const source = await readFile("public/js/video-dialog.js", "utf8");
  const productionSource = source.replace(
    /(["'`])\/(?:[a-z]{2}(?:-[a-z]+)?\/)?(images|fonts|videos)\//g,
    "$1https://images.senseiai.me/$2/",
  );

  assert.doesNotMatch(
    productionSource,
    /https:\/\/images\.linkjob\.ai\/images\/icons\/close\.svg/,
  );
});

test("the homepage platform card keeps its authored rich copy", async () => {
  const [content, component] = await Promise.all([
    readFile("src/content/sections/featuresectionv2.md", "utf8"),
    readFile("src/layouts/partials/FeaturesSectionV2.astro", "utf8"),
  ]);

  assert.match(
    content,
    /\[<span style='color: #253B80; text-decoration: underline;'>special setting<\/span>\]\(/,
  );
  assert.match(component, /data-feature-card="platform"/);
  assert.match(component, /data-video-dialog-scope/);
  assert.match(component, /set:html=\{markdownify\(/);
});

test("video dialog triggers support both links and video facade buttons", async () => {
  const openedUrls = [];
  const originalDocument = globalThis.document;
  const originalHTMLElement = globalThis.HTMLElement;
  const originalHTMLAnchorElement = globalThis.HTMLAnchorElement;
  const originalOpenVideoDialog = globalThis.__openVideoDialog;

  class FakeHTMLElement {
    constructor() {
      this.dataset = {};
      this.listeners = new Map();
    }

    addEventListener(type, handler) {
      this.listeners.set(type, handler);
    }
  }

  class FakeHTMLAnchorElement extends FakeHTMLElement {
    constructor(href) {
      super();
      this.href = href;
    }
  }

  const link = new FakeHTMLAnchorElement(
    "https://www.youtube.com/watch?v=faq-video",
  );
  const button = new FakeHTMLElement();
  button.dataset.videoUrl = "https://www.youtube.com/watch?v=facade-video";

  globalThis.HTMLElement = FakeHTMLElement;
  globalThis.HTMLAnchorElement = FakeHTMLAnchorElement;
  globalThis.__openVideoDialog = (url) => openedUrls.push(url);
  globalThis.document = {
    querySelectorAll(selector) {
      assert.match(selector, /\[data-video-dialog\]/);
      assert.match(selector, /\[data-video-dialog-scope\]/);
      return [link, button];
    },
    addEventListener() {},
  };

  try {
    const source = await readFile("public/js/home-video-dialog.js", "utf8");
    const testableSource = source.replace(
      'import { openVideoDialog } from "/js/video-dialog.js";',
      "const openVideoDialog = globalThis.__openVideoDialog;",
    );
    await import(
      `data:text/javascript;base64,${Buffer.from(testableSource).toString("base64")}`
    );

    const event = { preventDefault() {} };
    link.listeners.get("click")(event);
    button.listeners.get("click")(event);
  } finally {
    globalThis.document = originalDocument;
    globalThis.HTMLElement = originalHTMLElement;
    globalThis.HTMLAnchorElement = originalHTMLAnchorElement;
    globalThis.__openVideoDialog = originalOpenVideoDialog;
  }

  assert.deepEqual(openedUrls, [
    "https://www.youtube.com/watch?v=faq-video",
    "https://www.youtube.com/watch?v=facade-video",
  ]);
});
