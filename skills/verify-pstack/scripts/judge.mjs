#!/usr/bin/env node
// Usage: node judge.mjs <evidence dir>
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { DATA_SHAPE, spanOf, triggersOf } from "../../poteto-mode/hooks/asks.mjs";
import { docsIn, loadCatalog, playbookRead } from "../../poteto-mode/hooks/catalog.mjs";
import { gate, stopView } from "../../poteto-mode/hooks/gate.mjs";
import { readClaudeTrace, tagsIn, toAction } from "../../poteto-mode/hooks/trace.mjs";

const SKIP_WORD = /\bskip(s|ped|ping)?\b/i;
const skipNamesSkill = (line, skill) => SKIP_WORD.test(line) && new RegExp(`(?<![\\w-])${skill.replace(/[-]/g, "\\-")}(?![\\w-])`, "i").test(line);
// A step line's first state word is its state, so "Done. skip `why`: ..." is done and "skip: already done" is not.
const marksDone = (line) => {
  const done = line.search(/\b(done|completed?|finished)\b|\[x\]|✓|✅/i);
  const skip = line.search(SKIP_WORD);
  return done >= 0 && (skip < 0 || done < skip) && !/\bn\/a\b/i.test(line);
};

const ev = process.argv[2];
const catalog = loadCatalog(join(import.meta.dirname, "..", ".."));
const records = (file) =>
  existsSync(file)
    ? readFileSync(file, "utf8")
        .split("\n")
        .map((raw, i) => {
          try {
            return { line: i + 1, raw, j: JSON.parse(raw) };
          } catch {
            return null;
          }
        })
        .filter(Boolean)
    : [];
const at = (name, r) => `${name}:${r.line}`;
const contentText = (c) => (typeof c === "string" ? c : Array.isArray(c) ? c.map((x) => (typeof x === "string" ? x : (x.text ?? contentText(x.content)))).join("\n") : "");
const attachments = (recs, heading) => recs.filter((r) => r.j.type === "attachment" && contentText(r.j.attachment?.content).includes(heading));
const toolUses = (recs, name) =>
  recs.flatMap((r) => (r.j.type === "assistant" && Array.isArray(r.j.message?.content) ? r.j.message.content.filter((c) => c.type === "tool_use" && c.name === name).map((c) => ({ ...r, use: c })) : []));
const toolResults = (recs) =>
  recs.flatMap((r) => (r.j.type === "user" && Array.isArray(r.j.message?.content) ? r.j.message.content.filter((c) => c.type === "tool_result").map((c) => ({ ...r, text: contentText(c.content) })) : []));

const mode = records(join(ev, "mode.jsonl"));
const control = records(join(ev, "control.jsonl"));
const reader = records(join(ev, "reader.jsonl"));
const stream = records(join(ev, "mode.stream.jsonl"));
const finalReply = String(stream.findLast((r) => r.j.type === "result")?.j.result ?? "");

const READS = {
  "hook-context": ["mode", "control"],
  "mode-reminder": ["mode", "control"],
  "step-ledger": ["mode"],
  gate: ["mode"],
  "action-gate": ["mode"],
  reader: ["reader"],
  "task-tools": ["mode"],
};
const timedOut = new Map(
  ["mode", "control", "reader"].flatMap((role) => {
    const file = join(ev, `${role}.timeout`);
    return existsSync(file) ? [[role, readFileSync(file, "utf8").trim()]] : [];
  }),
);

const verdicts = [];
const verdict = (state, feature, evidence) => {
  const late = READS[feature].find((role) => timedOut.has(role));
  if (late) [state, evidence] = ["INCONCLUSIVE", `${late} session timed out after ${timedOut.get(late)} s`];
  verdicts.push(`${state.padEnd(13)} ${feature.padEnd(14)} ${evidence}`);
};

