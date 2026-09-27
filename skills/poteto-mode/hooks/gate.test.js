import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { STOP_RULES } from "./gate.mjs";
import { parseEvent, respond } from "./pstack-hook.mjs";
import { loadCatalog } from "./catalog.mjs";
import { readClaudeTrace, tagsIn } from "./trace.mjs";

const SKILLS = "C:/Users/me/.claude/skills";
const catalog = loadCatalog(path.join(import.meta.dirname, "..", ".."));

const deps = (logged = []) => ({
  skills: SKILLS,
  models: () => ({ path: "C:/Users/me/.claude/pstack-models.md", text: "bug-fix: opus\n" }),
  catalog: () => catalog,
  raw: (p) => fs.readFileSync(p, "utf8"),
  trace: readClaudeTrace,
  gate: "enforce",
  mark: () => {},
  log: (file, line) => logged.push(`${file} ${line}`),
  fs: { inRepo: () => false },
  skips: () => ({ user: null, project: null }),
});

const slash = (args) => ({ type: "user", message: { role: "user", content: `<command-message>poteto-mode</command-message>\n<command-name>/poteto-mode</command-name>\n<command-args>${args}</command-args>` } });
const tool = (id, name, input, result = "ok", error = false) => [
  { type: "assistant", message: { model: "claude-opus-5-5", content: [{ type: "tool_use", id, name, input }] } },
  { type: "user", message: { role: "user", content: [{ type: "tool_result", tool_use_id: id, content: result, ...(error ? { is_error: true } : {}) }] } },
];
const read = (id, doc) => tool(id, "Read", { file_path: `${SKILLS}/${doc}` });
const reply = (text) => ({ type: "assistant", message: { model: "claude-opus-5-5", stop_reason: "end_turn", content: [{ type: "text", text }] } });
const feedback = (reason) => ({ type: "user", isMeta: true, message: { role: "user", content: `Stop hook feedback:\n${reason}` } });

const transcript = (records) => {
  const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "pstack-gate-")), "session.jsonl");
  fs.writeFileSync(file, records.flat().map((r) => JSON.stringify(r)).join("\n") + "\n");
  return file;
};
const stop = (records, extra = {}, logged = []) => respond(parseEvent({ hook_event_name: "Stop", session_id: "s1", transcript_path: transcript(records), ...extra }), deps(logged));

const CLOSING = "Then reply again with your complete final answer, with the findings fixed and no mention of this gate.";
const block = (...findings) => ({ kind: "block", reason: ["pstack gate. Before you stop:", ...findings.map((f) => `- ${f}`), "The gate names each finding once.", CLOSING].join("\n") });

const ROUTED = "Route: Bug fix playbook.";
const SHAPED = `${ROUTED}\n**Shape.** A cart total stays one number summed from the line items.`;
const LONG = "The cart total now sums each line item before it applies the discount, so the order of those steps no longer moves the result. ".repeat(7);
const UNSLOP = read("u", "unslop/SKILL.md");
const PRINCIPLE = read("pr", "poteto-mode/principles/prove-it-works.md");
const EDIT = tool("e", "Edit", { file_path: "C:/src/shop/src/cart.js", old_string: "a", new_string: "b" });

