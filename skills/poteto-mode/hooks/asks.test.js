import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { check, note, RULES, spanOf } from "./asks.mjs";
import { loadCatalog, modelTable, stepRange } from "./catalog.mjs";
import { fileKind, inRepo, isIgnored, shellWrites, vcsVerbs } from "./kinds.mjs";
import { readClaudeTrace, toAction } from "./trace.mjs";

const catalog = loadCatalog(path.join(import.meta.dirname, "..", ".."));
const models = modelTable({ path: "C:/Users/me/.claude/pstack-models.md", text: "bug-fix: opus\n" });

// A span has already been asked to route unless a test sets `unrouted`, so each row sees only the ask it names.
const ROUTED = [["route:37a0025a", 1]];
const span = ({ unrouted = false, ...over } = {}) => ({
  main: true,
  turn: 1,
  actions: [],
  playbooks: [],
  unlisted: [],
  tasks: [],
  commits: 0,
  spawnTypes: [],
  trail: false,
  designSkipped: false,
  siblings: [],
  ...over,
  asked: new Map([...(unrouted ? [] : ROUTED), ...(over.asked ?? [])]),
  reads: new Set(over.reads ?? []),
  standing: new Set(over.standing ?? []),
});
const call = (name, input) => toAction({ id: "t1", name, input });
// The table's code edits sit in a repository; the one filesystem read an ask may make is answered here.
const REPO = { inRepo: () => true };
const EDITED = [{ ...toAction({ id: "e0", name: "Edit", input: { file_path: "C:/src/shop/src/cart.js" } }), ok: true }];

const ASK = "Do what applies, then retry the call. Where an ask does not apply, say why in a `skip <name>: <reason>` line for the user, then retry.";
const HARD = "The call is refused until it changes, at most 3 times.";
const SURFACE = "If this change ships a UI, CLI or IDE surface, drive it with control-ui or control-cli first.";
const deny = (ids, ...lines) => ({ kind: "deny", reason: lines.join("\n"), ids });

const ROWS = [
  {
    key: "route",
    action: call("Bash", { command: "git commit -qm 'fix the cart'" }),
    span: { unrouted: true },
    verdict: deny(
      ["route:37a0025a"],
      "poteto-mode routes every task through a playbook: read the matching `playbooks/<name>.md` (or figure-it-out for large or stepped-away work), open its task list, then retry; or write the visible line `skip route: <reason>`. [pstack:route:37a0025a]",
      ASK,
    ),
  },
  {
    key: "ledger",
    action: call("Bash", { command: "npm test" }),
    span: { playbooks: ["bug-fix"], unlisted: ["bug-fix"] },
    verdict: deny(
      ["ledger:5097034e"],
      "Before other work, open the task list: one TaskCreate per step of the Bug fix playbook, its subject copied from the step line. [pstack:ledger:5097034e]",
      ASK,
    ),
  },
  {
    key: "delegate",
    action: call("Edit", { file_path: "C:/src/shop/src/cart.js", old_string: "a", new_string: "b" }),
    span: { playbooks: ["feature"], playbookReadAt: { feature: 0 } },
    verdict: deny(
      ["delegate:2ad56231"],
      "The Feature playbook hands the implementation to a subagent in step 4: spawn `poteto-agent` with model `sonnet` and a tight brief, then retry. [pstack:delegate:2ad56231]",
      ASK,
    ),
  },
  {
    key: "design",
    action: call("Edit", { file_path: "C:/src/shop/src/cart.js", old_string: "a", new_string: "b" }),
    span: { playbooks: ["investigation"], reads: ["principle:model-the-domain"] },
    verdict: deny(
      ["design:0d6f8f53"],
      "Before editing source, write a line `**Shape.** <the data this change touches and how it is organized>` in your reply, then retry this call unchanged. If you already wrote the Shape line this turn, retry unchanged. [pstack:design:0d6f8f53]",
      ASK,
    ),
  },
  {
    key: "design-read",
    action: call("Edit", { file_path: "C:/src/shop/src/cart.js", old_string: "a", new_string: "b" }),
    span: { playbooks: ["investigation"], asked: new Map([["design:0d6f8f53", 1]]) },
    verdict: deny(
      ["design-read:37a0025a"],
      "Before this edit, read principles/model-the-domain.md in full, then retry this call unchanged. [pstack:design-read:37a0025a]",
      "If this change crosses a function boundary, read architect/SKILL.md first.",
      ASK,
    ),
  },
  {
    key: "task-merged",
    action: call("TaskCreate", { subject: "Bug fix 3-4: plan the fix and verify" }),
    span: { playbooks: ["bug-fix"] },
    verdict: deny(
      ["task-merged:d0e878b7"],
      "One TaskCreate per step: this subject spans steps 3-4, so it carries none of them. Create each step as its own item. [pstack:task-merged:d0e878b7]",
      HARD,
    ),
  },
  {
    key: "step-done",
    action: call("TaskUpdate", { taskId: "2", status: "completed" }),
    span: { playbooks: ["bug-fix"], tasks: [{ id: "2", subject: "2. Binary-search the cause.", description: null, status: "in_progress" }] },
    verdict: deny(
      ["step-done:c9e242ed"],
      "Bug fix step 2 names the how and why skills. Before you mark it completed, read how/SKILL.md and why/SKILL.md in full and run each. [pstack:step-done:c9e242ed]",
      ASK,
    ),
  },
  {
    key: "skill-edit",
    action: call("Write", { file_path: "C:/src/kit/skills/lint/SKILL.md", content: "x" }),
    span: {},
    verdict: deny(
      ["skill-edit:f6100acd"],
      "Before editing a skill document, read poteto-mode/playbooks/authoring-a-skill.md and unslop/SKILL.md in full. [pstack:skill-edit:f6100acd]",
      ASK,
    ),
  },
  {
    key: "docs-prose",
    action: call("Edit", { file_path: "C:/src/shop/README.md", old_string: "a", new_string: "b" }),
    span: {},
    verdict: deny(["docs-prose:37a0025a"], "Before editing documentation, read technical-writing/SKILL.md and unslop/SKILL.md in full. [pstack:docs-prose:37a0025a]", ASK),
  },
  {
    key: "decision-log",
    action: call("Bash", { command: "bash ~/.claude/skills/show-me-your-work/scripts/log.sh .audit/decisions.tsv H1 kept" }),
    span: {},
    verdict: deny(["decision-log:37a0025a"], "Before writing the decision log, read show-me-your-work/SKILL.md in full. [pstack:decision-log:37a0025a]", ASK),
  },
  {
    key: "deslop",
    action: call("Bash", { command: "git -C repo commit -m x" }),
    span: { playbooks: ["hillclimb"], actions: EDITED },
    verdict: deny(
      ["deslop:077a459b"],
      "Before committing, read deslop/SKILL.md in full and run it on the staged diff. [pstack:deslop:077a459b]",
      SURFACE,
      "Hillclimb commits only a kept attempt, after a passing gate run and its verdict row in the decision log.",
      ASK,
    ),
  },
  {
    key: "pr-draft",
    action: call("Bash", { command: "gh pr create --draft --title x --body y" }),
    span: { reads: ["skill:no-comments", "skill:technical-writing", "skill:unslop"] },
    verdict: deny(["pr-draft:37a0025a"], "Open every PR ready, never as a draft. Drop the draft flag. [pstack:pr-draft:37a0025a]", SURFACE, HARD),
  },
  {
    key: "review",
    action: call("Bash", { command: "gh pr create --title x --body y" }),
    span: { reads: ["skill:technical-writing", "skill:unslop"] },
    verdict: deny(
      ["review:37a0025a"],
      "Before this PR opens, read no-comments/SKILL.md in full and run it on the diff, or spawn `comment-sicko` on it. [pstack:review:37a0025a]",
      SURFACE,
      ASK,
    ),
  },
  {
    key: "pr-prose",
    action: call("mcp__github__create_pull_request", { title: "x" }),
    span: { reads: ["skill:no-comments"] },
    verdict: deny(
      ["pr-prose:37a0025a"],
      "Before this PR opens, read technical-writing/SKILL.md and unslop/SKILL.md in full and write its title and body with them. [pstack:pr-prose:37a0025a]",
      SURFACE,
      ASK,
    ),
  },
  {
    key: "shipping",
    action: call("Bash", { command: "gh pr merge 12 --squash" }),
    span: {},
    verdict: deny(["shipping:37a0025a"], "Before this merge, read poteto-mode/playbooks/shipping.md in full and run its independent per-PR verdict. [pstack:shipping:37a0025a]", ASK),
  },
  {
    key: "model-role",
    action: call("Agent", { description: "Fix the parser", subagent_type: "poteto-agent", model: "sonnet", prompt: "Playbook: Bug fix\n\nFix the parser." }),
    span: {},
    verdict: deny(
      ["model-role:0f1548ad"],
      'The Bug fix delegate "Fix the parser" would run on sonnet, but pstack-models.md sets bug-fix to opus. Spawn Bug fix delegates with model "opus". [pstack:model-role:0f1548ad]',
      HARD,
    ),
  },
  {
    key: "spawn-cites",
    action: call("Agent", { description: "Tidy", subagent_type: "general-purpose", prompt: "Tidy the module per **principle-laziness-protocol**." }),
    span: {},
    verdict: deny(["spawn-cites:2e93fedc"], "This brief cites a principle you have not read. Read principles/laziness-protocol.md in full, or drop the citation. [pstack:spawn-cites:2e93fedc]", ASK),
  },
];

