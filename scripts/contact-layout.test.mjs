import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("contact page uses compact vertical spacing without changing other page headers", async () => {
  const contact = await read("src/pages/contact.astro");
  const pageHeader = await read("src/layouts/partials/PageHeader.astro");

  assert.match(contact, /<PageHeader title=\{title\} compact \/>/);
  assert.match(contact, /class="mb-4 rounded-md bg-white p-6 lg:mb-8/);
  assert.match(pageHeader, /compact \? "pb-4 pt-4" : "pb-10 pt-10"/);
});
