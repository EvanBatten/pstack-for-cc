import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { renderBanner, renderPreviewHtml } from "./brand.mjs";

const REPORT = JSON.parse(
  fs.readFileSync(path.join(import.meta.dirname, "..", "eval", "parity", "results", "s4", "report.json"), "utf8"),
);

test("the preview tiles show this port then Cursor as k/n, in order", () => {
  const html = renderPreviewHtml(REPORT);
  const pairs = [...html.matchAll(/class="port">([^<]+)<\/span><span class="cursor">vs ([^<]+)</g)].map((m) => [m[1], m[2]]);
  assert.deepEqual(pairs, [
    ["10/10", "2/10"],
    ["20/20", "7/20"],
    ["18/18", "11/18"],
  ]);
});

test("the preview names the comparison and the repository", () => {
  const html = renderPreviewHtml(REPORT);
  assert.ok(html.includes("vs pstack on Cursor, same model"));
  assert.ok(html.includes("github.com/EvanBatten/pstack-for-cc"));
});

test("a report missing a tile's Cursor cell throws and names it", () => {
  const cells = REPORT.result.cells.filter((c) => !(c.behavior === "B7-cite-read" && c.arm === "A"));
  assert.throws(() => renderPreviewHtml({ result: { cells } }), /B7-cite-read, arm A/);
});

test("both banner themes carry the wordmark in their own colors", () => {
  const light = renderBanner("light");
  const dark = renderBanner("dark");
  const colors = (svg) => ({
    bg: svg.match(/<rect [^>]*fill="(#[0-9a-f]{6})"/)[1],
    text: svg.match(/<text [^>]*fill="(#[0-9a-f]{6})"/)[1],
  });
  for (const svg of [light, dark]) {
    assert.match(svg, /^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg"[\s\S]*<\/svg>\n$/);
    assert.ok(svg.includes(">pstack <tspan"));
    assert.ok(svg.includes(">for Claude Code</tspan>"));
  }
  assert.deepEqual(colors(light), { bg: "#faf9f5", text: "#141413" });
  assert.deepEqual(colors(dark), { bg: "#141413", text: "#faf9f5" });
});