test("the table holds one row for each ask rule, and every note rule is tested on its own", () => {
  assert.deepEqual(
    ROWS.map((r) => r.key),
    RULES.filter((r) => r.mode !== "note").map((r) => r.key),
  );
});

for (const row of ROWS) {
  const rule = RULES.find((r) => r.key === row.key);
  test(`${row.key}: the first call is denied with the literal ask, and the tag it carries lets the retry through${rule?.mode === "hard" ? " after the third deny" : ""}`, () => {
    const first = check(span(row.span), row.action, catalog, models, REPO);
    assert.deepEqual(first, row.verdict);
    // A later ask on the same call, such as the Shape line after the delegate ask, is its own deny, so only this tag counts.
    const retries = [1, 2, 3].map((n) => check(span({ ...row.span, asked: new Map([...(row.span.asked ?? []), ...first.ids.map((id) => [id, n])]) }), row.action, catalog, models, REPO));
    assert.deepEqual(
      retries.map((v) => (v.kind === "deny" && v.ids.some((id) => first.ids.includes(id)) ? "deny" : "through")),
      rule.mode === "hard" ? ["deny", "deny", "through"] : ["through", "through", "through"],
    );
  });
}

test("a doc read, a standing skip naming the rule or its skills, and a delegate comment-sicko each meet their ask", () => {
  const verdict = (action, over) => check(span(over), action, catalog, models).kind;
  const readme = call("Edit", { file_path: "C:/src/shop/README.md", old_string: "a", new_string: "b" });
  const pr = call("Bash", { command: "gh pr create --title x --body y" });
  assert.deepEqual(
    [
      verdict(call("Bash", { command: "git commit -m x" }), { reads: ["skill:deslop"] }),
      verdict(readme, { standing: ["docs-prose"] }),
      verdict(readme, { standing: ["technical-writing", "unslop"] }),
      verdict(readme, { standing: ["unslop"] }),
      verdict(pr, { reads: ["skill:technical-writing", "skill:unslop"], spawnTypes: ["comment-sicko"] }),
      verdict(call("Bash", { command: "gh pr create --draft --title x" }), { reads: ["skill:no-comments", "skill:technical-writing", "skill:unslop"], standing: ["pr-draft"] }),
    ],
    ["allow", "allow", "allow", "deny", "allow", "allow"],
  );
});

test("the design asks come one per deny: the Shape line once per turn, then the principle read once per span, and never of a delegate", () => {
  const edit = call("Edit", { file_path: "C:/src/shop/src/cart.js", old_string: "a", new_string: "b" });
  const at = (over) => check(span({ turn: 4, ...over }), edit, catalog, models).ids ?? [];
  const shaped = new Map([["design:fa0537ee", 1]]);
  assert.deepEqual(
    [
      at({}),
      at({ asked: shaped }),
      at({ asked: new Map([...shaped, ["design-read:37a0025a", 1]]) }),
      at({ asked: shaped, reads: ["principle:model-the-domain"] }),
      at({ turn: 5, asked: new Map([...shaped, ["design-read:37a0025a", 1]]) }),
      at({ main: false }),
    ],
    [["design:fa0537ee"], ["design-read:37a0025a"], [], [], ["design:61e95964"], []],
  );
});

test("deslop asks at a commit only when the span edited code since the last commit or the commit names a code file, and a step whose skills are read is not asked", () => {
  const commit = call("Bash", { command: "git commit -m x" });
  const done = call("TaskUpdate", { taskId: "2", status: "completed" });
  const tasks = [{ id: "2", subject: "2. Binary-search the cause.", description: null, status: "in_progress" }];
  const committed = { ...commit, id: "c0", ok: true };
  const doc = [{ ...toAction({ id: "d0", name: "Edit", input: { file_path: "C:/src/shop/README.md" } }), ok: true }];
  assert.deepEqual(
    [
      check(span({ commits: 1, actions: EDITED, asked: new Map([["deslop:077a459b", 1]]) }), commit, catalog, models).ids,
      check(span({ actions: doc }), commit, catalog, models).kind,
      check(span({ actions: doc }), call("Bash", { command: "git add bin/deploy.sh docs/a.md && git commit -m 'touch notes.md'" }), catalog, models).kind,
      check(span({ actions: doc }), call("Bash", { command: "git add docs/a.md && git commit -m 'fix cart.js'" }), catalog, models).kind,
      check(span({ actions: [{ ...call("Agent", { subagent_type: "poteto-agent", prompt: "Fix it." }), id: "s0", ok: true }] }), commit, catalog, models).kind,
      check(span({ actions: [{ ...call("Agent", { subagent_type: "general-purpose", prompt: "Look." }), id: "s0", ok: true }] }), commit, catalog, models).kind,
      check(span({ actions: [...EDITED, committed], commits: 1 }), commit, catalog, models).kind,
      check(span({ playbooks: ["bug-fix"], tasks, reads: ["skill:how", "skill:why"] }), done, catalog, models).kind,
      check(span({ playbooks: ["bug-fix"], tasks: [{ ...tasks[0], subject: "Write the notes." }] }), done, catalog, models).kind,
    ],
    [["deslop:e600c0cb"], "allow", "deny", "allow", "deny", "allow", "allow", "allow", "allow"],
  );
});

