#!/usr/bin/env node
// Applies the mechanical half of the Cursor-to-Claude-Code port to the
// markdown under the skills tree. Each substitution is one class that
// check-port.mjs flags and that has exactly one correct rewrite, so a script
// does it the same way every time and a rerun changes nothing. The classes
// that need a sentence rewritten are not here; check-port.mjs lists them.
import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = process.argv[2] ?? join(here, "..", "..");

const SKIP = [/[\\/]node_modules[\\/]/];

// Ordered. Principles were skills upstream and are files here, so the
// "principle skill" phrase becomes the bare **principle-<slug>** name the
// session hook resolves. The article goes with it.
const SUBS = [
  [/\*\*(?!principle-)([a-z-]+)\*\* principle skills?/g, "**principle-$1**"],
  [/\*\*(principle-[a-z-]+)\*\* skill\b/g, "**$1**"],
  [/\bthe \*\*(principle-[a-z-]+)\*\*/g, "**$1**"],
  [/(?<!anthropic-skills:)\bskill-creator\b/g, "anthropic-skills:skill-creator"],
  [/pstack\/skills\//g, "~/.claude/skills/"],
  [/git show origin\/main:(~\/\.claude\/skills\/)/g, "cat $1"],
  [/git show origin\/main:<control skill path>/g, "cat <control skill path, under ~/.claude/skills>"],
];

// "the **a** and **b** principle skills" prefixes only b above. Any bare
// **<slug>** that names a real principle file gets the prefix too, and it
// runs before the article rule so one pass settles "the **a**".
const slugs = readdirSync(join(root, "poteto-mode", "principles")).map((f) => f.replace(/\.md$/, ""));
SUBS.splice(2, 0, ...slugs.map((s) => [new RegExp(`\\*\\*${s}\\*\\*`, "g"), `**principle-${s}**`]));

function* walk(dir) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (SKIP.some((re) => re.test(p))) continue;
    if (statSync(p).isDirectory()) yield* walk(p);
    else if (name.endsWith(".md")) yield p;
  }
}

let files = 0;
let total = 0;
for (const file of walk(root)) {
  const before = readFileSync(file, "utf8");
  let after = before;
  let n = 0;
  for (const [re, to] of SUBS) {
    after = after.replace(re, (...m) => {
      n += 1;
      return to.replace(/\$(\d)/g, (_, i) => m[Number(i)]);
    });
  }
  if (after !== before) {
    writeFileSync(file, after);
    files += 1;
    total += n;
    console.log(`${relative(root, file).replaceAll("\\", "/")}: ${n}`);
  }
}
console.log(`${total} replacement${total === 1 ? "" : "s"} in ${files} file${files === 1 ? "" : "s"}`);
