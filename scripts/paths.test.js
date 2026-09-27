import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import path from "node:path";

// Git for Windows leaves core.longpaths off, so a clone fails once the clone
// directory plus a tracked path passes 260 characters. 100 leaves 160 for the
// directory a user clones into.
const LIMIT = 100;

test("every tracked path fits a Windows clone of the repo", () => {
  const files = execFileSync("git", ["ls-files", "-z"], { cwd: path.join(import.meta.dirname, ".."), encoding: "utf8" })
    .split("\0")
    .filter(Boolean);
  assert.ok(files.includes("scripts/paths.test.js"));
  assert.deepEqual(
    files.filter((f) => f.length > LIMIT),
    [],
  );
});