test("a completed step is answered by a skip naming its skill, or by work done in a prior session, in the item or the completing call", () => {
  const tasks = [{ id: "1", subject: "1. Ground the workload and architecture before choosing the metric.", description: null, status: "in_progress" }];
  const done = (description, own = null) =>
    check(span({ playbooks: ["hillclimb"], tasks: [{ ...tasks[0], description: own }] }), call("TaskUpdate", { taskId: "1", status: "completed", ...(description ? { description } : {}) }), catalog, models).kind;
  assert.deepEqual(
    [
      done(null),
      done("skip how: grounded in prior sessions; decisions.tsv 2026-09-26T10:34 rows hold the model and the metric of record."),
      done("Done in prior sessions: drive-bench register trace wallMs, lower is better."),
      done("Done. Metric: drive-bench.sh register trace wallMs (prior session's frozen choice)."),
      done(null, "skip how: the metric is fixed."),
      done("Done. skip why: nothing to trace."),
      done("Fix the regression the previous session introduced."),
      done("Completed in the previous session."),
      done("Grounding from the earlier session is finished."),
    ],
    ["deny", "allow", "allow", "deny", "allow", "deny", "deny", "allow", "allow"],
  );
});

test("a step-done ask names only the skills a step requires, not one named under a condition or handed to another actor", () => {
  const complete = (playbook, n) => {
    const subject = catalog.playbooks[playbook].steps.find((s) => s.n === n).line.split("\n")[0];
    const verdict = check(span({ playbooks: [playbook], tasks: [{ id: "9", subject, description: null, status: "in_progress" }] }), call("TaskUpdate", { taskId: "9", status: "completed" }), catalog, models);
    return verdict.reason?.split(" [pstack:")[0] ?? verdict.kind;
  };
  assert.deepEqual(
    [complete("bug-fix", 5), complete("bug-fix", 3), complete("autopilot-full", 2)],
    [
      "allow",
      "allow",
      "Autopilot-full step 2 names the show-me-your-work skill. Before you mark it completed, read show-me-your-work/SKILL.md in full and run it.",
    ],
  );
});

test("completing a step that never went in_progress is not asked, since a resumed session catches its list up that way", () => {
  const done = (description) =>
    check(span({ playbooks: ["hillclimb"], tasks: [{ id: "2", subject: "2. Freeze the harness.", description, status: "pending" }] }), call("TaskUpdate", { taskId: "2", status: "completed" }), catalog, models).kind;
  assert.deepEqual(["bench/drive-bench.sh frozen; baseline hyp-6 median 260.6 s recorded 2026-09-26.", "State: harness still open, baseline pending"].map(done), ["allow", "allow"]);
});

test("a skip with a reason in the item's own words answers its step", () => {
  const done = (subject, description = null) =>
    check(span({ playbooks: ["bug-fix"], tasks: [{ id: "2", subject, description, status: "in_progress" }] }), call("TaskUpdate", { taskId: "2", status: "completed" }), catalog, models).kind;
  assert.deepEqual(
    [
      done("2. Binary-search the cause (skip: behavior holds, nothing to root-cause)"),
      done("2. Binary-search the cause.", "skip: nothing to bisect, one commit"),
      done("2. Binary-search the cause (skip:)"),
      done("2. Binary-search the cause."),
    ],
    ["allow", "allow", "deny", "deny"],
  );
});

test("an item that copies its step's line is not a skip, since only the worker's own words can answer the step", () => {
  const line = catalog.playbooks.feature.steps.find((s) => s.n === 2).line.split("\n")[0];
  const done = (subject, description = null) =>
    check(span({ playbooks: ["feature"], tasks: [{ id: "2", subject, description, status: "in_progress" }] }), call("TaskUpdate", { taskId: "2", status: "completed" }), catalog, models).kind;
  assert.deepEqual([done(line), done(line, "architect skipped: one function, no boundary crossed.")], ["deny", "allow"]);
});

test("model-role compares model families, so a full model id or an alias with a context suffix matches its role", () => {
  const spawn = (model) => call("Agent", { description: "Fix", subagent_type: "poteto-agent", model, prompt: "Playbook: Bug fix\n\nFix it." });
  const table = (value) => modelTable({ path: "C:/Users/me/.claude/pstack-models.md", text: `bug-fix: ${value}\n` });
  const kind = (model, value) => check(span(), spawn(model), catalog, table(value)).kind;
  assert.deepEqual(
    [kind("claude-opus-5-5", "opus"), kind("opus", "claude-opus-5-5"), kind("opus[1m]", "opus"), kind("sonnet", "claude-opus-5-5")],
    ["rewrite", "rewrite", "rewrite", "deny"],
  );
});

test("a spawn with nothing owed gets its playbook's steps appended to the brief", () => {
  const brief = "Playbook: Bug fix\n\nFix the parser.";
  const verdict = check(span(), call("Agent", { description: "Fix", subagent_type: "poteto-agent", model: "opus", prompt: brief }), catalog, models);
  assert.deepEqual([verdict.kind, verdict.prompt.split("\n").slice(0, 6)], ["rewrite", ["Playbook: Bug fix", "", "Fix the parser.", "", "# pstack step ledger: Bug fix", ""]]);
});

test("tasks-stale is a note after a commit that leaves every item in its first state, once per span", () => {
  const created = { kind: "todo", op: "create", items: [{ id: "1", subject: "1. Reproduce it.", description: null, status: "pending" }], ok: true };
  const moved = { kind: "todo", op: "update", items: [{ id: "1", subject: null, description: null, status: "in_progress" }], ok: true };
  const commit = call("Bash", { command: "git commit -m x" });
  assert.deepEqual(
    [
      note(span({ actions: [created] }), commit, catalog, models),
      note(span({ actions: [created, moved] }), commit, catalog, models),
      note(span({ actions: [created], asked: new Map([["tasks-stale:37a0025a", 1]]) }), commit, catalog, models),
      check(span({ actions: [created], reads: ["skill:deslop"] }), commit, catalog, models).kind,
    ],
    [
      {
        text: "You committed with every task item still in its first state. Update the items this commit closes with TaskUpdate. [pstack:tasks-stale:37a0025a]",
        ids: ["tasks-stale:37a0025a"],
      },
      null,
      null,
      "allow",
    ],
  );
});

test("the first code edit under a delegating playbook with no spawn since its read is asked to delegate, once per live playbook, before the Shape line", () => {
  const trace = readClaudeTrace(path.join(import.meta.dirname, "fixtures", "first-edit-two-playbooks.jsonl"));
  const recorded = trace.turns.flatMap((t) => t.actions).at(-1);
  // The recorded first edit is a test file, which the delegate ask leaves alone; the same edit to product code is asked.
  const edit = { ...recorded, path: recorded.path.replace(/tests\\test_cart\.py$/, "src\\cart.py") };
  const s = spanOf(trace, recorded.id, new Set(), catalog);
  const repo = { inRepo: (p) => p.includes("shop") };
  const at = (over, action = edit) => check({ ...s, ...over }, action, catalog, models, repo);
  const first = at({});
  const spawned = { kind: "spawn", id: "s1", agentType: "poteto-agent", model: "opus", description: "Fix", prompt: "Fix it.", background: false, ok: true };
  assert.deepEqual(
    [
      at({}, recorded).ids,
      first.reason.split("\n")[0],
      at({ asked: new Map([...s.asked, ...first.ids.map((id) => [id, 1])]) }).ids,
      at({ actions: [...s.actions, spawned] }).ids,
    ],
    [
      ["design:0d6f8f53"],
      "The Bug fix playbook hands the implementation to a subagent in step 3: spawn `poteto-agent` with model `opus` and a tight brief, or write the visible line `skip delegate: <reason>`, then retry. [pstack:delegate:5097034e]",
      ["delegate:f4c1e985"],
      ["delegate:564cddcd"],
    ],
  );
});

