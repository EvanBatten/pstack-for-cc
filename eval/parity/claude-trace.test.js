import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { readClaudeTrace } from "./claude-trace.mjs";
import { MUTATIONS } from "./mutate.mjs";
import { render } from "./packet.mjs";

const slash = (p) => p.replaceAll("\\", "/");
const home = slash(mkdtempSync(join(tmpdir(), "parity-ct-")));
const plugin = `${home}/.claude/plugins/cache/pstack-claude/pstack/0.9.45/skills`;
const port = `${home}/.claude/skills`;
for (const skill of ["principle-model-the-domain", "how"]) {
  mkdirSync(`${plugin}/${skill}`, { recursive: true });
  writeFileSync(`${plugin}/${skill}/SKILL.md`, "---\n---\n");
}
const rootsWith = (skills) => ({ workspace: `${home}/ws`, skills, home, sandbox: `${home}/sb` });
const lines = (trace, skills) => render(trace, rootsWith(skills)).text.split("\n");

const command = (name, args) => ({
  type: "user",
  message: { role: "user", content: `<command-message>${name}</command-message>\n<command-name>/${name}</command-name>\n<command-args>${args}</command-args>` },
});
const call = (id, name, input) => ({ type: "assistant", message: { id: `m-${id}`, model: "claude-opus-5-5", content: [{ type: "tool_use", id, name, input }] } });
const ok = (id, is_error = false) => ({ type: "user", message: { role: "user", content: [{ type: "tool_result", tool_use_id: id, content: "ok", is_error }] } });
const say = (text) => ({ type: "assistant", message: { id: "m-say", model: "claude-opus-5-5", stop_reason: "end_turn", content: [{ type: "text", text }] } });

const bash = (id, cmd) => ({ ...call(id, "Bash", { command: cmd }), cwd: `${home}/ws` });

/** Writes a one-turn session: each step is a Read path, `skill:<Skill tool input>`, or `bash:`/`bash!:` (a failing call) and a command. */
function session(name, steps, reply = "Model the Domain kept the fix in one place.") {
  const lines = [command("pstack:poteto-mode", "fix the discount bug")];
  steps.forEach((s, i) => {
    const id = `c${i}`;
    const shell = s.match(/^bash(!?):([\s\S]*)$/);
    if (shell) lines.push(bash(id, shell[2]), ok(id, shell[1] === "!"));
    else lines.push(s.startsWith("skill:") ? call(id, "Skill", { skill: s.slice(6) }) : call(id, "Read", { file_path: s }), ok(id));
  });
  lines.push(say(reply));
  const path = join(home, `${name}.jsonl`);
  writeFileSync(path, `${lines.map((l) => JSON.stringify(l)).join("\n")}\n`);
  return readClaudeTrace(path);
}

const pluginSteps = [
  "skill:pstack:principle-model-the-domain",
  `${plugin}/poteto-mode/playbooks/bug-fix.md`,
  `${plugin}/principle-prove-it-works/SKILL.md`,
  "skill:pstack:how",
];

test("a session in the plugin's layout names the command without its namespace and each document it opened", () => {
  const trace = session("plugin", pluginSteps);
  assert.equal(trace.turns[0].prompt, "/poteto-mode fix the discount bug");
  assert.deepEqual(trace.turns[0].command, { name: "poteto-mode", args: "fix the discount bug" });
  assert.deepEqual(
    trace.turns[0].actions.filter((a) => a.kind !== "say").map((a) => a.doc),
    ["principle:model-the-domain", "playbook:bug-fix", "principle:prove-it-works", "skill:how"],
  );
});