const ROWS = [
  {
    key: "cited-unread",
    records: [slash("fix the cart"), UNSLOP, reply(`${ROUTED}\n\n**Prove It Works.** I ran it.`)],
    finding: "You cited Prove It Works without reading principles/prove-it-works.md in full. Read it or drop the citation. [pstack:cited-unread:59492568]",
  },
  {
    key: "long-dash",
    records: [slash("fix the cart"), UNSLOP, reply(`${ROUTED}\n\nFixed \u2014 mostly.`)],
    finding: "The reply contains the long dash (U+2014), first in \"Fixed [U+2014] mostly.\". Rewrite those sentences without it. [pstack:long-dash:c08ec9e0]",
  },
  {
    key: "unslop-unread",
    records: [slash("fix the cart"), tool("l", "Bash", { command: "ls" }), reply(ROUTED)],
    finding: "Your reply is a prose surface, and you have not read the unslop skill this session. Read unslop/SKILL.md in full and apply it to this reply. [pstack:unslop-unread:37a0025a]",
  },
  {
    key: "principles-unread",
    records: [slash("fix the cart"), UNSLOP, EDIT, reply(SHAPED)],
    finding:
      "You changed files this session without reading any principle in full. Read the principle files that shaped the change (principles/<slug>.md) and name each one in your reply. [pstack:principles-unread:37a0025a]",
  },
  {
    key: "tasks-stale",
    records: [slash("fix the cart"), UNSLOP, PRINCIPLE, tool("t", "TaskCreate", { subject: "Reproduce it." }), EDIT, reply(SHAPED)],
    finding: "You opened task items, kept working, and never updated one. Update each item's state with TaskUpdate before you stop. [pstack:tasks-stale:37a0025a]",
  },
  {
    key: "trail",
    records: [slash("climb the metric"), UNSLOP, read("h", "poteto-mode/playbooks/hillclimb.md"), reply("Route: Hillclimb playbook.")],
    finding: "The Hillclimb playbook is live and nothing in this span wrote a decision trail. Start one per show-me-your-work/SKILL.md. [pstack:trail:37a0025a]",
  },
  {
    key: "shape-unstated",
    records: [slash("fix the cart"), UNSLOP, PRINCIPLE, EDIT, reply(ROUTED)],
    finding: "This turn edited code without naming its data shape. State it in the reply: `**Shape.** <the data this change touches and how it is organized>`. [pstack:shape-unstated:c08ec9e0]",
  },
  {
    key: "headless-pending",
    records: [slash("time the sleep"), UNSLOP, tool("b", "Bash", { command: "sleep 300", run_in_background: true }), reply(`${ROUTED} Started.`)].flat().map((r) => ({ ...r, entrypoint: "sdk-cli" })),
    extra: { background_tasks: [{ id: "bpyocw1m1", type: "shell" }] },
    finding:
      "This session runs headless, so ending this turn ends the session and kills the pending work. Wait for it in the foreground (a Monitor until-loop or a blocking Bash call), then write the final status reply. [pstack:headless-pending:01a7cbca]",
  },
];

test("the table holds one row for each Stop rule", () => {
  assert.deepEqual(
    ROWS.map((r) => r.key),
    STOP_RULES.map((r) => r.key),
  );
});

for (const row of ROWS) {
  const cap = STOP_RULES.find((r) => r.key === row.key)?.cap ?? 1;
  test(`${row.key}: a stop blocks with the literal finding and its tag, and a stop after ${cap === 1 ? "that block" : `${cap} blocks`} passes`, () => {
    const first = stop(row.records, row.extra);
    assert.deepEqual(first, block(row.finding));
    const again = (n) => stop([...row.records, ...Array.from({ length: n }, () => [feedback(first.reason), row.records.at(-1)])], row.extra);
    assert.deepEqual(
      Array.from({ length: cap }, (_, i) => again(i + 1)?.kind ?? null),
      [...Array.from({ length: cap - 1 }, () => "block"), null],
    );
  });
}