test("a turn whose text named the shape before an edit the delegate ask held back is not asked the Shape line on the retry", () => {
  const trace = readClaudeTrace(path.join(import.meta.dirname, "fixtures", "first-edit-two-playbooks.jsonl"));
  const recorded = trace.turns.flatMap((t) => t.actions).at(-1);
  const edit = { ...recorded, path: recorded.path.replace(/tests\\test_cart\.py$/, "src\\cart.py") };
  const repo = { inRepo: (p) => p.includes("shop") };
  const retried = (text) => {
    const last = trace.turns.at(-1);
    const turns = [...trace.turns.slice(0, -1), { ...last, texts: [...last.texts, { text, at: last.actions.length - 1 }] }];
    const s = spanOf({ ...trace, turns }, recorded.id, new Set(), catalog);
    // The fixture has two delegating playbooks live, and each asks once before the edit goes on.
    const asked = new Map(s.asked);
    for (;;) {
      const ids = check({ ...s, asked }, edit, catalog, models, repo).ids ?? [];
      if (!ids.some((id) => id.startsWith("delegate:"))) return ids;
      for (const id of ids) asked.set(id, 1);
    }
  };
  assert.deepEqual(
    [
      retried("skip delegate: a one-line fix.\n\n**Shape.** A cart is a list of line items, each a product and a quantity."),
      retried("skip delegate: a one-line fix."),
      retried("skip delegate: a one-line fix. No data shape changes here."),
    ],
    [[], ["design:0d6f8f53"], ["design:0d6f8f53"]],
  );
});

test("the delegate ask needs the edited file inside a git repository, found by walking up to a .git entry", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "pstack-repo-"));
  const repo = path.join(root, "repo");
  const worktree = path.join(root, "worktree");
  const loose = path.join(root, "audit", "bench");
  for (const dir of [path.join(repo, ".git"), path.join(repo, "src", "lib"), path.join(worktree, "src"), loose]) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(worktree, ".git"), "gitdir: ../repo/.git/worktrees/w\n");
  assert.deepEqual(
    [path.join(repo, "src", "lib", "cart.js"), path.join(worktree, "src", "cart.js"), path.join(loose, "drive-bench.mjs")].map((p) => inRepo(p)),
    [true, true, false],
  );
  const edit = (file_path) => call("Edit", { file_path, old_string: "a", new_string: "b" });
  const live = span({ playbooks: ["bug-fix"], playbookReadAt: { "bug-fix": 0 } });
  const byPath = { inRepo: (p) => p.includes("/hyp-5/") };
  assert.deepEqual(
    [check(live, edit("C:/src/work/hyp-5/bin/spawn.sh"), catalog, models, byPath).ids, check(live, edit("C:/src/work/.audit/climb/bench/drive-bench.mjs"), catalog, models, byPath).ids],
    [["delegate:5097034e"], ["design:0d6f8f53"]],
  );
});

test("deslop does not ask for a commit into a repository the same command creates, or one that stages only non-code files", () => {
  const kind = (command, actions = EDITED) => check(span({ actions }), call("Bash", { command }), catalog, models).kind;
  assert.deepEqual(
    [
      kind('mkdir -p "$TEMP/smoke" && cd "$TEMP/smoke" && git init -q && cp ../cart.js . && git add . && git commit -qm smoke'),
      kind("cd /tmp && git clone -q ~/src/repo probe && cd probe && git commit -qam init"), // port-check: allow
      kind("git init -q scratch/seed && cd scratch/seed && git add -A && git commit -qm seed"),
      kind('SP="C:/work/scratchpad"; mkdir -p "$SP/smoke" && cd "$SP/smoke" && git init -q && git add -A && git commit -qm smoke'),
      kind('ts=$(date +%s); base="$TEMP/probe-$ts"; for k in bug fix; do d="$base-$k"; mkdir -p "$d"; cd "$d"; git init -q; git add -A; git commit -qm init; done'),
      kind('d="$TEMP/probe"; git -C "$d" init -q; git -C "$d" add -A; git -C "$d" commit -qm init'),
      kind("git add README.md docs/guide.md && git commit -m docs", []),
      kind("git commit -qam fix"),
      kind("git init -q"),
      kind("git init && git add -A && git commit -m initial"),
      kind("mkdir app && cd app && git init -q && git add -A && git commit -qm initial"),
    ],
    ["allow", "allow", "allow", "allow", "allow", "allow", "allow", "deny", "allow", "deny", "deny"],
  );
});

test("a repository is found by any VCS directory the verb table names, the walk stops at a share root, and a failing probe reads as no repository", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "pstack-vcs-"));
  const found = [".git", ".hg", ".jj", ".sl", ".svn"].map((marker) => {
    fs.mkdirSync(path.join(root, marker.slice(1), marker, "x"), { recursive: true });
    return inRepo(path.join(root, marker.slice(1), "src", "a.py"));
  });
  const probed = [];
  const share = inRepo("//host/share/team/src/a.py", (p) => {
    probed.push(p);
    if (p.startsWith("//host/share/team")) throw new Error("EACCES");
    return false;
  });
  assert.deepEqual(
    [found, share, probed.every((p) => p.startsWith("//host/share/")), probed.some((p) => p === "//host/.git" || p === "/.git")],
    [[true, true, true, true, true], false, true, false],
  );
});

test("after a delegate returns, the parent's first code edit in the repository is asked once to send the change back", () => {
  const trace = readClaudeTrace(path.join(import.meta.dirname, "fixtures", "parent-edit-after-spawn.jsonl"));
  const edit = trace.turns.flatMap((t) => t.actions).at(-1);
  const s = spanOf(trace, edit.id, new Set(), catalog);
  const first = check(s, edit, catalog, models, REPO);
  assert.deepEqual(
    [
      edit.path.split("\\").pop(),
      first.reason.split("\n")[0],
      check({ ...s, asked: new Map([...s.asked, ...first.ids.map((id) => [id, 1])]) }, edit, catalog, models, REPO).ids?.some((id) => id.startsWith("delegate:")) ?? false,
    ],
    [
      "cart.py",
      "The Bug fix playbook hands the fix to a subagent: send this change back to the delegate, or write the visible line `skip delegate: <reason>`, then retry. [pstack:delegate:564cddcd]",
      false,
    ],
  );
});

test("the delegate ask leaves an edit to a test or harness file alone, by its name or its directory, in each common layout", () => {
  const live = span({ playbooks: ["bug-fix"], playbookReadAt: { "bug-fix": 0 } });
  const first = (file_path) => check(live, call("Edit", { file_path, old_string: "a", new_string: "b" }), catalog, models, REPO).ids[0].split(":")[0];
  const harness = [
    "C:/src/app/src/cart.test.js",
    "C:/src/app/pkg/cart_test.go",
    "C:/src/app/test_cart.py",
    "C:/src/app/web/cart.spec.ts",
    "C:/src/app/tests/helpers.py",
    "C:/src/app/src/__tests__/cart.js",
    "C:/src/app/conftest.py",
    "C:/src/app/lib/cart_spec.rb",
    "C:/src/app/spec/cart_helper.rb",
    "C:/src/app/app/src/androidTest/java/CartCheck.kt",
    "C:/src/app/src/integrationTest/kotlin/CartFlow.kt",
    "C:/src/app/Shop.Tests/CartChecks.cs",
    "C:/src/app/pkg/testdata/cart.go",
    "C:/src/app/src/fixtures/cart.js",
    "C:/src/app/bench/cart.js",
  ];
  const product = ["C:/src/app/src/cart.js", "C:/src/app/src/latest/cart.js", "C:/src/app/Shop.Core/Cart.cs", "C:/src/app/src/main/kotlin/Cart.kt"];
  assert.deepEqual(
    [...product, ...harness].map(first),
    [...product.map(() => "delegate"), ...harness.map(() => "design")],
  );
});

