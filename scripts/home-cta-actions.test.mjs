import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("every CTA uses the same left-aligned download and plans actions", async () => {
  const [page, callToAction, ...entries] = await Promise.all([
    readFile("src/pages/index.astro", "utf8"),
    readFile("src/layouts/partials/CallToAction.astro", "utf8"),
    readFile("src/content/sections/call-to-action.md", "utf8"),
    readFile("src/content/sections/call-to-action-coding.md", "utf8"),
    readFile("src/content/sections/call-to-action-copilot.md", "utf8"),
    readFile("src/content/sections/call-to-action-mock.md", "utf8"),
  ]);

  assert.match(page, /<CallToAction\s+variant="home"\s*\/>/);
  assert.doesNotMatch(callToAction, /md:pl-\[120px\]/);
  assert.match(callToAction, /class="flex w-full justify-start/);
  assert.match(callToAction, /class="btn btn-download btn-download-primary"/);
  assert.match(callToAction, /src="\/images\/icons\/download-white\.png"/);
  assert.match(callToAction, /class="btn btn-download btn-download-secondary"/);
  assert.match(callToAction, /src="\/images\/icons\/arrow-right\.png"/);
  assert.match(callToAction, /CTA\.button2/);

  for (const entry of entries) {
    assert.match(entry, /button:\s+enable: true\s+label: "Download the app"/);
    assert.match(entry, /button2:\s+enable: true\s+label: "See plans"/);
  }

  assert.match(
    entries[0],
    /<span class="text-\[#[0-9A-Fa-f]{6}\]">AI interview assistant<\/span>/,
  );
});
