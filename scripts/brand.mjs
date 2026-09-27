#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { findCell } from "./chart.mjs";

const ROOT = path.join(import.meta.dirname, "..");
const REPORT = path.join(ROOT, "eval", "parity", "results", "s4", "report.json");
const ASSETS = path.join(ROOT, "docs", "assets");

export const PALETTE = {
  dark: { bg: "#141413", surface: "#1f1e1d", text: "#faf9f5", muted: "#a3a199", hairline: "#33322f", accent: "#d97757" },
  light: { bg: "#faf9f5", surface: "#f0eee6", text: "#141413", muted: "#5e5d59", hairline: "#dedcd1", accent: "#c15f3c" },
};

export const MARK = {
  size: 48,
  bars: [
    { x: 16, y: 6, w: 28, h: 10 },
    { x: 10, y: 19, w: 34, h: 10 },
    { x: 4, y: 32, w: 40, h: 10 },
  ],
};

export const TILES = [
  { id: "B1-mode-sticky", label: "stays in mode" },
  { id: "B7-cite-read", label: "reads what it cites" },
  { id: "B15-playbook-choice", label: "picks the right playbook" },
];

const NAME = "pstack for Claude Code";
const PITCH = "pstack's skills, playbooks and principles, with a hook that checks each step";
const COMPARISON = "this port vs pstack on Cursor, same model";
const REPO = "github.com/EvanBatten/pstack-for-cc";
const SYSTEM_SANS = `-apple-system, "Segoe UI", Inter, Helvetica, Arial, sans-serif`;

const escapeXml = (s) =>
  String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" })[c]);

function markSvg(accent, x, y, size) {
  const scale = size / MARK.size;
  const bars = MARK.bars
    .map((b) => `<rect x="${b.x}" y="${b.y}" width="${b.w}" height="${b.h}" rx="3" fill="${accent}"/>`)
    .join("");
  return `<g transform="translate(${x} ${y}) scale(${scale})">${bars}</g>`;
}

export function renderPreviewHtml(report) {
  const cells = report?.result?.cells;
  if (!Array.isArray(cells)) throw new Error("report.result.cells is missing");
  const p = PALETTE.dark;
  const tiles = TILES.map(({ id, label }) => {
    const port = findCell(cells, id, "B");
    const cursor = findCell(cells, id, "A");
    return `<div class="tile">
      <div class="nums"><span class="port">${port.pass}/${port.applicable}</span><span class="cursor">vs ${cursor.pass}/${cursor.applicable}</span></div>
      <div class="label">${escapeXml(label)}</div>
    </div>`;
  }).join("\n    ");

  return `<!doctype html>
<html><head><meta charset="utf-8">
<title>${escapeXml(NAME)}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@500&display=block" rel="stylesheet">
<style>
*{box-sizing:border-box;margin:0}
html,body{width:1280px;height:640px;overflow:hidden}
body{background:${p.bg};color:${p.text};font-family:Inter,${SYSTEM_SANS};-webkit-font-smoothing:antialiased;font-feature-settings:"tnum" 1}
.card{position:relative;width:1280px;height:640px;padding:80px;display:flex;flex-direction:column}
.card::before{content:"";position:absolute;inset:0;background:radial-gradient(900px 420px at 100% 0%,${p.accent}1f,transparent 70%)}
.card>*{position:relative}
.brand{display:flex;align-items:center;gap:20px}
.brand svg{width:64px;height:64px;flex:none}
.name{font-size:60px;font-weight:700;letter-spacing:-0.025em;line-height:1}
.name span{color:${p.muted};font-weight:500}
.pitch{margin-top:28px;font-size:30px;line-height:1.35;color:${p.muted};max-width:1120px;letter-spacing:-0.01em}
.caption{margin-top:auto;font-size:17px;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;color:${p.muted}}
.tiles{margin-top:16px;display:grid;grid-template-columns:repeat(3,1fr);gap:24px}
.tile{background:${p.surface};border:1px solid ${p.hairline};border-radius:16px;padding:28px}
.nums{display:flex;align-items:baseline;gap:12px;white-space:nowrap}
.port{font-size:60px;font-weight:700;letter-spacing:-0.03em;line-height:1;color:${p.accent}}
.cursor{font-size:26px;font-weight:500;color:${p.muted};white-space:nowrap}
.label{margin-top:14px;font-size:24px;font-weight:500}
.foot{margin-top:28px;display:flex;justify-content:space-between;align-items:center;font-size:20px;color:${p.muted}}
.url{font-family:"JetBrains Mono",ui-monospace,Consolas,monospace;color:${p.text}}
</style></head>
<body><div class="card">
  <div class="brand">
    <svg viewBox="0 0 ${MARK.size} ${MARK.size}" aria-hidden="true">${markSvg(p.accent, 0, 0, MARK.size)}</svg>
    <div class="name">pstack <span>for Claude Code</span></div>
  </div>
  <p class="pitch">${escapeXml(PITCH)}</p>
  <div class="caption">${escapeXml(COMPARISON)}</div>
  <div class="tiles">
    ${tiles}
  </div>
  <div class="foot"><span class="url">${escapeXml(REPO)}</span><span>Parity round s4, passing units over graded units</span></div>
</div></body></html>
`;
}