test("the delegate send-back ask counts only poteto-agent spawns, so an explorer or reviewer spawn opens no new ask", () => {
  const live = { playbooks: ["bug-fix"], playbookReadAt: { "bug-fix": 0 }, asked: new Map([["delegate:5097034e", 1]]) };
  const spawn = (agentType, id) => ({ kind: "spawn", id, agentType, model: "opus", description: "x", prompt: "x", background: false, ok: true });
  const ids = (actions) => check(span({ ...live, actions: [{ kind: "read", id: "r0", path: "x", ok: true }, ...actions] }), call("Edit", { file_path: "C:/src/shop/src/cart.js", old_string: "a", new_string: "b" }), catalog, models, REPO).ids;
  assert.deepEqual(
    [ids([spawn("Explore", "s1"), spawn("pstack-reader", "s2")]), ids([spawn("pstack-reader", "s1"), spawn("poteto-agent", "s2")])],
    [["design:0d6f8f53"], ["delegate:564cddcd"]],
  );
});

const ROUTE =
  "poteto-mode routes every task through a playbook: read the matching `playbooks/<name>.md` (or figure-it-out for large or stepped-away work), open its task list, then retry; or write the visible line `skip route: <reason>`. [pstack:route:37a0025a]";

test("a session that never read a playbook is asked to route at its first source edit", () => {
  const trace = readClaudeTrace(path.join(import.meta.dirname, "fixtures", "unrouted-first-edit.jsonl"));
  const edit = trace.turns.flatMap((t) => t.actions).at(-1);
  const verdict = check(spanOf(trace, edit.id, new Set(), catalog), edit, catalog, models, REPO);
  assert.deepEqual([edit.kind, verdict.ids, verdict.reason.split("\n")[0]], ["write", ["route:37a0025a"], ROUTE]);
});

test("the route ask waits for the main session's first change, an edit, a commit or a spawn, and is asked once", () => {
  const edit = (file_path) => call("Edit", { file_path, old_string: "a", new_string: "b" });
  const spawn = (prompt) => call("Agent", { description: "Fix", subagent_type: "poteto-agent", model: "opus", prompt });
  const route = (action, over = {}) => (check(span({ unrouted: true, ...over }), action, catalog, models).ids ?? []).filter((id) => id.startsWith("route:"));
  assert.deepEqual(
    [
      route(edit("C:/src/shop/src/cart.js")),
      route(edit("C:/src/shop/README.md")),
      route(call("Bash", { command: "git commit -qm 'fix the cart'" })),
      route(spawn("Fix the cart total.")),
      route(call("Bash", { command: "npm test" })),
      route(call("Bash", { command: "cat ~/.claude/skills/poteto-mode/SKILL.md" })),
      route(edit("C:/work/scratchpad/probe/cart.js")),
      route(edit("C:/src/shop/src/cart.js"), { main: false }),
      route(edit("C:/src/shop/src/cart.js"), { unrouted: false }),
    ],
    [["route:37a0025a"], ["route:37a0025a"], ["route:37a0025a"], ["route:37a0025a"], [], [], [], [], []],
  );
});

test("a playbook or figure-it-out read, in the span or in an earlier call of the same message, or a spawn brief that names a playbook, routes the session", () => {
  const edit = call("Edit", { file_path: "C:/src/shop/src/cart.js", old_string: "a", new_string: "b" });
  const spawn = (prompt, agent = "poteto-agent") => call("Agent", { description: "Fix", subagent_type: agent, model: "opus", prompt });
  const route = (action, over = {}) => (check(span({ unrouted: true, ...over }), action, catalog, models).ids ?? []).filter((id) => id.startsWith("route:"));
  // A later sibling's record can reach the transcript after the first call's result, so only an earlier one counts.
  const inMessage = (editFirst) => {
    const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "pstack-route-")), "s.jsonl");
    const block = (id, name, input) => ({ type: "assistant", message: { id: "msg_1", model: "claude-opus-5-5", content: [{ type: "tool_use", id, name, input }] } });
    const editBlock = block("e1", "Edit", { file_path: "C:/src/shop/src/cart.js", old_string: "a", new_string: "b" });
    const readBlock = block("c1", "Bash", { command: "cat ~/.claude/skills/poteto-mode/playbooks/hillclimb.md" });
    const records = [{ type: "user", message: { role: "user", content: "<command-name>/poteto-mode</command-name>\n<command-args>climb it</command-args>" } }, ...(editFirst ? [editBlock, readBlock] : [readBlock, editBlock])];
    fs.writeFileSync(file, records.map((r) => JSON.stringify(r)).join("\n") + "\n");
    const trace = readClaudeTrace(file);
    const pending = trace.turns[0].actions.find((a) => a.id === "e1");
    return (check(spanOf(trace, "e1", new Set(), catalog), pending, catalog, models).ids ?? []).filter((id) => id.startsWith("route:"));
  };
  assert.deepEqual(
    [
      route(edit, { reads: ["playbook:investigation"] }),
      route(edit, { reads: ["skill:figure-it-out"] }),
      inMessage(false),
      inMessage(true),
      route(spawn("Playbook: Bug fix\n\nFix the cart total.")),
      route(spawn("Read SKILL.md first, then run its Eval playbook on the change.")),
      route(spawn("Read `poteto-mode/playbooks/feature.md` and carry its steps.")),
      route(spawn("Read `poteto-mode/playbooks/cart-rules.md` and carry its steps.")),
      route(spawn("Add the new feature to the cart.")),
      route(spawn("Find where the cart total is computed.", "Explore")),
      route(call("Write", { file_path: "C:/Users/me/.claude/projects/C--src-shop/memory/MEMORY.md", content: "x" })),
      route(call("Write", { file_path: "C:/src/shop/dist/out.js", content: "x" })),
    ],
    [[], [], [], ["route:37a0025a"], [], [], [], ["route:37a0025a"], ["route:37a0025a"], [], [], []],
  );
});

