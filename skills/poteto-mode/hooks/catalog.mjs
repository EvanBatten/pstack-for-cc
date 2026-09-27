import { existsSync, readdirSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { basename, join } from "node:path";
import { fileURLToPath } from "node:url";
import { MODEL_TIERS } from "./kinds.mjs";

/** @typedef {import("./trace.mjs").Action} Action */
/** @typedef {ReturnType<typeof loadCatalog>} Catalog */
/** @typedef {Catalog["playbooks"][string]["steps"][number]} Step */
/** @typedef {`skill:${string}` | `playbook:${string}` | `principle:${string}`} DocId */

export const norm = (s) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

const escape = (s) => s.replace(/[.*+?^${}()|[\]\\-]/g, "\\$&");

export const list = (words) => (words.length < 2 ? words.join("") : `${words.slice(0, -1).join(", ")} and ${words.at(-1)}`);

const STEP_HEAD_CHARS = 40;

export const PROSE_ROUTED = ["skill:architect", "playbook:opening-a-pr"];

export const routedFile = (skillsDir, doc) => {
  const [kind, name] = doc.split(":");
  return kind === "skill" ? join(skillsDir, name, "SKILL.md") : join(skillsDir, "poteto-mode", "playbooks", `${name}.md`);
};

const CONDITION = /^\W*(if|when|unless|for)\b|\b(if|when|unless)\b/i;

const OR_BEFORE = /\bor\s+(?:the\s+)?$/i;
const OR_AFTER = /^(?:\s+skill)?\s+or\b/i;
const OR_BETWEEN = /^(?:\s+skill)?\s+or\s+(?:the\s+)?$/i;

const GENERIC_REFS = [{ name: "control", re: /\b(the|matching|relevant) control skill\b/i, oneOf: ["control-cli", "control-ui"] }];

const AGENT_NOUN = "(?:cloud )?(?:subagent|session|owner|verifier|agent)s?";

/** Phrasings that hand a step to another actor, so the skills that step names are that actor's, not the reader's. */
export const DELEGATE_ACTORS = [
  { re: new RegExp(`\\bone ${AGENT_NOUN} per\\b`, "i"), scope: "sentence" },
  { re: new RegExp(`\\beach (?:a )?${AGENT_NOUN}\\b`, "i"), scope: "sentence" },
  { re: /\ba subagent that\b/i, scope: "sentence" },
  { re: /\bthe lanes:/i, scope: "rest" },
];

const spelledOneOf = (skills) => {
  const ref = GENERIC_REFS.find((r) => r.oneOf.length === skills.length && r.oneOf.every((s) => skills.includes(s)));
  return ref ? { skills: ref.oneOf, name: ref.name } : { skills, name: skills.join(" or ") };
};

/** @returns {{ skills: string[], name: string | null, conditional: boolean, spelled: boolean }[]} */
function sentenceNeeds(sentence, catalog, delegated) {
  const cond = delegated || CONDITION.test(sentence);
  const mentions = [...sentence.matchAll(catalog.skillPattern)].map((m) => ({ skill: m[1] ?? m[2] ?? m[3], start: m.index, end: m.index + m[0].length }));
  const groups = [];
  for (const m of mentions) {
    const last = groups.at(-1);
    if (last && OR_BETWEEN.test(sentence.slice(last.at(-1).end, m.start))) last.push(m);
    else groups.push([m]);
  }
  const needs = groups.map((g) => {
    const skills = [...new Set(g.map((m) => m.skill))];
    const optional = OR_BEFORE.test(sentence.slice(0, g[0].start)) || OR_AFTER.test(sentence.slice(g.at(-1).end));
    return { ...(skills.length > 1 ? spelledOneOf(skills) : { skills, name: null }), conditional: cond || optional, handed: delegated, spelled: true };
  });
  for (const ref of GENERIC_REFS) if (ref.re.test(sentence)) needs.push({ skills: ref.oneOf, name: ref.name, conditional: cond, handed: delegated, spelled: false });
  return needs;
}

export const sentencesOf = (text) => text.split(/(?<=\.)\s+/);

const textNeeds = (text, catalog) => {
  let rest = false;
  return sentencesOf(text).flatMap((s) => {
    const own = DELEGATE_ACTORS.some((d) => d.scope === "sentence" && d.re.test(s));
    const needs = sentenceNeeds(s, catalog, rest || own);
    rest ||= DELEGATE_ACTORS.some((d) => d.scope === "rest" && d.re.test(s));
    return needs;
  });
};

const mergeGeneric = (into, more) => {
  for (const g of more) {
    const had = into.find((x) => x.name === g.name);
    if (had) had.conditional &&= g.conditional;
    else into.push(g);
  }
};

/**
 * `handed` names each skill or generic need that every mention hands to another actor, as a step's lane list does.
 * @returns {{ skills: Record<string, boolean>, generic: { name: string, oneOf: string[], conditional: boolean }[], handed: Record<string, boolean> }}
 */
function needsIn(text, catalog) {
  const skills = {};
  const generic = [];
  const handed = {};
  for (const need of textNeeds(text, catalog)) {
    const name = need.name ?? need.skills[0];
    handed[name] = (handed[name] ?? true) && need.handed;
    if (need.name === null) skills[need.skills[0]] = (skills[need.skills[0]] ?? true) && need.conditional;
    else mergeGeneric(generic, [{ name: need.name, oneOf: need.skills, conditional: need.conditional }]);
  }
  return { skills, generic, handed };
}

function skillsNamedIn(text, catalog) {
  const named = {};
  for (const need of textNeeds(text, catalog))
    if (need.spelled) for (const skill of need.skills) named[skill] = (named[skill] ?? true) && (need.conditional || need.skills.length > 1);
  return named;
}

export function loadCatalog(skillsDir) {
  const skills = readdirSync(skillsDir).filter((d) => existsSync(join(skillsDir, d, "SKILL.md")));
  const pm = join(skillsDir, "poteto-mode");
  const principles = {};
  for (const f of readdirSync(join(pm, "principles"))) {
    if (!f.endsWith(".md")) continue;
    const heading = readFileSync(join(pm, "principles", f), "utf8").match(/^# (.+)$/m);
    principles[f.slice(0, -3)] = heading ? heading[1].trim() : f.slice(0, -3);
  }
  const names = skills.map(escape).join("|");
  const catalog = {
    dir: skillsDir,
    skills,
    principles,
    playbooks: {},
    routes: {},
    skillPattern: new RegExp(`\\*\\*(${names})\\*\\*(?!-)|\`\\/?(${names})\`(?!-)|(?<![\\w-])\\/(${names})(?![\\w-])`, "g"),
  };
  for (const f of readdirSync(join(pm, "playbooks"))) {
    if (!f.endsWith(".md")) continue;
    const text = readFileSync(join(pm, "playbooks", f), "utf8");
    const steps = [];
    let open = false;
    for (const line of text.split(/\r?\n/)) {
      const m = line.match(/^(\d+)\.\s+(.+)$/);
      if (open && !m && /^\s+\S/.test(line)) {
        const step = steps.at(-1);
        step.line += `\n${line}`;
        const more = needsIn(line, catalog);
        for (const [skill, conditional] of Object.entries(more.skills)) step.skills[skill] = (step.skills[skill] ?? true) && conditional;
        for (const [name, handed] of Object.entries(more.handed)) step.handed[name] = (step.handed[name] ?? true) && handed;
        mergeGeneric(step.generic, more.generic);
        continue;
      }
      open = Boolean(m);
      if (!m) continue;
      const first = norm(sentencesOf(m[2])[0]);
      steps.push({ n: Number(m[1]), line, sentence: first, head: first.slice(0, STEP_HEAD_CHARS), words: [...new Set(first.split(" ").filter((w) => w.length >= 4))], ...needsIn(m[2], catalog) });
    }
    const role = text.match(/configured ([\w-]+) model \(default `(\w+)`\)/);
    catalog.playbooks[f.slice(0, -3)] = {
      title: text.match(/^#+ (.+)$/m)?.[1].trim() ?? f.slice(0, -3),
      steps,
      text: norm(text),
      role: role ? { name: role[1], fallback: role[2] } : null,
    };
  }
  for (const doc of PROSE_ROUTED) {
    const file = routedFile(skillsDir, doc);
    if (!existsSync(file)) continue;
    const routes = skillsNamedIn(readFileSync(file, "utf8").replace(/^---[\s\S]*?\n---\n/, ""), catalog);
    delete routes[doc.split(":")[1]];
    catalog.routes[doc] = routes;
  }
  return catalog;
}

/**
 * The skills a step requires of the actor running it, each need met by any one of its skills. A skill named under a
 * condition is left to the worker's judgment, and one the step hands to another actor is not the worker's.
 * @returns {{ name: string, skills: string[] }[]}
 */
export const stepNeeds = (step) => [
  ...Object.entries(step.skills).flatMap(([skill, conditional]) => (conditional || step.handed[skill] ? [] : [{ name: skill, skills: [skill] }])),
  ...step.generic.flatMap((g) => (g.conditional || step.handed[g.name] ? [] : [{ name: g.name, skills: g.oneOf }])),
];

const SHIPPED_MODELS = fileURLToPath(new URL("../pstack-models.md", import.meta.url));

export function modelsFile(...defaults) {
  const path = [process.env.PSTACK_MODELS_FILE, join(homedir(), ".claude", "pstack-models.md"), ...defaults, SHIPPED_MODELS].find((p) => p && existsSync(p));
  return { path, text: readFileSync(path, "utf8") };
}

/** @returns {{ label: string, roles: string[], values: string[], line: number }[]} */
export function roleLines(text) {
  return text.split(/\r?\n/).flatMap((l, i) => {
    const m = l.match(/^([^#:][^:]*):\s*(.+)$/);
    const split = (s) => s.split(",").map((v) => v.trim());
    return m ? [{ label: m[1].trim(), roles: split(m[1]), values: split(m[2]), line: i + 1 }] : [];
  });
}

export function modelTable({ path, text }) {
  const roles = new Map();
  for (const r of roleLines(text)) for (const role of r.roles) roles.set(role, r.values[0]);
  return { file: basename(path), roles };
}

/** The names a line in a standing-skips file may waive: a rule key, or a skill whose read every ask treats as done. */
export const STANDING_WAIVABLE = ["technical-writing", "unslop", "docs-prose", "pr-prose", "pr-draft"];

const STANDING_SKIP = /^skip ([^:]+?):\s*(\S.*)$/;
const TRUST_LINE = /^trust\s+(.+?)\s+([0-9a-f]{64})$/i;

export function skipsFileLines(text) {
  const lines = text.split(/\r?\n/).map((l) => l.trim());
  return {
    skips: lines.flatMap((l) => {
      const m = l.match(STANDING_SKIP);
      return m ? [{ name: m[1].trim(), reason: m[2] }] : [];
    }),
    trusts: lines.flatMap((l) => {
      const m = l.match(TRUST_LINE);
      return m ? [{ root: m[1], sha256: m[2].toLowerCase() }] : [];
    }),
  };
}

const JUDGMENT_ROLES = new Set([
  "judgment and prose",
  "hardest tasks",
  "how explainer",
  "why synthesizer",
  "reflect judgment",
  "divergent",
  "synthesizer",
  "reflect tooling",
  "arena cross-judge pool",
  "interrogate reviewers",
]);

export const OMIT_MODEL = new Set(["inherit-parent", "auto"]);

const JUDGE_VALUES = new Set([...OMIT_MODEL, MODEL_TIERS[0]]);

/** @returns {{ role: string, value: string, line: number }[]} */
export function judgeFloor(text) {
  return roleLines(text).flatMap((r) =>
    r.roles.some((role) => JUDGMENT_ROLES.has(role)) ? r.values.filter((v) => !JUDGE_VALUES.has(v)).map((value) => ({ role: r.label, value, line: r.line })) : [],
  );
}

/** `claude-3-5-sonnet-20241022` and `opus[1m]` give sonnet and opus. */
export const family = (model) => {
  const m = (model ?? "").match(/^(?:.*[./])?claude-(?:\d+[-.])*([a-z]+)|^([a-z]+)(?:\[\w+\])?$/);
  return m ? (m[1] ?? m[2]) : null;
};

const LIVE_TREE = /\.claude[\\/]skills[\\/]/;
const DOC_PATH = /(?:([\w-]+)[\\/]SKILL\.md|principles[\\/]([\w-]+)\.md|playbooks[\\/]([\w-]+)\.md)/g;

/** @returns {DocId | null} */
const docOf = (m, catalog) => {
  if (m[1]) return catalog.skills.includes(m[1]) ? `skill:${m[1]}` : null;
  if (m[2]) return m[2] in catalog.principles ? `principle:${m[2]}` : null;
  return m[3] in catalog.playbooks ? `playbook:${m[3]}` : null;
};

/**
 * The catalog documents an action read, with whether each came from the installed tree. A Read counts by its path,
 * whole or in part, and a Skill call or a harness skill load by its name. A shell command counts only what its file
 * readers read; a partial read still counts, so a false read errs toward letting a call through.
 * @param {Action} action @returns {{ doc: DocId, live: boolean }[]}
 */
export function docsIn(action, catalog) {
  if (action.kind === "skill") return catalog.skills.includes(action.name) ? [{ doc: `skill:${action.name}`, live: true }] : [];
  if (action.kind === "read") {
    const path = action.file.path;
    const doc = [...path.matchAll(DOC_PATH)].filter((m) => m.index + m[0].length === path.length).map((m) => docOf(m, catalog))[0];
    return doc ? [{ doc, live: LIVE_TREE.test(path) }] : [];
  }
  if (action.kind !== "shell") return [];
  const live = LIVE_TREE.test(action.command);
  return [...new Set(readerUnits(action.command).flatMap((unit) => unitDocs(unit, catalog)))].map((doc) => ({ doc, live }));
}

const READERS = ["cat", "type", "less", "more", "head", "tail", "sed", "awk", "get-content", "gc", "bat"];
const LEADS = ["sudo", "command", "env", "nohup", "time", "timeout", "exec", "do", "then", "else", "{", "("];
const STATEMENT = /&&|\|\||[;|\n]/;

/** Whether a statement's command is a file reader; `sed` reads only with `-n`, since otherwise it may edit. */
const reads = (statement) => {
  let words = statement.trim().split(/\s+/);
  while (words.length && (LEADS.includes(words[0]) || /^\w+=/.test(words[0]) || /^\d+[smh]?$/.test(words[0]))) words = words.slice(1);
  const tool = (words[0] ?? "").split(/[\\/]/).pop().toLowerCase().replace(/\.exe$/, "");
  return READERS.includes(tool) && (tool !== "sed" || words.includes("-n"));
};

/**
 * The text of each file-reading statement in a command, with the variables set before it expanded and the directory a
 * `cd` moved into appended. A `for` loop whose body reads is one unit with its list, so a loop over slugs or a glob reads
 * what the list names.
 * @returns {{ text: string, cwd: string }[]}
 */
function readerUnits(command) {
  const loops = [];
  const flat = command.replace(/\bfor\s+\w+\s+in\s+([^;\n]*?)\s*[;\n]\s*do\b([\s\S]*?)\bdone\b/g, (m, list, body) => (loops.push({ list, body }), ` \0L${loops.length - 1}\0 `));
  const vars = new Map();
  const expand = (t) => t.replace(/\$\{?(\w+)\}?/g, (ref, name) => vars.get(name) ?? ref);
  const units = [];
  let cwd = "";
  for (const raw of flat.split(STATEMENT)) {
    const statement = raw.trim();
    const loop = statement.match(/\0L(\d+)\0/);
    if (loop) {
      const { list, body } = loops[Number(loop[1])];
      if (body.split(STATEMENT).some(reads)) units.push({ text: expand(`${list} ${body}`), cwd });
      continue;
    }
    const assign = statement.match(/^(?:export\s+)?(\w+)=["']?([^"'\s;&|]+)["']?$/);
    if (assign) vars.set(assign[1], expand(assign[2]));
    const cd = statement.match(/^cd\s+["']?([^"'\s;&|]+)["']?/);
    if (cd) cwd = expand(cd[1]);
    if (reads(statement)) units.push({ text: expand(statement), cwd });
  }
  return units;
}

const word = (name) => new RegExp(`(?<![\\w-])${name.replace(/-/g, "\\-")}(?![\\w-])`);

/**
 * The docs one reading statement reads: a catalog path it names; in a principles directory, each principle slug it
 * names as a word, or every principle through a glob; in a skill's directory, that skill's `SKILL.md`.
 * @returns {DocId[]}
 */
function unitDocs({ text, cwd }, catalog) {
  const named = [...text.matchAll(DOC_PATH)].flatMap((m) => docOf(m, catalog) ?? []);
  const where = `${text} ${cwd}`;
  const principles = /principles/.test(where)
    ? /principles[\\/]?\*|(^|\s)["']?\*(\.md)?\b/.test(where)
      ? Object.keys(catalog.principles)
      : Object.keys(catalog.principles).filter((slug) => word(slug).test(text))
    : [];
  const skill = /(^|[\s"'\\/])SKILL\.md\b/.test(text) ? catalog.skills.find((s) => s === cwd.split(/[\\/]/).filter(Boolean).pop()) : undefined;
  return [...named, ...principles.map((slug) => `principle:${slug}`), ...(skill ? [`skill:${skill}`] : [])];
}

/** The playbooks an action read from the installed tree, each once. */
export const playbookRead = (action, catalog) => [
  ...new Set(
    docsIn(action, catalog)
      .filter((r) => r.live && r.doc.startsWith("playbook:"))
      .map((r) => r.doc.slice("playbook:".length))
      .filter((name) => catalog.playbooks[name].steps.length),
  ),
];

export function citedPrinciples(text, catalog) {
  return Object.entries(catalog.principles)
    .filter(([slug, title]) => {
      const t = escape(title);
      return new RegExp(`principle[- ]${escape(slug)}\\b|\\*\\*${t}[.:]?\\*\\*|^#+ .*\\b${t}\\b`, "im").test(text);
    })
    .map(([slug]) => slug);
}

const LEDGER_HEAD = "# pstack step ledger: ";

/** The playbooks whose ledger a text carries, as a delegate's brief does once the PreToolUse hook appends one. */
export const ledgersIn = (text, catalog) => {
  const titles = new Set(text.split(/\r?\n/).flatMap((l) => (l.startsWith(LEDGER_HEAD) ? [l.slice(LEDGER_HEAD.length).trim()] : [])));
  return Object.keys(catalog.playbooks).filter((n) => titles.has(catalog.playbooks[n].title));
};

export function ledger(name, catalog) {
  const { title, steps } = catalog.playbooks[name];
  return `${LEDGER_HEAD}${title}

Carry these steps verbatim with a state each, as TaskCreate items before other work, or as a list in your reply where no task tool exists. A step you do not run keeps its line with \`skip: <reason>\`.

${steps.map((s) => s.line).join("\n")}
`;
}

export function briefPlaybook(prompt, catalog) {
  const line = prompt.match(/\bplaybook:\s*(.+)/i);
  const named = line ? ` ${norm(line[1])} ` : "";
  return (
    Object.keys(catalog.playbooks)
      .filter((n) => named.startsWith(` ${norm(catalog.playbooks[n].title)} `))
      .sort((a, b) => catalog.playbooks[b].title.length - catalog.playbooks[a].title.length)[0] ?? null
  );
}

export function briefLedger(prompt, catalog) {
  const name = briefPlaybook(prompt, catalog);
  return name && !ledgersIn(prompt, catalog).includes(name) ? ledger(name, catalog) : null;
}

/**
 * Why a spawn runs off the model its brief's playbook role names, or null when it does not.
 * @param {Extract<Action, { kind: "spawn" }>} spawn @param {ReturnType<typeof modelTable>} models @returns {string | null}
 */
export function modelRole(spawn, catalog, models) {
  const name = briefPlaybook(spawn.prompt, catalog);
  const role = name && catalog.playbooks[name].role;
  if (!role) return null;
  const { title } = catalog.playbooks[name];
  const value = models.roles.get(role.name);
  const want = value ?? role.fallback;
  const need = OMIT_MODEL.has(want) ? null : want;
  if ((family(spawn.model) ?? spawn.model) === (need && (family(need) ?? need))) return null;
  const source = value ? `${models.file} sets ${role.name} to ${value}` : `the ${title} playbook defaults ${role.name} to ${want} and ${models.file} has no ${role.name} line`;
  return `The ${title} delegate "${spawn.description}" would run on ${spawn.model ?? "the parent model (model omitted)"}, but ${source}. Spawn ${title} delegates with ${need ? `model "${need}"` : "model omitted"}.`;
}

const RANGE = String.raw`(\d+)\s*(?:-|–|to|through)\s*(\d+)`;
const LEAD = String.raw`^\W*(?:[a-z][\w-]*\s+){0,2}`;
const STEP_RANGES = [
  new RegExp(String.raw`${LEAD}[a-z]{1,4}${RANGE}\b`, "gi"),
  new RegExp(String.raw`${LEAD}${RANGE}\s*[:.)]`, "gi"),
  new RegExp(String.raw`\bsteps?\s+${RANGE}\b`, "gi"),
];

/** A step range a task subject spans, after `steps` or as its lead label. @returns {[number, number] | null} */
export const stepRange = (line) => {
  const m = STEP_RANGES.flatMap((re) => [...line.matchAll(re)]).find(([, a, b]) => Number(a) < Number(b));
  return m ? [Number(m[1]), Number(m[2])] : null;
};

const LABEL_FILLER = new Set(["the", "and", "for", "with", "then", "into", "per", "via", "its", "their", "this", "that"]);

const holdsHead = (l, s) => ` ${norm(l)} `.includes(` ${s.head}`);

const paraphrases = (l, s) => {
  const n = ` ${norm(l)} `;
  return s.words.length > 0 && s.words.filter((w) => n.includes(` ${w} `)).length * 3 >= s.words.length;
};

const labels = (l, s) => {
  const label = norm(l.replace(/^\W*(step\s*)?\d+\W*/i, "").split(/[.:(]|\s-\s/)[0])
    .split(" ")
    .filter((w) => w.length >= 3 && !LABEL_FILLER.has(w));
  const text = ` ${s.sentence}`;
  return label.length > 0 && label.filter((w) => text.includes(` ${w.slice(0, 5)}`)).length * 2 >= label.length;
};

// The whole words of four letters or more in a step's head; a word the head cuts short is left out.
const headWords = (s) => {
  const words = s.head.split(" ");
  if (s.sentence.length > s.head.length && s.sentence[s.head.length] !== " ") words.pop();
  return words.filter((w) => w.length >= 4);
};

const headCover = (l, s) => {
  const words = headWords(s);
  const n = ` ${norm(l)} `;
  return words.length ? words.filter((w) => n.includes(` ${w} `)).length / words.length : 0;
};

const numberOf = (l) => Number(l.trim().match(/^\W*(?:step\s*)?(\d+)[.):]/i)?.[1] ?? NaN);

/**
 * The one step a task subject carries among the named playbooks. A subject that opens with a playbook's title belongs to
 * that playbook alone. The step whose head it holds wins, then the step its number names when the text agrees. An
 * unnumbered subject maps to the step whose head words it covers most, when it covers more than half of them and no other
 * step ties; a weak or tied match, or a subject spanning a step range, maps to no step.
 * @returns {{ name: string, step: Step } | null}
 */
export function stepOf(subject, names, catalog) {
  const n = ` ${norm(subject)} `;
  const titled = Object.keys(catalog.playbooks).find((p) => n.startsWith(` ${norm(catalog.playbooks[p].title)} `));
  if (titled && !names.includes(titled)) return null;
  const at = titled ? subject.toLowerCase().indexOf(catalog.playbooks[titled].title.toLowerCase()) : -1;
  const rest = at >= 0 ? subject.slice(at + catalog.playbooks[titled].title.length) : subject;
  const steps = (titled ? [titled] : names).flatMap((p) => catalog.playbooks[p].steps.map((s) => ({ name: p, step: s })));
  if (stepRange(rest) !== null) return null;
  const held = steps.find(({ step }) => holdsHead(rest, step));
  if (held) return held;
  const number = numberOf(rest);
  if (!Number.isNaN(number)) return steps.find(({ step }) => step.n === number && (paraphrases(rest, step) || labels(rest, step))) ?? null;
  const scored = steps.map((x) => ({ ...x, score: headCover(rest, x.step) })).filter((x) => x.score > 0.5);
  const best = Math.max(0, ...scored.map((x) => x.score));
  const top = scored.filter((x) => x.score === best);
  return top.length === 1 ? { name: top[0].name, step: top[0].step } : null;
}
