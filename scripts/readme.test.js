import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const README = fs.readFileSync(path.join(import.meta.dirname, "..", "README.md"), "utf8");
const lines = README.split(/\r?\n/);
const headings = lines.filter((l) => /^#{1,6} \S/.test(l));

test("the README carries each heading once", () => {
  assert.deepEqual(
    headings.filter((h, i) => headings.indexOf(h) !== i),
    [],
  );
});

test("no README heading starts in the middle of a line", () => {
  const texts = [...new Set(headings)];
  assert.deepEqual(
    lines.flatMap((line, i) => (line.startsWith("#") ? [] : texts.filter((h) => line.includes(h)).map((h) => `line ${i + 1}: ${h}`))),
    [],
  );
});