test("a shell statement writes the literal target of a redirect, tee, sed -i, perl -i, and the destination of cp, mv or install", () => {
  assert.deepEqual(
    [
      "sed -i 's/a/b/' total.js",
      "sed --in-place -e 's/a/b/' -e 's/c/d/' src/a.js src/b.js",
      "perl -pi -e 's/a/b/' lib/x.pm",
      "cat > total.test.js <<'EOF'\nconst x = 1 > 0;\nEOF",
      "echo x >> notes/app.js && echo y | tee -a one.js two.js",
      "cp -r a.js b.js dest/c.js; mv old.py new.py; install -m 755 tool.sh bin/tool.sh",
      "node a.js 2>&1 > /dev/null; cmd >&2; ls &> /dev/null",
      "echo x > \"$OUT\" && echo y > 'quoted.js' && cp a.js $DEST",
      "python - <<EOF\nopen('a.js','w').write('x')\nEOF",
      "cd web && sed -i 's/a/b/' app.js",
    ].map((command) => shellWrites(command, "C:/src/shop")),
    [
      ["C:/src/shop/total.js"],
      ["C:/src/shop/src/a.js", "C:/src/shop/src/b.js"],
      ["C:/src/shop/lib/x.pm"],
      ["C:/src/shop/total.test.js"],
      ["C:/src/shop/notes/app.js", "C:/src/shop/one.js", "C:/src/shop/two.js"],
      ["C:/src/shop/dest/c.js", "C:/src/shop/new.py", "C:/src/shop/bin/tool.sh"],
      [],
      [],
      [],
      ["C:/src/shop/web/app.js"],
    ],
  );
});

test("a shell write to code is asked as an Edit would be, and one to a log, /dev/null, scratch or a heredoc body is not", () => {
  const asked = (command) => check(span(), call("Bash", { command }), catalog, models).ids ?? [];
  assert.deepEqual(
    [
      "sed -i 's/a/b/' total.js",
      "cat > total.test.js <<'EOF'\nimport { test } from \"node:test\";\nEOF",
      "echo x > out.log",
      "node a.js 2>&1 > /dev/null",
      "cmd >&2",
      "tee /tmp/x.js",
      "python - <<EOF\nopen('a.js','w')\nEOF",
    ].map(asked),
    [["design:0d6f8f53"], ["design:0d6f8f53"], [], [], [], [], []],
  );
});

test("one command that writes several files of one skill owes one skill-edit ask, as the a6d02a67570b05af7:208 write needed", () => {
  const command = [
    "R=C:/Users/me/shop/skills/verify-shop/features",
    "cat > $R/hook-context.md <<'EOF'\n# Hook context\nEOF",
    "cat > $R/gate.md <<'EOF'\n# Gate\nEOF",
    "cat > $R/reader.md <<'EOF'\n# Reader\nEOF",
    "cat > C:/Users/me/shop/skills/verify-shop/SKILL.md <<'EOF'\n# Verify\nEOF",
  ].join("\n");
  const asked = new Map(ROUTED);
  const keys = [];
  for (let i = 0; i < 6; i++) {
    const ids = check(span({ asked }), call("Bash", { command }), catalog, models).ids ?? [];
    keys.push(...ids.map((id) => id.split(":")[0]));
    for (const id of ids) asked.set(id, 1);
  }
  assert.deepEqual(keys, ["skill-edit"]);
});

test("a commit into a clone of a bare repository made in a temp directory is a throwaway, in the same command or a later one", () => {
  const edited = [{ ...call("Edit", { file_path: "C:/src/shop/src/a.js", old_string: "a", new_string: "b" }), id: "e1", ok: true }];
  const seed =
    "R=/tmp/shop-e2e-proto-010406; git init -q --bare -b main \"$R/greeter.git\"; git clone -q \"$R/greeter.git\" \"$R/greeter-seed\" 2>/dev/null; cd \"$R/greeter-seed\" && git config user.email e2e@example.invalid";
  const shell = (command) => ({ ...call("Bash", { command }), ok: true });
  // Each retry carries the tags before it, so every ask the call owes shows up, one per deny.
  const deslop = (actions, command) => {
    const asked = new Map(ROUTED);
    const all = [];
    for (let i = 0; i < 6; i++) {
      const ids = check(span({ actions, asked }), call("Bash", { command }), catalog, models).ids ?? [];
      all.push(...ids);
      for (const id of ids) asked.set(id, 1);
    }
    return all.filter((id) => id.startsWith("deslop"));
  };
  assert.deepEqual(
    [
      deslop(edited, `${seed}; printf '# greeter\\n' > README.md; git add -A && git commit -qm "start the greeter project" && git push -q -u origin main`),
      deslop([...edited, shell(seed)], "cd /tmp/shop-e2e-proto-010406/greeter-seed && git commit -qm next"),
      deslop([...edited, shell(seed)], "git -C /tmp/shop-e2e-proto-010406/greeter-seed commit -qm next"),
      deslop([...edited, shell(seed)], "cd C:/src/shop && git commit -qm real"),
      // A clone of a real remote into a temp directory is real work, so its commit is still asked.
      deslop([...edited, shell("git clone -q https://example.invalid/shop.git /tmp/shop-work/shop")], "cd /tmp/shop-work/shop && git commit -qm fixup"),
    ],
    [[], [], [], ["deslop:077a459b"], ["deslop:077a459b"]],
  );
});

test("a shell write through a variable the command sets to a literal path is seen", () => {
  const command =
    "W=/c/work/shop-wt-76\nsed -i 's#a#b#' $W/AGENTS.md\nsed -i 's#c#d#' $W/docs/agent-control.md\nsed -i 's#e#f#' ${W}/.agents/skills/cart-rules/SKILL.md\ngit -C $W diff --stat";
  assert.deepEqual(
    [shellWrites(command, "C:/Users/me/shop"), (check(span(), call("Bash", { command }), catalog, models).ids ?? []).map((id) => id.split(":")[0])],
    [["/c/work/shop-wt-76/AGENTS.md", "/c/work/shop-wt-76/docs/agent-control.md", "/c/work/shop-wt-76/.agents/skills/cart-rules/SKILL.md"], ["skill-edit"]],
  );
});

test("each commit that follows its own code edit is asked deslop once, even after the skill was read, and a docs-only commit is not", () => {
  const edit = (id, file_path) => ({ ...call("Edit", { file_path, old_string: "a", new_string: "b" }), id, ok: true });
  const commit = (id) => ({ ...call("Bash", { command: `git commit -qm c${id}` }), id, ok: true });
  const asked = (actions, commits) => (check(span({ actions, commits, reads: ["skill:deslop"] }), call("Bash", { command: "git commit -qm next" }), catalog, models).ids ?? []);
  const first = [edit("e1", "C:/src/shop/src/a.js"), commit("c1")];
  assert.deepEqual(
    [
      asked([edit("e1", "C:/src/shop/src/a.js")], 0),
      asked([...first, edit("e2", "C:/src/shop/src/b.js")], 1),
      asked([...first, edit("e2", "C:/src/shop/README.md")], 1),
      asked(first, 1),
    ],
    [["deslop:077a459b"], ["deslop:e600c0cb"], [], []],
  );
});

test("a skip design line answers the design-read ask of its turn too", () => {
  const trace = readClaudeTrace(path.join(import.meta.dirname, "fixtures", "skip-design-retry.jsonl"));
  const retry = trace.turns.flatMap((t) => t.actions).at(-1);
  const s = spanOf(trace, retry.id, new Set(), catalog);
  const text = trace.turns.at(-1).texts;
  assert.deepEqual(
    [text.some((x) => x.text.startsWith("skip design:")), [...s.asked.keys()].filter((id) => id.startsWith("design")), check(s, retry, catalog, models, { inRepo: () => true, ignored: () => false }).ids ?? []],
    [true, ["design:0d6f8f53"], []],
  );
});

