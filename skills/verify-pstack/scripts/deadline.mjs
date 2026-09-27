#!/usr/bin/env node
// Usage: node deadline.mjs <seconds> <command> [args...]
// Runs the command with this process's stdio. When it outlives the deadline, kills it and every process under it and
// exits 124, as GNU timeout does. Otherwise exits with the command's status.
import { spawn, spawnSync } from "node:child_process";
import { constants } from "node:os";

const [seconds, command, ...args] = process.argv.slice(2);
const windows = process.platform === "win32";
// A process group of its own lets one kill reach the grandchildren on macOS and Linux; Windows walks the tree instead.
const child = spawn(command, args, { stdio: "inherit", detached: !windows });

let late = false;
const timer = setTimeout(() => {
  late = true;
  if (windows) spawnSync("taskkill", ["/pid", String(child.pid), "/T", "/F"], { stdio: "ignore" });
  else process.kill(-child.pid, "SIGKILL");
}, Number(seconds) * 1000);

child.on("error", (err) => {
  console.error(`deadline: ${command}: ${err.message}`);
  process.exit(127);
});
child.on("exit", (code, signal) => {
  clearTimeout(timer);
  process.exit(late ? 124 : (code ?? 128 + constants.signals[signal]));
});
