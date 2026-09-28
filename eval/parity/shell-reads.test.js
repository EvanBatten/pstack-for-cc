import assert from "node:assert/strict";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { shellActions } from "./cursor-trace.mjs";
import { shellReads } from "./shell-reads.mjs";

const plugin = "C:/pp-parity/s5/plugin-src/pstack-claude-c02fd4922b25/plugins/pstack/skills";
const ws = "C:/pp-parity/s5/r/r06/shop-cart";

test("a cd earlier in the command resolves the files a later cat prints in full", () => {
  const command = `cd ${plugin} && cat principle-fix-root-causes/SKILL.md principle-laziness-protocol/SKILL.md; cd /c/pp-parity/s5/r/r06/shop-cart && git remote -v; grep -rn discountPct --include=*.js . `;
  assert.deepEqual(shellReads(command, ws), [
    { path: `${plugin}/principle-fix-root-causes/SKILL.md`, full: true },
    { path: `${plugin}/principle-laziness-protocol/SKILL.md`, full: true },
  ]);
});

test("a cat piped onward, head, tail and sed -n show a line range of a file", () => {
  assert.deepEqual(shellReads("cat x.md | head -20", "C:/ws"), [{ path: "C:/ws/x.md", full: false, lines: [1, 20] }]);
  assert.deepEqual(shellReads("cat x.md | grep foo", "C:/ws"), [{ path: "C:/ws/x.md", full: false }]);
  assert.deepEqual(shellReads("sed -n 1,80p file.md; sed -n '5,$p' g.md", "C:/ws"), [
    { path: "C:/ws/file.md", full: false, lines: [1, 80] },
    { path: "C:/ws/g.md", full: false, lines: [5, Infinity] },
  ]);
  assert.deepEqual(shellReads("head -n 40 a.md; tail b.md; tail -n +3 c.md", "C:/ws"), [
    { path: "C:/ws/a.md", full: false, lines: [1, 40] },
    { path: "C:/ws/b.md", full: false, lines: [-10, Infinity] },
    { path: "C:/ws/c.md", full: false, lines: [3, Infinity] },
  ]);
  assert.deepEqual(shellReads("Get-Content -TotalCount 30 C:\\s\\how\\SKILL.md", null), [{ path: "C:/s/how/SKILL.md", full: false, lines: [1, 30] }]);
});

test("a line range counts as full when it skips only the frontmatter of the file on disk", () => {
  const file = join(dirname(fileURLToPath(import.meta.url)), "fixtures", "skills", "principle-frontmatter", "SKILL.md").replaceAll("\\", "/");
  const full = (command) => shellActions(command, null, true).filter((a) => a.kind === "read").map((a) => a.full);
  assert.deepEqual(full(`sed -n '5,200p' ${file}`), [true]);
  assert.deepEqual(full(`sed -n '6,200p' ${file}`), [false]);
  assert.deepEqual(full(`sed -n '1,6p' ${file}`), [false]);
  assert.deepEqual(full(`cat ${file} | head -40`), [true]);
  assert.deepEqual(full(`head -n 3 ${file}; tail -n 2 ${file}; tail -n 3 ${file}; tail -n +5 ${file}`), [false, false, true, true]);
  assert.deepEqual(full(`Get-Content -TotalCount 7 ${file}`), [true]);
  assert.deepEqual(full(`sed -n '5,200p' ${file.replace("principle-frontmatter", "principle-absent")}`), [false]);
});

test("Get-Content, gc and type print a whole file whatever the path's slashes", () => {
  assert.deepEqual(shellReads("Get-Content C:\\Users\\e\\.claude\\skills\\principle-fix-root-causes\\SKILL.md", null), [
    { path: "C:/Users/e/.claude/skills/principle-fix-root-causes/SKILL.md", full: true },
  ]);
  assert.deepEqual(shellReads('gc -Raw -Path "C:\\a b\\x.md"; type y.md', "C:/ws"), [
    { path: "C:/a b/x.md", full: true },
    { path: "C:/ws/y.md", full: true },
  ]);
});

test("a shell variable and a for loop expand into the files they name", () => {
  assert.deepEqual(shellReads("S=C:/h/.claude/skills/poteto-mode; cat $S/playbooks/bug-fix.md; echo ----; cat ${S}/principles/prove-it-works.md", null), [
    { path: "C:/h/.claude/skills/poteto-mode/playbooks/bug-fix.md", full: true },
    { path: "C:/h/.claude/skills/poteto-mode/principles/prove-it-works.md", full: true },
  ]);
  assert.deepEqual(shellReads(`cd /c/t/skills && for s in how principle-fix-root-causes; do echo "=== $s"; cat $s/SKILL.md; done`, null), [
    { path: "/c/t/skills/how/SKILL.md", full: true },
    { path: "/c/t/skills/principle-fix-root-causes/SKILL.md", full: true },
  ]);
});

test("output sent to a file is not a read, and commands that print no file yield nothing", () => {
  assert.deepEqual(shellReads("cat a.md > b.md; cat c.md 2>/dev/null; ls && git log | head", "C:/ws"), [{ path: "C:/ws/c.md", full: true }]);
  assert.deepEqual(shellReads("npm test 2>&1 | tail -40; echo 'cat x.md'", "C:/ws"), []);
});

test("a shell call reads only the pstack documents it printed, and fails with its call", () => {
  const command = `ls && cat package.json && git ls-files && cat ${plugin}/poteto-mode/playbooks/bug-fix.md`;
  assert.deepEqual(shellActions(command, ws, false), [
    { kind: "shell", command, writes: [] },
    { kind: "read", doc: "playbook:bug-fix", path: `${plugin}/poteto-mode/playbooks/bug-fix.md`, full: true, ok: false },
  ]);
  assert.deepEqual(shellActions("cat package.json", ws, true), [{ kind: "shell", command: "cat package.json", writes: [] }]);
});

test("a heredoc body is text, not commands, so a line that looks like a printer or an object key reads nothing", () => {
  const command = "cd /c/ws && cat > src/coupons.js <<'EOF'\nexport class CouponError extends Error {\n  constructor(code) {\n    super(code);\n  }\n}\ncat notes.md\nEOF\ncat after.md";
  assert.deepEqual(shellReads(command, null), [{ path: "/c/ws/after.md", full: true }]);
  assert.deepEqual(shellReads("cat <<-END\n\tcat inside.md\n\tEND\ncat out.md", "C:/ws"), [{ path: "C:/ws/out.md", full: true }]);
});

test("a command named like an Object.prototype key is not a printer", () => {
  assert.deepEqual(shellReads("constructor x.md; toString y.md; valueOf z.md", "C:/ws"), []);
});