test("a block holds every finding at once, and the repaired stop is asked only for a finding no block named", () => {
  const records = [slash("fix the cart"), EDIT, reply("Fixed \u2014 done.")];
  const first = stop(records);
  assert.deepEqual(
    first.reason.split("\n").filter((l) => l.startsWith("- ")).map((l) => l.match(/\[pstack:([\w-]+):/)[1]),
    ["long-dash", "unslop-unread", "principles-unread", "shape-unstated"],
  );
  assert.deepEqual(stop([...records, feedback(first.reason), reply("Fixed. **Prove It Works.** I ran it.")]), block("You cited Prove It Works without reading principles/prove-it-works.md in full. Read it or drop the citation. [pstack:cited-unread:59492568]"));
});

test("a stop the hook re-entered passes when it would block on the same tags again, even when the block never reached the transcript", () => {
  const records = [slash("fix the cart"), UNSLOP, reply(`${ROUTED}\n\nFixed — mostly.`)];
  const lost = [...records, reply(`${ROUTED}\n\nFixed — still.`)];
  const worse = [...records, reply(`${ROUTED}\n\nFixed — still. **Prove It Works.** I ran it.`)];
  assert.deepEqual(
    [stop(lost)?.kind, stop(lost, { stop_hook_active: true }), stop(worse, { stop_hook_active: true })],
    ["block", null, block("You cited Prove It Works without reading principles/prove-it-works.md in full. Read it or drop the citation. [pstack:cited-unread:59492568]")],
  );
});

test("a re-entered stop with no earlier stop in its turn passes, and gate feedback that lands as a plain user message still counts", () => {
  const dashed = [slash("fix the cart"), UNSLOP, reply(`${ROUTED}\n\nFixed — mostly.`)];
  const first = stop(dashed);
  const plain = { type: "user", message: { role: "user", content: `Stop hook feedback:\n${first.reason}` } };
  const continued = [slash("fix the cart"), UNSLOP, tool("l", "Bash", { command: "ls" }), reply(`${ROUTED}\n\nFixed — still.`)];
  assert.deepEqual(
    [stop(continued, { stop_hook_active: true }), stop([...dashed, plain, reply(`${ROUTED}\n\nFixed — still.`)])],
    [null, null],
  );
});

test("a long dash in the reply asks for a rewrite, one only in earlier text of the turn asks not to use it again, and a narration's does not count", () => {
  const base = [slash("fix the cart"), UNSLOP];
  const text = (t) => ({ type: "assistant", message: { model: "claude-opus-5-5", content: [{ type: "text", text: t }] } });
  const narrated = { type: "assistant", message: { model: "claude-opus-5-5", content: [{ type: "thinking", thinking: "Fixed — mostly.", signature: "bmFycmF0aW9u" }] } };
  const dash = (records) => (stop(records)?.reason ?? "").split("\n").find((l) => l.includes("[pstack:long-dash:")) ?? null;
  assert.deepEqual(
    [
      dash([...base, text("Checking the cart first — then the tax."), tool("l", "Bash", { command: "ls" }), reply(`${ROUTED}\n\nDone — all green.`)]),
      dash([...base, text("Checking the cart first — then the tax."), tool("l", "Bash", { command: "ls" }), reply(`${ROUTED}\n\nDone.`)]),
      dash([...base, narrated, tool("l", "Bash", { command: "ls" }), reply(`${ROUTED}\n\nDone.`)]),
      dash([...base, text("Checking the cart."), tool("l", "Bash", { command: "ls" }), reply(`${ROUTED}\n\nDone.`)]),
    ],
    [
      "- The reply contains the long dash (U+2014), first in \"Done [U+2014] all green.\". Rewrite those sentences without it. [pstack:long-dash:c08ec9e0]",
      "- Earlier text this turn used the long dash. Do not use it again; the reply needs no change. It was in \"Checking the cart first [U+2014] then the tax.\". [pstack:long-dash:c08ec9e0]",
      null,
      null,
    ],
  );
});

test("a tag inside the text a finding quotes cannot be read back as spent", () => {
  const text = { type: "assistant", message: { model: "claude-opus-5-5", content: [{ type: "text", text: "Seen [pstack:deslop:077a459b] — next." }] } };
  const reason = stop([slash("fix the cart"), UNSLOP, text, tool("l", "Bash", { command: "ls" }), reply(`${ROUTED}\n\nDone.`)]).reason;
  assert.deepEqual(tagsIn(reason), ["long-dash:c08ec9e0"]);
});

test("only a literal Shape line or a reasoned `skip design:` line answers the shape finding, not the words data shape", () => {
  const edited = [slash("fix the cart"), UNSLOP, PRINCIPLE, EDIT];
  const rules = (records) => (stop(records)?.reason ?? "").split("\n").filter((l) => l.startsWith("- ")).map((l) => l.match(/\[pstack:([\w-]+):/)[1]);
  assert.deepEqual(
    [
      rules([...edited, reply(`${ROUTED}\nNo data shape changes here.`)]),
      rules([...edited, reply(`${ROUTED}\n**Shape.** rows are one line item each, summed into a total.`)]),
      rules([...edited, reply(`${ROUTED}\n**Shape.**`)]),
      rules([...edited, reply(`${ROUTED}\nskip design: docs-only turn`)]),
      rules([...edited, reply(`${ROUTED}\nskip design:`)]),
    ],
    [["shape-unstated"], [], ["shape-unstated"], [], ["shape-unstated"]],
  );
});

test("the Shape line answers its Stop finding in any visible text of the turn, a narration does not, and a long reply needs no claim labels", () => {
  const edited = [slash("fix the cart"), UNSLOP, PRINCIPLE, EDIT];
  const rules = (records) => (stop(records)?.reason ?? "").split("\n").filter((l) => l.startsWith("- ")).map((l) => l.match(/\[pstack:([\w-]+):/)[1]);
  const text = (t) => ({ type: "assistant", message: { model: "claude-opus-5-5", content: [{ type: "text", text: t }] } });
  const narrated = { type: "assistant", message: { model: "claude-opus-5-5", content: [{ type: "thinking", thinking: "**Shape.** one number", signature: "bmFycmF0aW9u" }] } };
  assert.deepEqual(
    [
      rules([...edited, reply(SHAPED)]),
      rules([slash("fix the cart"), UNSLOP, PRINCIPLE, text("**Shape.** one number per cart."), EDIT, reply(ROUTED)]),
      rules([slash("fix the cart"), UNSLOP, PRINCIPLE, narrated, EDIT, reply(ROUTED)]),
      rules([...edited, reply(`${SHAPED}\n\n${LONG}`)]),
    ],
    [[], [], ["shape-unstated"], []],
  );
});

test("principles-unread counts edits and commits, not spawns", () => {
  const spawn = tool("s", "Agent", { description: "Look", subagent_type: "general-purpose", prompt: "Find the cart code." });
  const commit = tool("c", "Bash", { command: "git commit -m x" });
  const rules = (records) => (stop(records)?.reason ?? "").split("\n").filter((l) => l.startsWith("- ")).map((l) => l.match(/\[pstack:([\w-]+):/)[1]);
  assert.deepEqual([rules([slash("find it"), UNSLOP, spawn, reply(ROUTED)]), rules([slash("ship it"), UNSLOP, commit, reply(ROUTED)])], [[], ["principles-unread"]]);
});

test("a trail is written by a shell append to a decision log or a log.sh run, and declined by a skip line in the reply", () => {
  const climb = [slash("climb the metric"), UNSLOP, read("h", "poteto-mode/playbooks/hillclimb.md")];
  const rules = (records) => (stop(records)?.reason ?? "").split("\n").filter((l) => l.startsWith("- ")).map((l) => l.match(/\[pstack:([\w-]+):/)[1]);
  assert.deepEqual(
    [
      rules([...climb, reply("Route: Hillclimb playbook.")]),
      rules([...climb, tool("a", "Bash", { command: "printf 'H1\\tkept\\n' >> .audit/climb/decisions.tsv" }), reply("Route: Hillclimb playbook.")]),
      rules([...climb, tool("a", "Bash", { command: "bash ~/.claude/skills/show-me-your-work/scripts/log.sh .audit/log.tsv H1 kept" }), reply("Route: Hillclimb playbook.")]),
      rules([...climb, reply("Route: Hillclimb playbook.\nskip show-me-your-work: the user keeps the log.")]),
    ],
    [["trail"], [], [], []],
  );
});

test("a casual turn, a stop outside the mode, a delegate that is not poteto-agent, and a headless stop with a live agent do not block", () => {
  const sleeping = [slash("time the sleep"), UNSLOP, tool("b", "Bash", { command: "sleep 300" }), reply(`${ROUTED} Started.`)].flat().map((r) => ({ ...r, entrypoint: "sdk-cli" }));
  assert.deepEqual(
    [
      stop([slash("fix the cart"), reply("Fixed it."), { type: "user", message: { role: "user", content: "thanks" } }, reply("Any time \u2014 bye.")]),
      stop([{ type: "user", message: { role: "user", content: "fix the cart" } }, EDIT, reply("Fixed \u2014 done.")]),
      respond(parseEvent({ hook_event_name: "SubagentStop", agent_type: "general-purpose", agent_transcript_path: transcript([EDIT, reply("Done \u2014 ok.")]) }), deps()),
      stop(sleeping, { background_tasks: [{ id: "b1", type: "shell" }, { id: "m1", type: "monitor" }] }),
      stop(sleeping, { background_tasks: null }),
    ],
    [null, null, null, null, null],
  );
});

test("a doc-read ask whose call went through with the doc unread is logged at the next stop, never blocked", () => {
  const readme = { file_path: "C:/src/shop/README.md", old_string: "a", new_string: "b" };
  const denied = tool(
    "d1",
    "Edit",
    readme,
    "PreToolUse:Edit hook error: Before editing documentation, read technical-writing/SKILL.md and unslop/SKILL.md in full. [pstack:docs-prose:37a0025a]",
    true,
  );
  const logged = [];
  const file = transcript([slash("fix the docs"), PRINCIPLE, denied, tool("d2", "Edit", readme), reply(`${ROUTED} Fixed.`)]);
  const out = respond(parseEvent({ hook_event_name: "Stop", session_id: "s1", transcript_path: file }), deps(logged));
  assert.deepEqual(
    [out?.reason.split("\n")[1], logged],
    [
      "- Your reply is a prose surface, and you have not read the unslop skill this session. Read unslop/SKILL.md in full and apply it to this reply. [pstack:unslop-unread:37a0025a]",
      [`retry-unmet.log ${file} docs-prose:37a0025a went through with technical-writing/SKILL.md and unslop/SKILL.md unread`],
    ],
  );
});