{
  const full = (recs) => attachments(recs, "# pstack session context").find((r) => contentText(r.j.attachment.content).includes("Orchestrate store root"));
  const m = full(mode);
  const c = full(control);
  if (!mode.length || !control.length) verdict("INCONCLUSIVE", "hook-context", "a transcript is missing");
  else if (m && c) verdict("VERIFIED", "hook-context", `${at("mode.jsonl", m)}, ${at("control.jsonl", c)}`);
  else verdict("NOT VERIFIED", "hook-context", `no session context attachment in ${m ? "control.jsonl" : "mode.jsonl"}`);
}

{
  const command = mode.find((r) => r.j.type === "user" && contentText(r.j.message?.content).includes("<command-name>/poteto-mode</command-name>"));
  const firstReply = mode.find((r) => r.j.type === "assistant")?.line ?? Infinity;
  const onEntry = attachments(mode, "# pstack reminders").find((r) => r.line < firstReply);
  const inControl = attachments(control, "# pstack reminders");
  if (!command) verdict("INCONCLUSIVE", "mode-reminder", "mode.jsonl has no /poteto-mode command record, so the slash command never reached the session");
  else if (onEntry && !inControl.length) verdict("VERIFIED", "mode-reminder", `${at("mode.jsonl", onEntry)} before the first reply at line ${firstReply}, command at ${at("mode.jsonl", command)}, control.jsonl has none`);
  else verdict("NOT VERIFIED", "mode-reminder", onEntry ? `control.jsonl carries it at ${inControl.map((r) => r.line).join(", ")}` : `no reminder in mode.jsonl before line ${firstReply}`);
}

const actionOf = (r) => toAction(r.use);
const firstRead = [...toolUses(mode, "Read"), ...toolUses(mode, "Bash")]
  .flatMap((r) => playbookRead(actionOf(r), catalog).map((name) => ({ ...r, name })))
  .sort((a, b) => a.line - b.line)[0];
const ledger = firstRead && attachments(mode, "# pstack step ledger").find((r) => r.line > firstRead.line);
const playbookName = firstRead?.name;
{
  const where = firstRead && `${playbookName} read by ${firstRead.use.name} at ${at("mode.jsonl", firstRead)}`;
  if (!firstRead) verdict("INCONCLUSIVE", "step-ledger", "the mode session never read a playbook file");
  else if (ledger) verdict("VERIFIED", "step-ledger", `${where}, ledger at ${at("mode.jsonl", ledger)}`);
  else verdict("NOT VERIFIED", "step-ledger", `${where} and no ledger attachment after it`);
}