test("the packet names what each plugin Skill load opened, in the path a port read of it shows", () => {
  assert.deepEqual(lines(session("plugin", pluginSteps), [plugin]), [
    "=== turn t0 ===",
    "e1 [main] USER: /poteto-mode fix the discount bug",
    "e2 [main] invoke skill principle-model-the-domain, which loads <pstack>/poteto-mode/principles/model-the-domain.md in full",
    "e3 [main] read <pstack>/poteto-mode/playbooks/bug-fix.md (full)",
    "e4 [main] read <pstack>/poteto-mode/principles/prove-it-works.md (full)",
    "e5 [main] invoke skill how, which loads <pstack>/how/SKILL.md in full",
    "e6 [main] REPLY TO USER:",
    "Model the Domain kept the fix in one place.",
  ]);
  const ported = session("port", [`${port}/poteto-mode/playbooks/bug-fix.md`, `${port}/poteto-mode/principles/prove-it-works.md`]);
  assert.deepEqual(lines(ported, [port]).slice(2, 4), [
    "e2 [main] read <pstack>/poteto-mode/playbooks/bug-fix.md (full)",
    "e3 [main] read <pstack>/poteto-mode/principles/prove-it-works.md (full)",
  ]);
});

test("a Skill load that resolves under no pstack root stays a bare invocation", () => {
  assert.deepEqual(lines(session("builtin", ["skill:simplify", "skill:pstack:how"]), [port]).slice(2, 4), [
    "e2 [main] invoke skill simplify",
    "e3 [main] invoke skill how",
  ]);
});

test("drop-principle-read removes a principle the plugin loaded through the Skill tool", () => {
  const task = { id: "t", seed: "cart", expect: { delegates: false, readonlyDelegates: false }, turns: [{ index: 0, prompt: "/poteto-mode fix the discount bug", expect: { mode: "on", playbook: "bug-fix", triggers: [] } }] };
  const m = MUTATIONS.find((x) => x.id === "drop-principle-read").apply(session("plugin", pluginSteps), task, { "model-the-domain": "Model the Domain" });
  assert.deepEqual(m.target, { behavior: "B7-cite-read", unit: "t0" });
  assert.deepEqual(
    m.trace.turns[0].actions.filter((a) => a.kind !== "say").map((a) => a.doc),
    ["playbook:bug-fix", "principle:prove-it-works", "skill:how"],
  );
});

test("a pstack document a shell command printed reads in the packet as a Read-tool read of it does", () => {
  const cd = `bash:cd ${plugin} && cat principle-prove-it-works/SKILL.md poteto-mode/playbooks/bug-fix.md; cat package.json | head -5`;
  const trace = session("shell", [cd, `bash!:cat ${port}/poteto-mode/principles/laziness-protocol.md; npm test`]);
  assert.deepEqual(lines(trace, [plugin, port]).slice(2, 7), [
    "e2 [main] run: cd <pstack> && cat principle-prove-it-works/SKILL.md poteto-mode/playbooks/bug-fix.md; cat package.json | head -5",
    "e3 [main] read <pstack>/poteto-mode/principles/prove-it-works.md (full)",
    "e4 [main] read <pstack>/poteto-mode/playbooks/bug-fix.md (full)",
    "e5 [main] run: cat <pstack>/poteto-mode/principles/laziness-protocol.md; npm test",
    "e6 [main] read <pstack>/poteto-mode/principles/laziness-protocol.md (full, failed)",
  ]);
});

test("drop-principle-read removes a principle the worker printed through the shell", () => {
  const task = { id: "t", seed: "cart", expect: { delegates: false, readonlyDelegates: false }, turns: [{ index: 0, prompt: "/poteto-mode fix the discount bug", expect: { mode: "on", playbook: "bug-fix", triggers: [] } }] };
  const trace = session("shell-mutate", [`bash:cat ${plugin}/principle-model-the-domain/SKILL.md ${plugin}/poteto-mode/playbooks/bug-fix.md`]);
  const m = MUTATIONS.find((x) => x.id === "drop-principle-read").apply(trace, task, { "model-the-domain": "Model the Domain" });
  assert.deepEqual(m.target, { behavior: "B7-cite-read", unit: "t0" });
  assert.deepEqual(
    m.trace.turns[0].actions.filter((a) => a.kind !== "say").map((a) => a.doc ?? a.kind),
    ["playbook:bug-fix"],
  );
});
