import { existsSync, readFileSync } from "node:fs";
import { posix } from "node:path";

/**
 * @typedef {{ text: string, literal: boolean }} Piece
 * @typedef {Piece[]} Word
 * @typedef {{ words: Word[], hidden: boolean, op: string }} Segment
 * @typedef {[first: number, last: number]} Lines 1-based and inclusive; a negative first counts back from the last line
 * @typedef {{ files: string[], full: boolean, lines?: Lines }} Printed
 * @typedef {{ path: string, full: boolean, lines?: Lines }} ShellRead
 */

const slash = (p) => p.replaceAll("\\", "/");

/** Splits a command into simple commands, each with the operator after it. A segment whose stdout goes to a file is `hidden`. @returns {Segment[]} */
function lex(command) {
  const segs = [];
  let seg = { words: [], hidden: false, op: "" };
  /** @type {Word | null} */
  let word = null;
  let target = false;
  /** @type {{ end: string, tabs: boolean }[]} */
  const heredocs = [];
  const put = (text, literal = false) => {
    const last = (word ??= []).at(-1);
    if (last && last.literal === literal) last.text += text;
    else word.push({ text, literal });
  };
  const endWord = () => {
    if (word && !target) seg.words.push(word);
    if (word) target = false;
    word = null;
  };
  const endSeg = (op) => {
    endWord();
    segs.push({ ...seg, op });
    seg = { words: [], hidden: false, op: "" };
  };
  for (let i = 0; i < command.length; i++) {
    const c = command[i];
    const next = command[i + 1];
    if (c === "'") {
      const end = command.indexOf("'", i + 1);
      const stop = end < 0 ? command.length : end;
      put(command.slice(i + 1, stop), true);
      i = stop;
    } else if (c === '"') {
      let text = "";
      for (i++; i < command.length && command[i] !== '"'; i++) text += command[i] === "\\" && command[i + 1] === '"' ? command[++i] : command[i];
      put(text);
    } else if ((c === "\\" || c === "`") && (next === "\n" || next === "\r")) {
      i += next === "\r" && command[i + 2] === "\n" ? 2 : 1;
    } else if (c === "#" && !word) {
      while (i + 1 < command.length && command[i + 1] !== "\n") i++;
    } else if (c === "<" && next === "<" && /^<<(-?)[ \t]*(['"]?)([\w.-]+)\2/.test(command.slice(i))) {
      const [all, tabs, , end] = /^<<(-?)[ \t]*(['"]?)([\w.-]+)\2/.exec(command.slice(i));
      endWord();
      heredocs.push({ end, tabs: tabs === "-" });
      i += all.length - 1;
    } else if (c === "\n" && heredocs.length) {
      endSeg(";");
      for (const { end, tabs } of heredocs.splice(0)) {
        for (;;) {
          const eol = command.indexOf("\n", i + 1);
          const line = command.slice(i + 1, eol < 0 ? command.length : eol).replace(/\r$/, "");
          i = eol < 0 ? command.length : eol;
          if (eol < 0 || (tabs ? line.replace(/^\t+/, "") : line) === end) break;
        }
      }
    } else if (c === ">" || c === "<") {
      const before = word?.map((p) => p.text).join("") ?? "";
      const fd = /^(\d+|&)$/.test(before) ? before : "";
      if (fd) word = null;
      else endWord();
      while (command[i + 1] === ">") i++;
      if (command[i + 1] === "&" && /\d/.test(command[i + 2] ?? "")) {
        i += 2;
        continue;
      }
      if (c === ">" && /^(1?|&)$/.test(fd)) seg.hidden = true;
      target = true;
      while (command[i + 1] === " " || command[i + 1] === "\t") i++;
    } else if (c === "&" && next === ">") {
      endWord();
      put("&");
    } else if ((c === "&" || c === "|") && next === c) {
      endSeg(c + c);
      i++;
    } else if (c === "&" || c === "|" || c === ";" || c === "\n" || c === "(" || c === ")") {
      endSeg(c === "\n" || c === "(" || c === ")" ? ";" : c);
    } else if (c === " " || c === "\t" || c === "\r") {
      endWord();
    } else {
      put(c);
    }
  }
  endSeg("");
  return segs.filter((s) => s.words.length);
}

/** Splits arguments into operands and the value each named option took. @param {string[]} args @param {string[]} valued */
function options(args, valued) {
  const operands = [];
  /** @type {Record<string, string[]>} */
  const flags = {};
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === "--") {
      operands.push(...args.slice(i + 1));
      break;
    }
    if (!a.startsWith("-") || a === "-") {
      operands.push(a);
      continue;
    }
    const [name, value] = a.toLowerCase().split("=", 2);
    (flags[name] ??= []).push(value ?? (valued.includes(name) ? args[++i] : ""));
  }
  return { operands: operands.filter((o) => o !== "-"), flags };
}

const valueOf = (flags, names) => names.map((n) => flags[n]?.at(-1)).find((v) => v !== undefined);

/** @param {string[]} args @returns {Printed} */
function content(args) {
  const { operands, flags } = options(args, ["-path", "-literalpath", "-totalcount", "-head", "-first", "-tail", "-last", "-encoding", "-readcount", "-delimiter"]);
  const files = [...operands, ...(flags["-path"] ?? []), ...(flags["-literalpath"] ?? [])];
  const first = valueOf(flags, ["-totalcount", "-head", "-first"]);
  const final = valueOf(flags, ["-tail", "-last"]);
  if (first === undefined && final === undefined) return { files, full: true };
  if (/^\d+$/.test(first ?? "")) return { files, full: false, lines: [1, Number(first)] };
  if (/^\d+$/.test(final ?? "")) return { files, full: false, lines: [-Number(final), Infinity] };
  return { files, full: false };
}

/** The line count head or tail was given, as written (`40`, `+5`), or undefined when it counts bytes. */
function count(flags) {
  if ("-c" in flags || "--bytes" in flags) return undefined;
  const short = Object.keys(flags)
    .map((k) => k.match(/^-n?(\+?\d+)$/)?.[1])
    .find(Boolean);
  return valueOf(flags, ["-n", "--lines"]) ?? short ?? "10";
}

const LINE_FLAGS = ["-n", "-c", "--lines", "--bytes"];

/** @param {string[]} args @returns {Printed} */
function head(args) {
  const { operands, flags } = options(args, LINE_FLAGS);
  const n = count(flags);
  return /^\d+$/.test(n ?? "") ? { files: operands, full: false, lines: [1, Number(n)] } : { files: operands, full: false };
}

/** @param {string[]} args @returns {Printed} */
function tail(args) {
  const { operands, flags } = options(args, LINE_FLAGS);
  const n = count(flags)?.match(/^(\+?)(\d+)$/);
  if (!n) return { files: operands, full: false };
  return { files: operands, full: false, lines: n[1] ? [Number(n[2]), Infinity] : [-Number(n[2]), Infinity] };
}

/** @param {string[]} args @returns {Printed} */
function sedPrint(args) {
  const { operands, flags } = options(args, ["-e", "--expression", "-f", "--file"]);
  if (!["-n", "--quiet", "--silent"].some((f) => f in flags)) return { files: [], full: false };
  const scripts = [...(flags["-e"] ?? []), ...(flags["--expression"] ?? [])];
  const scripted = scripts.length > 0 || "-f" in flags || "--file" in flags;
  const files = scripted ? operands : operands.slice(1);
  const script = !scripted ? operands[0] : scripts.length === 1 && !("-f" in flags) ? scripts[0] : undefined;
  const m = script?.match(/^(\d+)(?:,(\d+|\$))?p$/);
  if (!m) return { files, full: false };
  return { files, full: false, lines: [Number(m[1]), m[2] === "$" ? Infinity : Number(m[2] ?? m[1])] };
}

/** Each command that prints files, by lowercased name, and what it printed of them. */
const PRINTERS = Object.assign(Object.create(null), { cat: content, type: content, gc: content, "get-content": content, head, tail, sed: sedPrint });

/**
 * Whether a line range of a file on disk shows all of it but its YAML frontmatter. A file that is not on disk shows
 * nothing more than its range says.
 * @param {string} path @param {Lines} lines
 */
export function showsBody(path, [first, final]) {
  const file = process.platform === "win32" ? path.replace(/^\/([a-z])\//i, "$1:/") : path;
  if (!existsSync(file)) return false;
  const rows = readFileSync(file, "utf8").split(/\r?\n/);
  if (rows.at(-1) === "") rows.pop();
  const close = rows[0] === "---" ? rows.indexOf("---", 1) : -1;
  const body = close > 0 ? close + 2 : 1;
  const start = first < 0 ? rows.length + first + 1 : first;
  return start <= body && final >= rows.length;
}

const CD = new Set(["cd", "pushd", "chdir", "sl", "set-location", "push-location"]);
const KEYWORDS = new Set(["do", "then", "else", "{", "!", "time"]);
const LOOPS = new Set(["for", "while", "until"]);

/** A path is kept as written when it starts at a root the shell knew and this parser does not. */
function resolve(dir, path) {
  const p = slash(path);
  if (/^([A-Za-z]:\/|\/)/.test(p)) return posix.normalize(p);
  if (/^[~$]/.test(p) || !dir) return p;
  return posix.join(dir, p);
}

/**
 * The files a shell command printed, each whole or in part. It follows `cd`, `NAME=value` and `for` loops within the
 * command, starting from `cwd`; anything it cannot resolve is left relative.
 * A read cut to a known line range carries it as `lines`.
 * @param {string} command @param {string | null | undefined} cwd @returns {ShellRead[]}
 */
export function shellReads(command, cwd) {
  /** @type {ShellRead[]} */
  const reads = [];
  /** @type {Record<string, string>} */
  const vars = {};
  let dir = cwd ? slash(cwd) : null;
  /** @param {Word} w */
  const text = (w) => w.map((p) => (p.literal ? p.text : p.text.replace(/\$\{(\w+)\}|\$(\w+)/g, (m, a, b) => vars[a ?? b] ?? m))).join("");
  /** @param {Segment} seg */
  const argv = (seg) => {
    const all = seg.words.map(text);
    const start = all.findIndex((w) => !KEYWORDS.has(w));
    return start < 0 ? [] : all.slice(start);
  };
  const isAssign = (w) => /^\w+=/.test(w);
  /** The line range a command reading its input prints, when it prints one. @param {Segment | undefined} seg */
  const rangeOf = (seg) => {
    const all = seg ? argv(seg) : [];
    const [name, ...args] = all.slice(Math.max(0, all.findIndex((w) => !isAssign(w))));
    const printed = name ? PRINTERS[name.toLowerCase()]?.(args) : undefined;
    return printed && !printed.files.length ? printed.lines : undefined;
  };
  /** @param {Segment[]} segs */
  const run = (segs) => {
    for (let i = 0; i < segs.length; i++) {
      const seg = segs[i];
      const all = argv(seg);
      if (!all.length) continue;
      const env = all.findIndex((w) => !isAssign(w));
      if (env < 0 || (all[0] === "export" && all.slice(1).every(isAssign))) {
        for (const w of all.filter(isAssign)) vars[w.slice(0, w.indexOf("="))] = w.slice(w.indexOf("=") + 1);
        continue;
      }
      const [name, ...args] = all.slice(env);
      if (name === "for" && args[1] === "in") {
        let depth = 1;
        let end = i + 1;
        for (; end < segs.length; end++) {
          const lead = argv(segs[end])[0];
          if (LOOPS.has(lead)) depth++;
          if (lead === "done" && --depth === 0) break;
        }
        for (const value of args.slice(2)) {
          vars[args[0]] = value;
          run(segs.slice(i + 1, end));
        }
        i = end;
        continue;
      }
      if (CD.has(name.toLowerCase())) {
        const to = args.filter((a) => !a.startsWith("-")).at(-1);
        dir = to ? resolve(dir, to) : null;
        continue;
      }
      const printer = PRINTERS[name.toLowerCase()];
      if (!printer || seg.hidden) continue;
      const printed = printer(args);
      const piped = seg.op === "|";
      const lines = piped ? (printed.files.length === 1 ? rangeOf(segs[i + 1]) : undefined) : printed.lines;
      for (const f of printed.files) reads.push({ path: resolve(dir, f), full: printed.full && !piped, ...(lines && { lines }) });
    }
  };
  run(lex(command));
  return reads;
}
