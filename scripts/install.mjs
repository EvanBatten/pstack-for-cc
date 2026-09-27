#!/usr/bin/env node
import { cpSync, existsSync, lstatSync, mkdirSync, readFileSync, readlinkSync, realpathSync, rmSync, statSync, symlinkSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { basename, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { isDeepStrictEqual, parseArgs } from "node:util";

const repo = join(dirname(fileURLToPath(import.meta.url)), "..");
const manifest = JSON.parse(readFileSync(join(repo, "install.json"), "utf8"));
const expand = (path) => join(homedir(), path.replace(/^~/, ""));
const settingsPath = expand("~/.claude/settings.json");
const copiesPath = expand("~/.claude/pstack/install-copies.json");

const LINK_METHODS = [
  { name: "symlink", applies: () => true, make: (from, to) => symlinkSync(from, to) },
  { name: "junction", applies: (isDir, platform) => isDir && platform === "win32", make: (from, to) => symlinkSync(from, to, "junction") },
  { name: "copy", applies: () => true, make: (from, to) => cpSync(from, to, { recursive: true }) },
];

const PSTACK_COMMAND = /\b(?:pstack-hook|session-context)\.mjs\b/;

function mergeSettings(settings, manifest) {
  let removed = 0;
  const hooks = {};
  for (const [event, groups] of Object.entries(settings.hooks ?? {})) {
    const kept = groups.flatMap((group) => {
      const entries = group.hooks ?? [];
      const rest = entries.filter((h) => !PSTACK_COMMAND.test(h.command));
      removed += entries.length - rest.length;
      if (rest.length === entries.length) return [group];
      return rest.length ? [{ ...group, hooks: rest }] : [];
    });
    if (kept.length || !groups.length) hooks[event] = kept;
  }
  let added = 0;
  for (const [event, groups] of Object.entries(manifest.hooks)) {
    hooks[event] = [...(hooks[event] ?? []), ...groups];
    added += groups.length;
  }
  return {
    settings: { ...settings, hooks, env: { ...settings.env, ...manifest.env } },
    removed,
    added,
    env: Object.keys(manifest.env).length,
  };
}

const usage = (message) => {
  console.error(message);
  process.exit(2);
};

let args;
try {
  args = parseArgs({ options: { "dry-run": { type: "boolean" }, copy: { type: "boolean" }, "opt-in": { type: "string", multiple: true } } }).values;
} catch (e) {
  usage(`${e.message}\nusage: node scripts/install.mjs [--dry-run] [--copy] [--opt-in <name>]...`);
}
const dryRun = Boolean(args["dry-run"]);

const optIns = Object.keys(manifest.skills.optIn).map((key) => ({ key, short: key.slice(2).split("/")[0].replace(/^\./, "") }));
const chosen = (args["opt-in"] ?? []).map((name) => {
  const hit = optIns.find((o) => name === o.key || name === o.short);
  if (!hit) usage(`unknown opt-in "${name}"; valid: ${optIns.map((o) => `${o.short} (${o.key})`).join(", ")}`);
  return hit.key;
});

let rawSettings = null;
let settings = {};
if (existsSync(settingsPath)) {
  rawSettings = readFileSync(settingsPath);
  try {
    settings = JSON.parse(rawSettings.toString("utf8"));
  } catch (e) {
    console.error(`${settingsPath} is not valid JSON (${e.message}). Nothing was installed; fix or move the file and run again.`);
    process.exit(1);
  }
}

const say = (line) => console.log(dryRun ? `would ${line}` : line);

const readCopies = existsSync(copiesPath) ? JSON.parse(readFileSync(copiesPath, "utf8")) : [];
const copies = new Set(readCopies);

const methods = args.copy ? LINK_METHODS.filter((m) => m.name === "copy") : LINK_METHODS;

function place({ from, to }) {
  const isDir = statSync(from).isDirectory();
  const usable = methods.filter((m) => m.applies(isDir, process.platform));
  if (dryRun) return usable[0].name;
  rmSync(to, { recursive: true, force: true });
  mkdirSync(dirname(to), { recursive: true });
  let failure;
  for (const method of usable) {
    try {
      method.make(from, to);
      if (method.name === "copy") copies.add(to);
      else copies.delete(to);
      return method.name;
    } catch (e) {
      failure = e;
      rmSync(to, { recursive: true, force: true });
    }
  }
  throw failure;
}

function stateOf({ from, to }) {
  const st = lstatSync(to, { throwIfNoEntry: false });
  if (!st) return "missing";
  if (st.isSymbolicLink()) {
    const target = existsSync(to) ? realpathSync(to) : null;
    return target === realpathSync(from) ? "ours" : "other-link";
  }
  return copies.has(to) ? "our-copy" : "foreign";
}

let conflicts = 0;
const ACTIONS = {
  missing: (item) => `link ${item.to} -> ${item.from} (${place(item)})`,
  ours: (item) => {
    copies.delete(item.to);
    return `keep ${item.to}`;
  },
  "our-copy": (item) => `refresh ${item.to} (${place(item)})`,
  "other-link": (item) => {
    const was = readlinkSync(item.to);
    return `replace ${item.to} (was ${was}) -> ${item.from} (${place(item)})`;
  },
  foreign: (item) => {
    conflicts++;
    const kind = lstatSync(item.to).isDirectory() ? "directory" : "file";
    return `conflict ${item.to}: a real ${kind} the installer did not make, left untouched`;
  },
};

const items = (paths, dirs) => dirs.flatMap((dir) => paths.map((path) => ({ from: join(repo, path), to: join(expand(dir), basename(path)) })));
for (const item of [...items(manifest.skills.paths, [...manifest.skills.into, ...chosen]), ...items(manifest.agents.paths, manifest.agents.into)]) {
  say(ACTIONS[stateOf(item)](item));
}

const record = [...copies].sort();
if (!dryRun && !isDeepStrictEqual(record, [...readCopies].sort())) {
  mkdirSync(dirname(copiesPath), { recursive: true });
  writeFileSync(copiesPath, JSON.stringify(record, null, 2) + "\n");
}

const merged = mergeSettings(settings, manifest);
if (isDeepStrictEqual(merged.settings, settings)) {
  say(`keep ${settingsPath}`);
} else {
  if (rawSettings) {
    const backup = `${settingsPath}.bak-${new Date().toISOString().replace(/[:.]/g, "-")}`;
    if (!dryRun) writeFileSync(backup, rawSettings);
    say(`back up ${settingsPath} to ${backup}`);
  }
  if (!dryRun) {
    mkdirSync(dirname(settingsPath), { recursive: true });
    writeFileSync(settingsPath, JSON.stringify(merged.settings, null, 2) + "\n");
  }
  say(`write ${settingsPath}: removed ${merged.removed} pstack hook entries, appended ${merged.added} groups, set ${merged.env} env keys`);
}

process.exit(conflicts ? 1 : 0);