test("git answers whether a path is ignored, for a file not yet written too, and a path outside any repository is not", () => {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), "pstack-ignored-"));
  execFileSync("git", ["init", "-q", repo]);
  fs.writeFileSync(path.join(repo, ".gitignore"), ".verify/\n");
  const outside = fs.mkdtempSync(path.join(os.tmpdir(), "pstack-loose-"));
  assert.deepEqual(
    [path.join(repo, ".verify", "perf", "bench.py"), path.join(repo, "src", "a.py"), path.join(outside, "a.py")].map((p) => isIgnored(p)),
    [true, false, false],
  );
});

test("an edit git ignores is not product code, so it raises no code-edit ask, and a tracked path still does", () => {
  const disk = { inRepo: () => true, ignored: (p) => p.replaceAll("\\", "/").includes("/.verify/") };
  const live = span({ playbooks: ["perf-issue"], playbookReadAt: { "perf-issue": 0 } });
  const write = (file_path) => check(live, call("Write", { file_path, content: "x = 1\n" }), catalog, models, disk).ids ?? [];
  const shell = (rel) => check(live, { ...call("Bash", { command: `cat > ${rel} <<'EOF'\nx = 1\nEOF` }), cwd: "C:/src/shop" }, catalog, models, disk).ids ?? [];
  assert.deepEqual(
    [write("C:/src/shop/.verify/perf/bench.py"), write("C:/src/shop/src/a.py"), shell(".verify/perf/ab.py"), shell("src/b.py")],
    [[], ["delegate:f4c1e985"], [], ["delegate:f4c1e985"]],
  );
});

test("a deny carries exactly one ask, the first owed in the fixed order, and the retry raises the next", () => {
  const trace = readClaudeTrace(path.join(import.meta.dirname, "fixtures", "bundled-deny.jsonl"));
  const call64 = trace.turns.flatMap((t) => t.actions).at(-1);
  const s = spanOf(trace, call64.id, new Set(), catalog);
  // Each retry carries the tags of every deny before it, so the owed asks come one at a time until none is left.
  const asked = new Map(s.asked);
  const denies = [];
  for (let i = 0; i < 5; i++) {
    const verdict = check({ ...s, asked }, call64, catalog, models);
    denies.push(verdict.ids ?? verdict.kind);
    for (const id of verdict.ids ?? []) asked.set(id, 1);
  }
  assert.deepEqual([call64.kind, ...denies], ["shell", ["design:0d6f8f53"], ["design-read:37a0025a"], ["deslop:077a459b"], "allow", "allow"]);
});

test("a shell write counts as code only by a source extension, so captured output is not asked", () => {
  const asked = (command) => check(span(), call("Bash", { command }), catalog, models).ids ?? [];
  assert.deepEqual(
    ["./x.sh > ilv1.console 2>&1", "node a.js > run.out", "./bench > times", "sed -i 's/a/b/' total.js", "cat > tool.sh <<'EOF'\necho hi\nEOF"].map(asked),
    [[], [], [], ["design:0d6f8f53"], ["design:0d6f8f53"]],
  );
});

test("only a statement that runs log.sh writes the decision trail, not one that names it", () => {
  const asked = (command) => check(span(), call("Bash", { command }), catalog, models).ids ?? [];
  const LOG = "~/.claude/skills/show-me-your-work/scripts/log.sh";
  assert.deepEqual(
    [
      `grep -n foo ${LOG}`,
      `cat ${LOG}`,
      `bash ${LOG} f.tsv H1 keep why ev ok`,
      `${LOG} f.tsv H1 keep why ev ok`,
      `L=${LOG}; bash "$L" f.tsv H1 keep why ev ok`,
    ].map(asked),
    [[], [], ["decision-log:37a0025a"], ["decision-log:37a0025a"], ["decision-log:37a0025a"]],
  );
});

test("a shell write resolves against the call's working directory, so the delegate ask finds the repository as it would for an Edit", () => {
  const live = span({ playbooks: ["bug-fix"], playbookReadAt: { "bug-fix": 0 } });
  const sed = (cwd) => check(live, { ...call("Bash", { command: "sed -i 's/a/b/' src/cart.js" }), ...(cwd ? { cwd } : {}) }, catalog, models, { inRepo: (p) => p === "C:/src/shop/src/cart.js" }).ids;
  assert.deepEqual([sed("C:/src/shop"), sed(null)], [["delegate:5097034e"], ["design:0d6f8f53"]]);
});

test("on a code edit the ledger ask goes alone, and the delegate ask waits for the edit after it", () => {
  const trace = readClaudeTrace(path.join(import.meta.dirname, "fixtures", "unrouted-first-edit.jsonl"));
  const recorded = trace.turns.flatMap((t) => t.actions).at(-1);
  const edit = { ...recorded, path: "C:\\work\\shop\\src\\checkout.js" };
  const s = spanOf(trace, recorded.id, new Set(), catalog);
  const readBugFix = { kind: "read", id: "pb", file: { path: "C:/Users/me/.claude/skills/poteto-mode/playbooks/bug-fix.md", shows: "all" }, ok: true, showedAll: true };
  const routed = { ...s, asked: new Map([...s.asked, ["route:37a0025a", 1]]), actions: [...s.actions, readBugFix], reads: new Set([...s.reads, "playbook:bug-fix"]), playbooks: ["bug-fix"], playbookReadAt: { "bug-fix": s.actions.length }, unlisted: ["bug-fix"] };
  const first = check(routed, edit, catalog, models, REPO);
  const after = check({ ...routed, asked: new Map([...routed.asked, ...first.ids.map((id) => [id, 1])]) }, edit, catalog, models, REPO);
  assert.deepEqual([first.ids, after.ids], [["ledger:5097034e"], ["delegate:5097034e"]]);
});

test("a recorded deny read back from the transcript is not asked again on the retry, while the refused call itself is still asked", () => {
  const trace = readClaudeTrace(path.join(import.meta.dirname, "fixtures", "deny-retry.jsonl"));
  const at = (id) => {
    const s = spanOf(trace, id, new Set(), catalog);
    const action = trace.turns.flatMap((t) => t.actions).find((a) => a.id === id);
    return { asked: [...s.asked], unlisted: s.unlisted, ids: check(s, action, catalog, models).ids ?? [] };
  };
  assert.deepEqual(
    [at("toolu_01Jr6sgHfvmudani7NsJX6MT"), at("toolu_retry")],
    [
      { asked: [], unlisted: ["bug-fix"], ids: ["ledger:5097034e"] },
      // The retry's `sed -i` edits total.js, so it now owes the Shape line the recorded session never wrote.
      { asked: [["ledger:5097034e", 1]], unlisted: ["bug-fix"], ids: ["design:c08ec9e0"] },
    ],
  );
});