export function renderBanner(theme) {
  const p = PALETTE[theme];
  if (!p) throw new Error(`unknown banner theme ${theme}`);
  const W = 1600;
  const H = 400;
  const markSize = 88;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-labelledby="t">
<title id="t">${escapeXml(`${NAME}. ${PITCH}`)}</title>
<rect x="1" y="1" width="${W - 2}" height="${H - 2}" rx="24" fill="${p.bg}" stroke="${p.hairline}" stroke-width="2"/>
${markSvg(p.accent, (W - markSize) / 2, 60, markSize)}
<text x="${W / 2}" y="256" text-anchor="middle" font-family='${SYSTEM_SANS}' font-size="92" font-weight="700" letter-spacing="-2" fill="${p.text}">pstack <tspan font-weight="500" fill="${p.muted}">for Claude Code</tspan></text>
<text x="${W / 2}" y="324" text-anchor="middle" font-family='${SYSTEM_SANS}' font-size="34" fill="${p.muted}">${escapeXml(PITCH)}</text>
</svg>
`;
}

const BROWSERS = {
  win32: [
    "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
    "C:/Program Files/Microsoft/Edge/Application/msedge.exe",
    "C:/Program Files/Google/Chrome/Application/chrome.exe",
    "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe",
    path.join(process.env.LOCALAPPDATA ?? "", "Google/Chrome/Application/chrome.exe"),
  ],
  darwin: [
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
    "/Applications/Chromium.app/Contents/MacOS/Chromium",
  ],
  linux: [
    "/usr/bin/google-chrome",
    "/usr/bin/google-chrome-stable",
    "/usr/bin/chromium",
    "/usr/bin/chromium-browser",
    "/usr/bin/microsoft-edge",
    "/snap/bin/chromium",
  ],
};

function pngSize(file) {
  const buf = fs.readFileSync(file);
  if (buf.toString("ascii", 12, 16) !== "IHDR") throw new Error(`${file} is not a PNG`);
  return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
}

function screenshot(htmlPath, pngPath) {
  const browser = (BROWSERS[process.platform] ?? []).find((b) => fs.existsSync(b));
  if (!browser) throw new Error(`no Edge or Chrome found in ${(BROWSERS[process.platform] ?? []).join(", ")}`);
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), "brand-"));
  try {
    execFileSync(browser, [
      "--headless",
      "--disable-gpu",
      "--hide-scrollbars",
      "--force-device-scale-factor=1",
      "--window-size=1280,640",
      "--virtual-time-budget=5000",
      `--user-data-dir=${profile}`,
      `--screenshot=${pngPath}`,
      pathToFileURL(htmlPath).href,
    ], { stdio: "ignore", timeout: 60000 });
  } finally {
    fs.rmSync(profile, { recursive: true, force: true });
  }
  const { width, height } = pngSize(pngPath);
  if (width !== 1280 || height !== 640) throw new Error(`${pngPath} is ${width}x${height}, expected 1280x640`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const report = JSON.parse(fs.readFileSync(REPORT, "utf8"));
  fs.mkdirSync(ASSETS, { recursive: true });
  const files = {
    "social-preview.html": renderPreviewHtml(report),
    "banner-light.svg": renderBanner("light"),
    "banner-dark.svg": renderBanner("dark"),
  };
  for (const [name, text] of Object.entries(files)) {
    fs.writeFileSync(path.join(ASSETS, name), text);
    console.log(`wrote docs/assets/${name}`);
  }
  if (process.argv.includes("--png")) {
    screenshot(path.join(ASSETS, "social-preview.html"), path.join(ASSETS, "social-preview.png"));
    console.log("wrote docs/assets/social-preview.png, 1280x640");
  }
}
