#!/usr/bin/env node
import { existsSync, lstatSync, readFileSync, realpathSync } from "node:fs";
import { homedir } from "node:os";
import { basename, dirname, join } from "node:path";
import { isDeepStrictEqual } from "node:util";
import { fileURLToPath } from "node:url";

const repo = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const claude = join(homedir(), ".claude");
const manifest = JSON.parse(readFileSync(join(repo, "install.json"), "utf8"));
const settings = JSON.parse(readFileSync(join(claude, "settings.json"), "utf8"));
let failed = 0;
const check = (ok, what) => {
  if (!ok) failed++;
  console.log(`${ok ? "ok  " : "FAIL"} ${what}`);
};

for (const [event, groups] of Object.entries(manifest.hooks))
  for (const group of groups)
    check(
      (settings.hooks?.[event] ?? []).some((g) => isDeepStrictEqual(g, group)),
      `hook ${event}${group.matcher ? ` on ${group.matcher}` : ""} registered as install.json has it`,
    );

for (const [key, value] of Object.entries(manifest.env ?? {})) check(settings.env?.[key] === value, `env ${key}=${value}`);

const poteto = join(claude, "skills", "poteto-mode");
const servedRepo = lstatSync(poteto).isSymbolicLink() ? join(realpathSync(poteto), "..", "..") : repo;
for (const path of manifest.agents.paths) {
  const agent = join(claude, "agents", basename(path));
  const served = join(servedRepo, path);
  const st = lstatSync(agent, { throwIfNoEntry: false });
  if (st && !st.isSymbolicLink()) check(readFileSync(agent).equals(readFileSync(served)), `agent ${basename(path)} matches the served checkout (copy)`);
  else {
    const target = existsSync(agent) ? realpathSync(agent) : null;
    check(target === realpathSync(served), `agent ${basename(path)} links into the served checkout${target ? "" : " (missing)"}`);
  }
}

const errors = join(claude, "pstack", "hook-errors.log");
const logged = existsSync(errors) ? readFileSync(errors, "utf8").trim() : "";
check(!logged, `${errors} is ${existsSync(errors) ? (logged ? "not empty:" : "empty") : "absent"}`);
if (logged) console.log(logged.split("\n").slice(-5).join("\n"));

const here = realpathSync(repo);
console.log(`info skills are served from ${realpathSync(servedRepo)}${realpathSync(servedRepo) === here ? " (this checkout)" : `, not this checkout (${here})`}`);
process.exit(failed ? 1 : 0);