test("a shell command reads every catalog doc path it names, and a playbook counts only from the installed tree", () => {
  const trace = (commands) => ({
    sub: null,
    children: [],
    turns: [
      {
        index: 0,
        prompt: "/poteto-mode",
        command: { name: "poteto-mode", args: "" },
        actions: commands.map((command, i) => ({ ...toAction({ id: `b${i}`, name: "Bash", input: { command } }), ok: true })),
        texts: [],
        stops: [],
        asked: [],
        injected: [],
        models: [],
      },
    ],
  });
  const seen = (...commands) => {
    const s = spanOf(trace(commands), null, new Set(), catalog);
    return [[...s.reads].sort(), s.playbooks];
  };
  assert.deepEqual(
    [
      seen("cd /c/Users/me/.claude/skills/poteto-mode && cat principles/fix-root-causes.md playbooks/bug-fix.md"),
      seen("cat skills/poteto-mode/playbooks/bug-fix.md", "head -5 ~/.claude/skills/deslop/SKILL.md"),
      seen("grep -n x ~/.claude/skills/nope/SKILL.md principles/not-a-principle.md"),
      seen('cd C:/Users/me/.claude/skills/poteto-mode/principles/; for f in encode-lessons-in-structure prove-it-works; do echo "===== $f"; cat $f.md; done'),
      seen("P=/c/Users/me/.claude/skills/poteto-mode/principles; cat $P/migrate-callers-then-delete-legacy-apis.md $P/laziness-protocol.md"),
      seen("cd ~/.claude/skills/deslop && sed -n 1,40p SKILL.md", "cd ~/.claude/skills/how && cat README.md"),
      seen("echo prove-it-works"),
      seen('rg "model-the-domain" ~/.claude/skills/poteto-mode/principles', 'git commit -m "principles: model-the-domain"', "grep -n Shape ~/.claude/skills/deslop/SKILL.md"),
      seen("cat ~/.claude/skills/poteto-mode/principles/*.md").map((x, i) => (i === 0 ? x.length : x)),
      seen('for f in ~/.claude/skills/poteto-mode/principles/*.md; do echo "== $f"; cat "$f"; done').map((x, i) => (i === 0 ? x.length : x)),
    ],
    [
      [["playbook:bug-fix", "principle:fix-root-causes"], ["bug-fix"]],
      [["playbook:bug-fix", "skill:deslop"], []],
      [[], []],
      [["principle:encode-lessons-in-structure", "principle:prove-it-works"], []],
      [["principle:laziness-protocol", "principle:migrate-callers-then-delete-legacy-apis"], []],
      [["skill:deslop"], []],
      [[], []],
      [[], []],
      [Object.keys(catalog.principles).length, []],
      [Object.keys(catalog.principles).length, []],
    ],
  );
});

test("fileKind reads the path shape alone", () => {
  assert.deepEqual(
    [
      "C:/src/shop/src/cart.ts",
      "C:\\src\\shop\\lib\\Cart.kt",
      "C:/src/shop/package.json",
      "C:/src/shop/README.md",
      "C:/src/shop/docs/guide.md",
      "C:/src/shop/notes.md",
      "C:/src/kit/skills/lint/SKILL.md",
      "C:/src/kit/skills/lint/fixtures/skills/x/SKILL.md",
      "C:/src/kit/skills/poteto-mode/playbooks/feature.md",
      "C:/src/shop/.audit/decisions.tsv",
      "C:/src/shop/decisions.md",
      "/tmp/probe.js", // port-check: allow
      "C:/src/shop/scratchpad/probe.js",
      "C:/src/shop/CHANGELOG.md",
      "C:/src/shop/docs/playbooks/deploy.md",
      "C:/src/shop/agents/billing.md",
      "C:/Users/me/.claude/agents/poteto-agent.md",
      "C:/src/kit/skills/lint/references/rules.md",
      "C:/src/shop/docs/decisions.md",
      "C:/src/shop/decision-log.md",
      "C:/src/shop/decisions.jsonl",
      "C:/src/shop/.audit/climb/decisions.md",
      "C:/src/shop/src/temp_sensor.py",
      "C:/src/shop/tmp/probe.js",
      "C:/src/shop/.scratch/probe.js",
      "C:/src/shop/dist/app.js",
      "C:/src/shop/vendor/lib/x.go",
      "C:/src/shop/Makefile",
      "C:/src/shop/Dockerfile",
      "C:/src/shop/bin/deploy",
      "C:/src/shop/CONTRIBUTING.md",
      "C:/src/shop/ARCHITECTURE.md",
    ].map(fileKind),
    [
      "code",
      "code",
      "other",
      "reader-doc",
      "reader-doc",
      "other",
      "skill-doc",
      "other",
      "skill-doc",
      "trail",
      "other",
      "other",
      "other",
      "other",
      "reader-doc",
      "other",
      "skill-doc",
      "skill-doc",
      "reader-doc",
      "other",
      "trail",
      "trail",
      "code",
      "other",
      "other",
      "other",
      "other",
      "code",
      "code",
      "code",
      "reader-doc",
      "reader-doc",
    ],
  );
});

test("fileKind keeps a source tree's temp dir as code, plugin agents as skill docs, and only named top-level docs as reader docs", () => {
  assert.deepEqual(
    [
      "C:/src/shop/src/temp/x.py",
      "C:/src/shop/src/tmp/cache.py",
      "C:/src/kit/plugins/lint/agents/checker.md",
      "C:/src/shop/design-notes.md",
      "C:/src/shop/src/Support.md",
      "C:/src/shop/CLAUDE.md",
      "C:/src/kit/skills/verify-pstack/features/reader.md",
      "C:/src/kit/skills/lint/tests/fixtures/notes.md",
    ].map(fileKind),
    ["code", "code", "skill-doc", "other", "other", "reader-doc", "skill-doc", "other"],
  );
});

test("a skill-edit ask targets the normalized path, so two spellings of one file share a tag", () => {
  const edit = (file_path) => check(span(), call("Edit", { file_path }), catalog, models).ids;
  assert.deepEqual(edit("C:\\src\\kit\\skills\\lint\\SKILL.md"), edit("c:/src/kit/./skills/lint/SKILL.md"));
});

test("vcsVerbs reads commits, PR opens and merges from one verb table, past prefixes, options and quoted text", () => {
  assert.deepEqual(
    [
      "git add -A && git commit -m 'a; git push'",
      "cd repo && GIT_AUTHOR_NAME=x timeout 30 git -C sub commit -qm x",
      "jj commit -m x; hg ci -m y",
      'gh pr create --draft --title "x" --body "$(cat <<\'EOF\'\ngit commit\nEOF\n)"',
      "glab mr create --title x && gh pr merge 3 --squash",
      "git log --grep commit",
      "echo git commit",
      "git commit-tree HEAD",
      "gh pr ready 12",
      "gh pr ready 12 --undo",
    ].map(vcsVerbs),
    [
      [{ verb: "commit" }],
      [{ verb: "commit" }],
      [{ verb: "commit" }, { verb: "commit" }],
      [{ verb: "pr-open", draft: true }],
      [{ verb: "pr-open", draft: false }, { verb: "pr-merge" }],
      [],
      [],
      [],
      [{ verb: "pr-open", draft: false }],
      [],
    ],
  );
});

test("a task subject spans steps only after `steps` or as its lead label, so a number range in the work is not a step range", () => {
  assert.deepEqual(
    [
      "Hillclimb 3-4: decision log open; hypotheses grounded in the model",
      "3-4. Decision log open",
      "HC3-4 Decision log; ground each hypothesis",
      "Hillclimb steps 1-8 (state ledger)",
      "Steps 6 to 8. skip: outside this bounded session.",
      "Fix 2-3 flaky tests",
      "Bump node 18 to 20",
      "Retry 1-3 times on 503",
      "Split lines 10-40 of parser.js",
      "Bump py3-12 support",
    ].map(stepRange),
    [[3, 4], [3, 4], [3, 4], [1, 8], [6, 8], null, null, null, null, [3, 12]],
  );
  const create = (subject) => check(span({ playbooks: ["bug-fix"] }), call("TaskCreate", { subject }), catalog, models).kind;
  assert.deepEqual(["Bump py3-12 support", "Bug fix 3-4: plan", "Steps 3-4: plan the fix, verify on the same surface"].map(create), ["allow", "deny", "deny"]);
});