{
  const norm = (s) => ` ${s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim()} `;
  const STATE = /\b(done|complete[d]?|finished|in[ _]progress|pending|skip(ped)?|n\/a|blocked|not started|todo)\b|\[[x ]\]|✓|✅/i;
  const SKIP = /\bskip(s|ped|ping)?\b/i;
  const LONG_DASH = String.fromCharCode(0x2014);
  const playbookFile = playbookName && join(homedir(), ".claude", "skills", "poteto-mode", "playbooks", `${playbookName}.md`);
  const source = ledger ? contentText(ledger.j.attachment.content) : playbookFile && existsSync(playbookFile) ? readFileSync(playbookFile, "utf8") : "";
  const steps = source
    ? source
        .split(/\r?\n/)
        .flatMap((l) => {
          const m = l.match(/^(\d+)\.\s+(.+)$/);
          if (!m) return [];
          const first = norm(m[2].split(/(?<=\.)\s+/)[0]);
          return [{ n: Number(m[1]), head: first.split(" ").filter(Boolean).slice(0, 6).join(" "), words: first.split(" ").filter((w) => w.length >= 4) }];
        })
    : [];
  const tasks = toolUses(mode, "TaskCreate").map((r) => `${r.use.input?.subject ?? ""} ${r.use.input?.description ?? ""}`);
  const numbered = (l, n) => new RegExp(`^[\\s>*_#-]*(\\[.\\]\\s*)?(\\*\\*)?(step\\s*)?${n}[.):]`, "i").test(l);
  const mentions = (l, s) => norm(l).includes(` ${s.head} `) || (numbered(l, s.n) && s.words.some((w) => norm(l).includes(` ${w} `)));

  // The Stop hook blocks a turn without ending it: the model keeps replying
  // in the same turn until the gate passes.
  const enteringPrompt = mode.find((r) => r.j.type === "user" && !r.j.isMeta);
  const repliesFrom = (afterLine) =>
    mode
      .filter((r) => r.j.type === "assistant" && r.line > afterLine)
      .map((r) => ({ line: r.line, text: contentText(r.j.message?.content) }))
      .filter((r) => r.text.trim());
  const replies = repliesFrom(enteringPrompt ? enteringPrompt.line : 0);
  const lastMention = (s) => {
    let line = null;
    for (const r of replies) for (const l of r.text.split(/\r?\n/)) if (mentions(l, s)) line = l;
    return line;
  };
  const carried = (s) => {
    const line = lastMention(s);
    return (line != null && STATE.test(line)) || tasks.some((t) => norm(t).includes(` ${s.head} `) || s.words.filter((w) => norm(t).includes(` ${w} `)).length * 2 >= s.words.length);
  };
  const missing = steps.filter((s) => !carried(s)).map((s) => s.n);
  const dash = replies.length ? replies.at(-1).text.includes(LONG_DASH) : finalReply.includes(LONG_DASH);

  // The hook's feedback lands once as a meta user message, then again as an
  // attachment and a third time as a system summary - one Stop block, keyed
  // on the user record so it counts once.
  const blocks = mode.filter((r) => r.j.type === "user" && r.j.isMeta && contentText(r.j.message?.content).startsWith("Stop hook feedback:"));
  const findingsOf = (b) => contentText(b.j.message?.content).split(/\r?\n/).filter((l) => l.startsWith("- "));
  // A task item's description speaks for its step, so each of its lines is read as though it followed the item's subject.
  const subjects = new Map(mode.flatMap((r) => (r.j.toolUseResult?.task?.id != null ? [[String(r.j.toolUseResult.task.id), r.j.toolUseResult.task.subject ?? ""]] : [])));
  const updatesFrom = (afterLine) =>
    toolUses(mode, "TaskUpdate")
      .filter((r) => r.line > afterLine && typeof r.use.input?.description === "string")
      .flatMap((r) => r.use.input.description.split(/\r?\n/).map((l) => `${subjects.get(String(r.use.input.taskId)) ?? ""} ${l}`));
  const fixed = (b) => {
    const later = repliesFrom(b.line);
    const laterLines = [...later.flatMap((r) => r.text.split(/\r?\n/)), ...updatesFrom(b.line)];
    const reads = [...toolUses(mode, "Read"), ...toolUses(mode, "Bash")]
      .filter((r) => r.line > b.line)
      .flatMap((r) => docsIn(actionOf(r), catalog))
      .map((d) => d.doc);
    return findingsOf(b).every((f) => {
      const checks = [];
      const stepN = Number(f.match(/\bStep (\d+)\b/)?.[1]) || null;
      const ref = f.match(/\b([\w-]+)\/SKILL\.md\b|\bprinciples\/([\w-]+)\.md\b/i);
      if (ref || stepN) {
        const skill = ref?.[1];
        const fileRead = ref && reads.includes(skill ? `skill:${skill}` : `principle:${ref[2]}`);
        const lines = stepN ? laterLines.filter((l) => numbered(l, stepN)) : laterLines;
        const stepDeclined = stepN && lines.some((l) => SKIP.test(l)) && !lines.some(marksDone);
        const skillSkipped = skill && lines.some((l) => skipNamesSkill(l, skill));
        checks.push(Boolean(fileRead || stepDeclined || skillSkipped));
      }
      if (/name the data shape/i.test(f)) checks.push(laterLines.some((l) => DATA_SHAPE.test(l)));
      if (/long dash/i.test(f)) checks.push(laterLines.length > 0 && !laterLines.some((l) => l.includes(LONG_DASH)));
      if (/name your route/i.test(f)) checks.push(laterLines.some((l) => /\b(route[sd]?|routing)\b|\b[A-Z][\w-]*(?: [\w-]+){0,4} playbook\b/.test(l)));
      if (/name figure-it-out/i.test(f)) checks.push(laterLines.some((l) => /figure-it-out/i.test(l)));
      return checks.length > 0 && checks.every(Boolean);
    });
  };
  // The gate names each finding once, so the stop after a block passes with the finding still there. The turn's last
  // stop is graded again by the gate's own rules with no tag counted, and the block is fixed when they no longer find
  // a tag it named. A block from before the tags carries none, so it is left to the checks above.
  const modeFile = join(ev, "mode.jsonl");
  const trace = existsSync(modeFile) ? readClaudeTrace(modeFile, { spawns: () => new Set() }) : null;
  const gateClears = (b) => {
    const named = tagsIn(contentText(b.j.message?.content));
    const turn = trace?.turns.find((t) => t.asked.some((a) => named.includes(a.id)));
    if (!named.length || !turn || turn.stops.length < 2) return false;
    const last = { ...trace, turns: [...trace.turns.slice(0, turn.index), turn] };
    const span = { ...spanOf(last, null, new Set(), catalog), asked: new Map() };
    const found = gate(span, stopView(last), catalog, null).map((f) => f.id);
    return !named.some((id) => found.includes(id));
  };
  const unresolved = blocks.filter((b) => !fixed(b) && !gateClears(b));

  if (!steps.length) verdict("INCONCLUSIVE", "gate", "no playbook read, so no steps to hold the reply to");
  else if (!finalReply) verdict("INCONCLUSIVE", "gate", "the mode session returned no final reply, see mode.stream.jsonl");
  else if (!missing.length && !dash && !unresolved.length)
    verdict(
      "VERIFIED",
      "gate",
      `${steps.length} ${ledger ? "ledger" : `${playbookName}.md`} steps carried across ${replies.length} repl${replies.length === 1 ? "y" : "ies"}${tasks.length ? " and TaskCreate items" : ""}; ${blocks.length ? `Stop block${blocks.length > 1 ? "s" : ""} at ${blocks.map((r) => at("mode.jsonl", r)).join(", ")}, each fixed by a later reply` : "no Stop block was needed"}`,
    );
  else
    verdict(
      "NOT VERIFIED",
      "gate",
      [
        missing.length && `the turn lacks steps ${missing.join(", ")}`,
        dash && "the last reply carries the long dash",
        unresolved.length && `Stop block${unresolved.length > 1 ? "s" : ""} at ${unresolved.map((r) => at("mode.jsonl", r)).join(", ")} unresolved`,
      ]
        .filter(Boolean)
        .join("; "),
    );
}

