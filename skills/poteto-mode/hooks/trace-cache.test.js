import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { cachedParse, prune } from "./trace-cache.mjs";
import { parseTranscript, readClaudeTrace } from "./trace.mjs";

const FIXTURES = path.join(import.meta.dirname, "fixtures");
const DAY = 24 * 60 * 60 * 1000;

// A copy of the fixture session and its subagents, so a test can append to a child, beside an empty cache directory.
const session = (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "pstack-trace-cache-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  fs.cpSync(path.join(FIXTURES, "session.jsonl"), path.join(root, "session.jsonl"));
  fs.cpSync(path.join(FIXTURES, "session"), path.join(root, "session"), { recursive: true });
  const calls = [];
  const cache = path.join(root, "cache");
  const read = () => readClaudeTrace(path.join(root, "session.jsonl"), { parse: cachedParse(cache, (p) => (calls.push(path.basename(p)), parseTranscript(p))) });
  const entries = () => fs.readdirSync(cache).map((f) => path.join(cache, f));
  return { root, cache, calls, read, entries, child: (name) => path.join(root, "session", "subagents", name) };
};

test("a trace read through the cache, cold and then warm, equals a fresh read of the same files", (t) => {
  const s = session(t);
  const fresh = readClaudeTrace(path.join(s.root, "session.jsonl"));
  assert.deepStrictEqual([s.read(), s.read()], [fresh, fresh]);
});

test("a second read of unchanged subagent files parses neither of them again", (t) => {
  const s = session(t);
  s.read();
  s.read();
  assert.deepStrictEqual(s.calls, ["agent-a1.jsonl", "agent-a2.jsonl"]);
});

test("appending a record to a subagent file makes the next read parse that file again and see the record", (t) => {
  const s = session(t);
  s.read();
  const record = { type: "assistant", message: { model: "claude-fable-5-1", content: [{ type: "text", text: "appended" }] } };
  fs.appendFileSync(s.child("agent-a1.jsonl"), `${JSON.stringify(record)}\n`);
  const a1 = s.read().children.find((c) => c.id === "agent-a1");
  assert.deepStrictEqual([s.calls, a1.turns.at(-1).texts.at(-1).text], [["agent-a1.jsonl", "agent-a2.jsonl", "agent-a1.jsonl"], "appended"]);
});

test("a cache entry from another parser version, or one that is not JSON, is ignored and rewritten", (t) => {
  const s = session(t);
  const fresh = s.read();
  const [stale, garbage] = s.entries();
  const written = JSON.parse(fs.readFileSync(stale, "utf8"));
  fs.writeFileSync(stale, JSON.stringify({ ...written, version: "other", parsed: { turns: [], entrypoint: "stale" } }));
  fs.writeFileSync(garbage, "{ not json");
  const again = s.read();
  assert.deepStrictEqual(
    [again, s.calls.length, s.entries().map((e) => JSON.parse(fs.readFileSync(e, "utf8")).version)],
    [fresh, 4, [written.version, written.version]],
  );
});

test("prune deletes a cache entry older than the age and keeps a fresh one", (t) => {
  const s = session(t);
  s.read();
  const [old, recent] = s.entries();
  const past = new Date(Date.now() - 15 * DAY);
  fs.utimesSync(old, past, past);
  prune(s.cache, 14 * DAY);
  assert.deepStrictEqual(s.entries(), [recent]);
});

test("prune of a directory that does not exist does nothing and does not throw", (t) => {
  const s = session(t);
  prune(path.join(s.root, "missing"), 14 * DAY);
  assert.deepStrictEqual(fs.readdirSync(s.root).sort(), ["session", "session.jsonl"]);
});
