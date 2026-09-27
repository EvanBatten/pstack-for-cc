import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const DEADLINE = path.join(import.meta.dirname, "deadline.mjs");
const HANG_MS = 120_000;
const deadline = (seconds, script, input) =>
  spawnSync(process.execPath, [DEADLINE, String(seconds), process.execPath, "-e", script], { input, encoding: "utf8", timeout: 2 * HANG_MS });

const alive = (pid) => {
  try {
    process.kill(pid, 0);
    return true;
  } catch (e) {
    return e.code === "EPERM";
  }
};

const sleep = (ms) => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);

// A killed process can linger for a moment, as a zombie until it is reaped or on Windows until its handles close.
const goneWithin = (pid, ms) => {
  const end = Date.now() + ms;
  while (alive(pid)) {
    if (Date.now() > end) return false;
    sleep(20);
  }
  return true;
};

test("a child that outlives the deadline is killed with its own children, and the wrapper exits 124", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "deadline-"));
  const pidFile = path.join(dir, "grandchild");
  const readyFile = path.join(dir, "ready");
  const grandchild = `require("fs").writeFileSync(${JSON.stringify(pidFile)}, String(process.pid)); setTimeout(() => {}, ${HANG_MS})`;
  // On Windows Node's own job object ends a plain grandchild with its parent, so only a detached one tests the tree kill.
  const child = `const fs = require("fs");
require("child_process").spawn(process.execPath, ["-e", ${JSON.stringify(grandchild)}], { stdio: "ignore", detached: process.platform === "win32" });
const up = setInterval(() => { if (fs.existsSync(${JSON.stringify(pidFile)})) { clearInterval(up); fs.writeFileSync(${JSON.stringify(readyFile)}, String(Date.now())); } }, 10);
setTimeout(() => {}, ${HANG_MS});`;
  const outlive = (seconds) => {
    fs.rmSync(pidFile, { force: true });
    fs.rmSync(readyFile, { force: true });
    const started = Date.now();
    const r = deadline(seconds, child);
    const elapsed = Date.now() - started;
    const pid = fs.existsSync(pidFile) ? Number(fs.readFileSync(pidFile, "utf8")) : null;
    const ready = fs.existsSync(readyFile) ? Number(fs.readFileSync(readyFile, "utf8")) : Infinity;
    const survived = pid !== null && !goneWithin(pid, 10_000);
    if (survived) process.kill(pid);
    return { r, elapsed, survived, upInTime: ready < started + seconds * 1000 };
  };
  const run = [1, 2, 4, 8, 16].reduce((prev, seconds) => (prev?.upInTime ? prev : outlive(seconds)), null);
  fs.rmSync(dir, { recursive: true, force: true });
  assert.deepEqual([run.upInTime, run.r.status, run.elapsed < HANG_MS / 2, run.survived], [true, 124, true, false]);
});

test("a child that ends in time keeps its exit code, and its stdin and stdout pass through", () => {
  const echo = 'process.stdin.pipe(process.stdout); process.stdin.on("end", () => { process.exitCode = 3; })';
  const r = deadline(10, echo, "prompt");
  assert.deepEqual([r.status, r.stdout], [3, "prompt"]);
});