{
  const shapeText = (r) => r.j.type === "assistant" && (r.j.message?.content ?? []).some((c) => c.type === "text" && DATA_SHAPE.test(c.text));
  const results = (recs, errored) =>
    recs.flatMap((r) =>
      r.j.type === "user" && Array.isArray(r.j.message?.content)
        ? r.j.message.content.filter((c) => c.type === "tool_result" && Boolean(c.is_error) === errored).map((c) => ({ ...r, id: c.tool_use_id, text: contentText(c.content) }))
        : [],
    );
  const sourceWrites = (recs) => {
    const ok = new Set(results(recs, false).map((r) => r.id));
    return recs.filter(
      (r) =>
        r.j.type === "assistant" &&
        (r.j.message?.content ?? [])
          .filter((c) => c.type === "tool_use" && ok.has(c.id))
          .map((c) => actionOf({ use: c, j: r.j }))
          // A source write is whatever the hook counts as a code edit, a shell `sed -i` or redirect included.
          .some((a) => triggersOf(a).some((t) => t.kind === "code-edit")),
    );
  };
  const deny = results(mode, true).find((r) => r.text.includes("[pstack:design:"));
  const shape = deny && mode.find((r) => r.line > deny.line && shapeText(r));
  const subDir = join(ev, "mode-subagents");
  const delegated = existsSync(subDir) ? readdirSync(subDir).filter((f) => f.endsWith(".jsonl")).flatMap((f) => sourceWrites(records(join(subDir, f))).map((r) => ({ f, r }))) : [];
  const writes = sourceWrites(mode);
  const write = shape && writes.find((r) => r.line > shape.line);
  const where = write ? at("mode.jsonl", write) : delegated[0] ? `mode-subagents/${delegated[0].f}:${delegated[0].r.line}` : null;
  if (!deny && !writes.length) verdict("INCONCLUSIVE", "action-gate", "the mode session never wrote a source file, so nothing was put to the design ask");
  else if (!deny && mode.some((r) => r.line < writes[0].line && shapeText(r)))
    verdict("INCONCLUSIVE", "action-gate", `the shape was named before the first source write at ${at("mode.jsonl", writes[0])}, so the design ask had nothing to deny`);
  else if (!deny) verdict("NOT VERIFIED", "action-gate", `source write at ${at("mode.jsonl", writes[0])} with no design deny before it`);
  else if (shape && where) verdict("VERIFIED", "action-gate", `design deny at ${at("mode.jsonl", deny)}, shape line at ${at("mode.jsonl", shape)}, source write at ${where}`);
  else verdict("NOT VERIFIED", "action-gate", `design deny at ${at("mode.jsonl", deny)} with no ${shape ? "source write after the shape line" : "shape line after it"}`);
}

