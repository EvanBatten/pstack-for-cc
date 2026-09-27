#!/usr/bin/env node
import { readdirSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { check, spanOf } from "../skills/poteto-mode/hooks/asks.mjs";
import { citedPrinciples, docsIn, family, loadCatalog, modelsFile, modelTable, norm } from "../skills/poteto-mode/hooks/catalog.mjs";
import { gate, stopView } from "../skills/poteto-mode/hooks/gate.mjs";
import { actorsOf, modeOf, readClaudeTrace, spawnOf } from "../skills/poteto-mode/hooks/trace.mjs";

const USAGE = `usage: audit-transcripts.mjs [--skills DIR] [--json] [--gate-replay] [--since DATE] [PATH...]

PATH is a session transcript, whose subagents come with it, or a project
directory, meaning every session in it. --since adds every session under
~/.claude/projects modified on or after DATE (UTC midnight). --skills is the
skills tree to grade against, this repo's skills/ by default. --gate-replay
runs the Stop and SubagentStop gate at every reply in poteto mode instead, and
the PreToolUse check at every in-mode spawn, and --json then lists each stop
or spawn it would block with the tag of each finding. A finding or ask the
replay already raised in a mode span does not block again, as in a live
session. The replay grades delegate models against the table the hook
injects: $PSTACK_MODELS_FILE, then ~/.claude/pstack-models.md, then the
skills tree's own.`;

function sessionsUnder(path) {
  if (statSync(path).isFile()) return [path];
  return readdirSync(path)
    .filter((f) => f.endsWith(".jsonl"))
    .sort()
    .map((f) => join(path, f));
}

function sessionsSince(date) {
  const since = Date.parse(date);
  if (Number.isNaN(since)) throw new Error(`--since ${date} is not a date`);
  const root = join(homedir(), ".claude", "projects");
  const all = [];
  for (const d of readdirSync(root)) {
    const dir = join(root, d);
    if (!statSync(dir).isDirectory()) continue;
    for (const f of readdirSync(dir)) if (f.endsWith(".jsonl") && statSync(join(dir, f)).mtimeMs >= since) all.push(join(dir, f));
  }
  return all.sort();
}

const escape = (s) => s.replace(/[.*+?^${}()|[\]\\-]/g, "\\$&");
const SKIP_WORD = /\bskip(s|ped|ping)?\b/i;
const TRIGGER_STATES = ["fired", "delegated", "skipped-with-reason", "conditional-not-run", "silent"];

/** What one actor shows: context and reminders it got, docs it read, skill calls, replies, and the models it ran on. */
function observe(actor, catalog) {
  const actions = actor.turns.flatMap((t) => t.actions);
  const o = { context: 0, reminders: 0, editsSkills: false, reads: new Set(), skillCalls: [], models: {} };
  for (const a of actions.slice(actions.findLastIndex((a) => a.kind === "compact") + 1)) if (a.ok) for (const r of docsIn(a, catalog)) o.reads.add(r.doc);
  for (const t of actor.turns) {
    for (const c of t.injected) {
      if (c.includes("# pstack session context")) o.context++;
      if (c.includes("# pstack reminders")) o.reminders++;
    }
    for (const m of t.models) o.models[m] = (o.models[m] ?? 0) + 1;
    for (const a of t.actions) {
      if (a.kind === "write" && [...a.path.matchAll(/skills[\\/]([\w-]+)[\\/][^\s"']*\.md\b/g)].some((m) => catalog.skills.includes(m[1]))) o.editsSkills = true;
      if (a.kind === "skill" && a.source === "tool") o.skillCalls.push({ skill: a.name, refused: a.ok === null ? null : !a.ok, ...(a.error === null ? {} : { error: a.error }) });
    }
  }
  o.texts = actor.turns.flatMap((t) => t.texts.map((x) => x.text));
  const replies = actor.turns.flatMap((t) => t.stops.map((s) => s.reply));
  o.replies = replies.length;
  o.repliesCitingPrinciple = replies.filter((r) => citedPrinciples(r, catalog).length).length;
  // Unlike `modeOf`, this also counts a read of poteto-mode's SKILL.md and ignores `/poteto-mode off`. Past audit reports were counted this way.
  o.enteredForAudit = actor.turns.some((t) => t.command?.name === "poteto-mode") || o.reads.has("skill:poteto-mode");
  return o;
}

function playbookRun(name, catalog, all) {
  const { title, steps } = catalog.playbooks[name];
  const t = norm(title);
  return new RegExp(`\\bplaybook( \\w+){0,2} ${escape(t)}\\b|\\b${escape(t)} playbook\\b`).test(all) || (t.includes(" ") && all.includes(t)) || steps.some((s) => all.includes(s.head));
}

function grade(o, catalog, delegatedRead) {
  const all = norm(o.texts.join("\n"));
  const skipLines = o.texts
    .join("\n")
    .split(/\r?\n/)
    .filter((l) => SKIP_WORD.test(l))
    .map((l) => ({ raw: l, n: ` ${norm(l)} ` }));
  const namesSkill = (raw, skill) => new RegExp(`(\`|\\*\\*|/)${escape(skill)}\\b(?!-)|\\b${escape(skill)} skill\\b`, "i").test(raw);
  const skippedBy = (skill, heads) => skipLines.some((l) => namesSkill(l.raw, skill) || heads.some((h) => h && l.n.includes(` ${h} `)));
  const triggerState = (skill, heads, conditional) =>
    o.reads.has(`skill:${skill}`) ? "fired" : delegatedRead(skill) ? "delegated" : skippedBy(skill, heads) ? "skipped-with-reason" : conditional ? "conditional-not-run" : "silent";
  const anyState = (skills, heads, conditional) => skills.map((skill) => triggerState(skill, heads, conditional)).sort((a, b) => TRIGGER_STATES.indexOf(a) - TRIGGER_STATES.indexOf(b))[0];

  const playbooks = {};
  const triggers = [];
  for (const doc of o.reads) {
    const [kind, name] = doc.split(":");
    if (kind === "playbook" && playbookRun(name, catalog, all)) {
      const { steps, title } = catalog.playbooks[name];
      playbooks[name] = { steps: steps.length, carried: steps.filter((s) => all.includes(s.head)).length };
      for (const s of steps) {
        for (const [skill, conditional] of Object.entries(s.skills)) triggers.push({ from: `${name}#${s.n}`, skill, state: triggerState(skill, [s.head], conditional) });
        for (const g of s.generic) triggers.push({ from: `${name}#${s.n}`, skill: g.oneOf.join(" or "), state: anyState(g.oneOf, [s.head], g.conditional) });
      }
      for (const [skill, conditional] of Object.entries(catalog.routes[doc] ?? {})) triggers.push({ from: name, skill, state: triggerState(skill, [norm(title)], conditional) });
    }
    if (kind === "skill") for (const [skill, conditional] of Object.entries(catalog.routes[doc] ?? {})) triggers.push({ from: name, skill, state: triggerState(skill, [], conditional) });
  }
  const cited = citedPrinciples(o.texts.join("\n"), catalog);
  const read = Object.keys(catalog.principles).filter((p) => o.reads.has(`principle:${p}`));
  return {
    context: o.context,
    reminders: o.reminders,
    modeEntered: o.enteredForAudit,
    graded: o.enteredForAudit && !o.editsSkills,
    replies: o.replies,
    repliesCitingPrinciple: o.repliesCitingPrinciple,
    playbooks,
    triggers,
    principles: { cited, read, citedUnread: cited.filter((p) => !read.includes(p)) },
    skillCalls: o.skillCalls,
    models: o.models,
  };
}

function audit(trace, catalog) {
  const seen = new Map();
  const facts = (x) => seen.get(x) ?? seen.set(x, observe(x, catalog)).get(x);
  const parent = new Map();
  for (const x of actorsOf(trace)) for (const c of x.children) parent.set(c, x);
  const treeReads = (x) => [...facts(x).reads, ...x.children.flatMap(treeReads)];
  const delegatedRead = (x) => (skill) => x.children.some((c) => ` ${norm(spawnOf(x, c)?.prompt ?? "")} `.includes(` ${norm(skill)} `) && treeReads(c).includes(`skill:${skill}`));
  return actorsOf(trace).map((x) => {
    const row = grade(facts(x), catalog, delegatedRead(x));
    if (!x.sub) return { id: x.id, kind: "session", agentType: null, ...row };
    const spawn = spawnOf(parent.get(x), x);
    const requested = spawn ? spawn.model : x.sub.model;
    const actual = Object.keys(row.models);
    return {
      id: x.id,
      kind: "subagent",
      agentType: x.sub.agentType,
      description: x.sub.description ?? spawn?.description ?? "",
      requestedModel: requested ?? "omitted",
      modelMatches: requested && actual.length ? actual.every((m) => family(m) === (family(requested) ?? requested)) : null,
      ...row,
    };
  });
}

function summarize(rows) {
  const sum = (f, over = rows) => over.reduce((n, r) => n + f(r), 0);
  const graded = rows.filter((r) => r.graded);
  const count = (state) => sum((r) => r.triggers.filter((x) => x.state === state).length, graded);
  const subs = rows.filter((r) => r.kind === "subagent");
  return {
    transcripts: rows.length,
    sessions: rows.length - subs.length,
    subagents: subs.length,
    withContext: sum((r) => (r.context > 0 ? 1 : 0)),
    inMode: rows.filter((r) => r.modeEntered).length,
    graded: graded.length,
    playbooksRun: sum((r) => Object.values(r.playbooks).filter((p) => p.steps).length, graded),
    playbookSteps: sum((r) => Object.values(r.playbooks).reduce((n, p) => n + p.steps, 0), graded),
    stepsCarriedVerbatim: sum((r) => Object.values(r.playbooks).reduce((n, p) => n + p.carried, 0), graded),
    triggers: {
      fired: count("fired"),
      delegated: count("delegated"),
      skippedWithReason: count("skipped-with-reason"),
      conditionalNotRun: count("conditional-not-run"),
      silent: count("silent"),
    },
    principlesCited: sum((r) => r.principles.cited.length, graded),
    principlesCitedUnread: sum((r) => r.principles.citedUnread.length, graded),
    replies: sum((r) => r.replies, graded),
    repliesCitingPrinciple: sum((r) => r.repliesCitingPrinciple, graded),
    skillCallsRefused: sum((r) => r.skillCalls.filter((c) => c.refused).length),
    subagentsModelOmitted: subs.filter((r) => r.requestedModel === "omitted").length,
    subagentsModelMismatch: subs.filter((r) => r.modelMatches === false).length,
  };
}

function render(rows) {
  const out = [];
  for (const r of rows) {
    const model = r.kind === "subagent" ? `, model ${r.requestedModel}${r.modelMatches === false ? " MISMATCH " + Object.keys(r.models).join("+") : ""}` : "";
    out.push(r.kind === "session" ? `session ${r.id}` : `  subagent ${r.id} (${r.agentType ?? "?"}${model}) ${r.description ?? ""}`);
    out.push(`    context=${r.context} reminders=${r.reminders} mode=${r.modeEntered} graded=${r.graded} replies=${r.replies} citing=${r.repliesCitingPrinciple}`);
    if (!r.graded) continue;
    for (const [name, p] of Object.entries(r.playbooks)) if (p.steps) out.push(`    playbook ${name}: ${p.carried}/${p.steps} steps carried verbatim`);
    for (const x of r.triggers.filter((x) => x.state !== "fired")) out.push(`    trigger ${x.from} -> ${x.skill}: ${x.state}`);
    const { cited, read, citedUnread } = r.principles;
    if (cited.length || read.length) out.push(`    principles cited=${cited.length} read=${read.length}${citedUnread.length ? " cited-unread=" + citedUnread.join(",") : ""}`);
    for (const c of r.skillCalls.filter((c) => c.refused)) out.push(`    Skill(${c.skill}) refused: ${c.error}`);
  }
  return out.join("\n");
}

/** The actor as it stood when turn `index` reached its stop `stop`. */
const atStop = (actor, index, stop) => {
  const turn = actor.turns[index];
  const at = turn.stops[stop];
  return {
    ...actor,
    turns: [
      ...actor.turns.slice(0, index),
      { ...turn, actions: turn.actions.slice(0, at.actions), texts: turn.texts.slice(0, at.texts), stops: turn.stops.slice(0, stop + 1), asked: turn.asked.filter((a) => a.at <= at.actions) },
    ],
  };
};

/** A replay raises each tag once per mode span, as a live session does, on top of the tags the transcript already holds. */
const withAsked = (span, raised) => ({ ...span, asked: new Map([...span.asked, ...[...raised].map((id) => [id, Math.max(span.asked.get(id) ?? 0, 1)])]) });

const ruleOf = (id) => id.slice(0, id.indexOf(":"));

function replay(paths, catalog, models, json) {
  const stops = [];
  for (const path of paths)
    for (const actor of actorsOf(readClaudeTrace(path))) {
      const mode = modeOf(actor);
      if (!mode.on) continue;
      const raised = new Set();
      for (const turn of actor.turns.slice(mode.since)) {
        const prompt = (turn.prompt ?? "").slice(0, 120);
        const events = [
          ...turn.actions.flatMap((a, at) => (a.kind === "spawn" ? [{ at, spawn: a }] : [])),
          ...turn.stops.map((s, stop) => ({ at: s.actions - 0.5, stop })),
        ].sort((a, b) => a.at - b.at);
        for (const e of events) {
          if (e.spawn) {
            const verdict = check(withAsked(spanOf(actor, e.spawn.id, new Set(), catalog), raised), e.spawn, catalog, models);
            const findings = verdict.kind === "deny" ? verdict.ids.map((id) => ({ rule: ruleOf(id), id, message: verdict.reason.split("\n").find((l) => l.includes(`[pstack:${id}]`)) })) : [];
            for (const f of findings) raised.add(f.id);
            stops.push({ event: "PreToolUse", session: path, actor: actor.id, turn: turn.index, spawn: e.spawn.id, prompt, findings, description: e.spawn.description });
            continue;
          }
          const then = atStop(actor, turn.index, e.stop);
          const found = gate(withAsked(spanOf(then, null, new Set(), catalog), raised), stopView(then), catalog, null);
          for (const f of found) raised.add(f.id);
          const findings = found.map((f) => ({ rule: ruleOf(f.id), id: f.id, message: f.message }));
          stops.push({ event: actor.sub ? "SubagentStop" : "Stop", session: path, actor: actor.id, turn: turn.index, stop: e.stop, prompt, findings, reply: turn.stops[e.stop].reply });
        }
      }
    }
  const tally = (event) => {
    const mine = stops.filter((s) => s.event === event);
    const byRule = {};
    for (const s of mine) for (const rule of new Set(s.findings.map((f) => f.rule))) byRule[rule] = (byRule[rule] ?? 0) + 1;
    return { actors: new Set(mine.map((s) => s.actor)).size, stops: mine.length, blocked: mine.filter((s) => s.findings.length).length, byRule };
  };
  const summary = { Stop: tally("Stop"), SubagentStop: tally("SubagentStop"), PreToolUse: tally("PreToolUse") };
  const blocked = stops.filter((s) => s.findings.length);
  if (json) return console.log(JSON.stringify({ summary, blocked }, null, 2));
  for (const s of blocked) for (const f of s.findings) console.log(`${s.session} ${s.event} turn ${s.turn} [pstack:${f.id}] ${f.message}`);
  console.log(JSON.stringify(summary, null, 2));
}

function main(argv) {
  const args = [...argv];
  const fail = (message) => {
    console.error(message ? `${message}\n\n${USAGE}` : USAGE);
    process.exit(2);
  };
  if (args.includes("--help")) {
    console.log(USAGE);
    return;
  }
  const flag = (name) => {
    const i = args.indexOf(name);
    if (i < 0) return null;
    const [, value] = args.splice(i, 2);
    if (!value || value.startsWith("--")) fail(`${name} needs a value`);
    return value;
  };
  const skillsDir = flag("--skills") ?? join(dirname(fileURLToPath(import.meta.url)), "..", "skills");
  const since = flag("--since");
  const json = args.includes("--json");
  const paths = args.filter((a) => a !== "--json" && a !== "--gate-replay").flatMap(sessionsUnder);
  if (since) paths.push(...sessionsSince(since).filter((p) => !paths.includes(p)));
  if (!paths.length) fail();
  const catalog = loadCatalog(skillsDir);
  if (args.includes("--gate-replay")) return replay(paths, catalog, modelTable(modelsFile(join(skillsDir, "poteto-mode", "pstack-models.md"))), json);
  const rows = paths.flatMap((p) => audit(readClaudeTrace(p), catalog));
  const summary = summarize(rows);
  if (json) console.log(JSON.stringify({ summary, rows }, null, 2));
  else console.log(render(rows) + "\n\nsummary " + JSON.stringify(summary, null, 2));
}

main(process.argv.slice(2));
