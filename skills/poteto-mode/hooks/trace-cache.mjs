import { createHash } from "node:crypto";
import { mkdirSync, readdirSync, readFileSync, renameSync, rmSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { parseTranscript } from "./trace.mjs";

/** @typedef {import("./trace.mjs").Parsed} Parsed */

const sha = (text) => createHash("sha256").update(text).digest("hex");

// Any change to the parser invalidates every entry.
const VERSION = sha(readFileSync(new URL("trace.mjs", import.meta.url), "utf8"));

const attempt = (fn) => {
  try {
    return fn();
  } catch {
    return null;
  }
};

/**
 * A parse that keeps each transcript's parsed turns under `dir`, reused while the file keeps its size and mtime.
 * A finished subagent's file stops changing, so each later hook call reads its JSON instead of parsing the transcript again.
 * @param {string} dir
 * @param {(path: string) => Parsed} [parse]
 * @returns {(path: string) => Parsed}
 */
export const cachedParse = (dir, parse = parseTranscript) => (path) => {
  const stat = attempt(() => statSync(path));
  if (!stat) return parse(path);
  const entry = join(dir, `${sha(path).slice(0, 32)}.json`);
  const hit = attempt(() => JSON.parse(readFileSync(entry, "utf8")));
  if (hit?.version === VERSION && hit.path === path && hit.size === stat.size && hit.mtimeMs === stat.mtimeMs) return hit.parsed;
  const parsed = parse(path);
  attempt(() => {
    mkdirSync(dir, { recursive: true });
    const tmp = `${entry}.${process.pid}.${Date.now()}.tmp`;
    writeFileSync(tmp, JSON.stringify({ version: VERSION, path, size: stat.size, mtimeMs: stat.mtimeMs, parsed }));
    try {
      renameSync(tmp, entry);
    } catch (e) {
      rmSync(tmp, { force: true });
      throw e;
    }
  });
  return parsed;
};

/** Deletes the entries under `dir` last written more than `maxAgeMs` ago. @param {string} dir @param {number} maxAgeMs */
export const prune = (dir, maxAgeMs) => {
  const cutoff = Date.now() - maxAgeMs;
  for (const name of attempt(() => readdirSync(dir)) ?? []) {
    const file = join(dir, name);
    attempt(() => statSync(file).mtimeMs < cutoff && rmSync(file, { force: true }));
  }
};