{
  const target = readFileSync(join(ev, "reader-target.txt"), "utf8").trim();
  const spawn = toolUses(reader, "Agent").find((r) => r.use.input?.subagent_type === "pstack-reader");
  const subDir = join(ev, "reader-subagents");
  const subs = existsSync(subDir) ? readdirSync(subDir).filter((f) => f.endsWith(".jsonl")) : [];
  const tried = subs.flatMap((f) => toolUses(records(join(subDir, f)), "Bash").map((r) => ({ f, r })));
  const denied = subs.flatMap((f) => toolResults(records(join(subDir, f))).filter((r) => r.text.includes("pstack-reader is read-only")).map((r) => ({ f, r })));
  if (existsSync(target)) verdict("NOT VERIFIED", "reader", `${target} exists, so the reader's write went through`);
  else if (!spawn) verdict("INCONCLUSIVE", "reader", "reader.jsonl has no Agent call with subagent_type pstack-reader");
  else if (denied.length) verdict("VERIFIED", "reader", `deny at reader-subagents/${denied[0].f}:${denied[0].r.line}, spawn at ${at("reader.jsonl", spawn)}, ${target} absent`);
  else if (!tried.length) verdict("INCONCLUSIVE", "reader", "the reader never ran a Bash command, so nothing was put to the hook");
  else verdict("NOT VERIFIED", "reader", `Bash at reader-subagents/${tried[0].f}:${tried[0].r.line} got no pstack-reader deny`);
}

{
  const init = stream.find((r) => r.j.type === "system" && r.j.subtype === "init");
  if (!init) verdict("INCONCLUSIVE", "task-tools", "mode.stream.jsonl has no init record");
  else if (init.j.tools?.includes("TaskCreate")) verdict("VERIFIED", "task-tools", `${at("mode.stream.jsonl", init)} lists TaskCreate${toolUses(mode, "TaskCreate").length ? ", and the session used it" : ""}`);
  else verdict("NOT VERIFIED", "task-tools", `${at("mode.stream.jsonl", init)} lists no TaskCreate`);
}

process.stdout.write(verdicts.join("\n") + "\n");
