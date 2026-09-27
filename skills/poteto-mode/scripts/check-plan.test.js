// The multi-phase plan gate must be passable by a plan written for Claude
// Code. Upstream's gate demanded a `/goal` and a `git show origin/main:`
// re-read, both Cursor affordances, so every plan failed here. This runs the
// real gate on a plan in the ported form and on the same plan in the old
// form, and asserts on what it prints.
import { test } from "node:test";
import assert from "node:assert";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const GATE = path.join(import.meta.dirname, "check-plan.mjs");
const RULE = "Tests alone are not sufficient verification. A PR is verified only when its unit, live, and perf boxes are all checked.";

const lanes = Array.from({ length: 10 }, (_, i) => `- [ ] Lane ${i + 1}. Run \`--help\`. Save \`lane-${i + 1}.png\`. Pass when the flag is listed.`);

const PLAN = `# Sample program plan

One PR that adds a flag. The rule the program enforces is the verification rule below. The PR ids in order are PR-1.

## How to read this

One box is one unit of work. Every box names the evidence that checks it. A nested box is a sub-step of the box above it. Check a box only when its evidence exists, a file, a log line, a screenshot, a test run, or a SHA. The body is a how-to. The appendices explain and record.

The program runs \`~/.claude/skills/poteto-mode/playbooks/autopilot-stack.md\`. The operator merges.

${RULE}

## Program checklist

### Arm the program

- [ ] On the operator's go, arm the standing order with this exact text, \`orch standing add "..."\`.
- [ ] Read these from disk at program start. Re-read them at every tick.
  - [ ] \`cat ~/.claude/skills/poteto-mode/playbooks/autopilot-stack.md\`
- [ ] Arm the 30-minute audit tick with \`/loop 30m\`.
- [ ] Post a status message to the operator at every tick.

### Spawn owners

- [ ] Spawn one owner per PR.

### PR mechanics

- [ ] Each owner opens its PR ready.

### Verdict and merge

- [ ] The root verifies each merge-ready head.

### Boot recipe

- [ ] Re-read this plan and the standing orders.

## PR-1 add the flag

**Depends on.** Nothing.

**Files.**
- [ ] \`src/flag.ts\`

**Build.**
- [ ] Add the flag.

**You see.**
- [ ] The flag appears in \`--help\`.

**Verify, unit.** ${RULE}
- [ ] \`bun test\`

**Verify, live.** ${RULE} Ten lanes on \`sonnet\` at the PR head.
${lanes.join("\n")}

**Verify, perf.** ${RULE}
- [ ] Metric. Startup time.
- [ ] Probe. Interleaved trunk and head runs.
- [ ] Baseline. Trunk measured first.
- [ ] Rule. Fail above 110 percent of trunk.

**Review gate.** None. PR-1 is not review-gated.

**Merge.**
- [ ] The operator merges.

## Close the program

- [ ] Post the final status message.

## Appendix A. Prototype evidence

None needed.
`;

function gate(text) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "check-plan-"));
  const file = path.join(dir, "plan.md");
  fs.writeFileSync(file, text);
  const r = spawnSync(process.execPath, [GATE, file], { encoding: "utf8" });
  fs.rmSync(dir, { recursive: true, force: true });
  return { code: r.status, out: r.stdout, err: r.stderr };
}

test("a plan in the Claude Code form passes the gate", () => {
  const r = gate(PLAN);
  assert.strictEqual(r.code, 0, r.err);
  assert.match(r.out, /^1 PR sections, 0 problems$/m);
});

test("a plan still armed with Cursor's /goal and a trunk re-read fails on those two lines", () => {
  const old = PLAN
    .replace("arm the standing order with this exact text, `orch standing add \"...\"`", "arm a `/goal` with this exact text")
    .replace("`cat ~/.claude/skills/poteto-mode/playbooks/autopilot-stack.md`", "`git show origin/main:pstack/skills/poteto-mode/playbooks/autopilot-stack.md`");
  const r = gate(old);
  assert.strictEqual(r.code, 1);
  assert.match(r.err, /Program checklist lacks "orch standing"/);
  assert.match(r.err, /Program checklist lacks "~\/\.claude\/skills\/poteto-mode\/playbooks\/"/);
  assert.match(r.out, /^1 PR sections, 2 problems$/m);
});
