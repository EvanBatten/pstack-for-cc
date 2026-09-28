#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.join(import.meta.dirname, "..");
const DEFAULT_REPORT = path.join(ROOT, "eval", "parity", "results", "s5", "report.json");
const DEFAULT_OUT = path.join(ROOT, "docs", "assets", "head-to-head.svg");

const BEHAVIORS = [
  { id: "B1-mode-sticky", label: "stays in mode" },
  { id: "B7-cite-read", label: "reads what it cites" },
  { id: "B15-playbook-choice", label: "picks the right playbook" },
  { id: "B6-trigger-runs", label: "runs named skills" },
  { id: "B5-step-list", label: "carries the step list" },
  { id: "B3-delegate-mode", label: "delegates follow the mode" },
  { id: "B9-delegated", label: "delegated" },
  { id: "B13b-claim-labels", label: "claim labels" },
];

const ARMS = [
  { id: "B", label: "This port (Claude Code)", cls: "port" },
  { id: "E", label: "pstack-claude (Claude Code)", cls: "plugin" },
  { id: "A", label: "pstack on Cursor", cls: "cursor" },
];

const WIDTH = 800;
const PAD = 32;
const LABEL_COL = 200;
const PLOT_X = PAD + LABEL_COL;
const PLOT_W = WIDTH - PLOT_X - PAD - 52;
const BAR_H = 10;
const BAR_GAP = 4;
const ROW_H = 60;
const ROWS_Y = 132;

const escapeXml = (s) =>
  String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" })[c]);

const num = (n) => String(Math.round(n * 100) / 100);

function barPath(x, y, w, h) {
  const r = Math.min(3, w, h / 2);
  return `M${num(x)} ${num(y)}h${num(w - r)}a${r} ${r} 0 0 1 ${r} ${r}v${num(h - 2 * r)}a${r} ${r} 0 0 1 ${-r} ${r}h${num(-(w - r))}z`;
}

export function findCell(cells, behavior, arm) {
  const cell = cells.find((c) => c.behavior === behavior && c.arm === arm);
  if (!cell || !Number.isInteger(cell.pass) || !Number.isInteger(cell.applicable) || cell.applicable <= 0) {
    throw new Error(`report has no graded cell for behavior ${behavior}, arm ${arm}`);
  }
  return cell;
}

export function renderChart(report) {
  const cells = report?.result?.cells;
  if (!Array.isArray(cells)) throw new Error("report.result.cells is missing");

  const plotBottom = ROWS_Y + BEHAVIORS.length * ROW_H;
  const height = plotBottom + 56;
  const out = [];

  out.push(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${height}" viewBox="0 0 ${WIDTH} ${height}" role="img" aria-labelledby="t">`,
    `<title id="t">Same model, same sealed tasks. Passing units over graded units per behavior, this port against pstack-claude and pstack on Cursor.</title>`,
    `<style>`,
    `text{font-family:-apple-system,"Segoe UI",Helvetica,Arial,sans-serif;fill:#0b0b0b}`,
    `.card{fill:#fcfcfb;stroke:#e4e3df}`,
    `.sub,.tick{fill:#52514e}`,
    `.value{font-variant-numeric:tabular-nums}`,
    `.grid{stroke:#e4e3df}`,
    `.port{fill:#c15f3c}`,
    `.plugin{fill:#2a78d6}`,
    `.cursor{fill:#15936a}`,
    `@media (prefers-color-scheme:dark){`,
    `text{fill:#ffffff}`,
    `.card{fill:#1a1a19;stroke:#33332f}`,
    `.sub,.tick{fill:#c3c2b7}`,
    `.grid{stroke:#33332f}`,
    `.port{fill:#d4714f}`,
    `.plugin{fill:#3987e5}`,
    `.cursor{fill:#1aa39a}`,
    `}`,
    `</style>`,
    `<rect class="card" x="0.5" y="0.5" width="${WIDTH - 1}" height="${height - 1}" rx="12"/>`,
    `<text x="${PAD}" y="46" font-size="20" font-weight="600">${escapeXml("Same model, same sealed tasks")}</text>`,
    `<text class="sub" x="${PAD}" y="70" font-size="13">${escapeXml("Passing units over graded units, parity round s5")}</text>`,
  );

  let legendX = PAD;
  for (const arm of ARMS) {
    out.push(
      `<rect class="${arm.cls}" x="${legendX}" y="93" width="12" height="12" rx="3"/>`,
      `<text x="${legendX + 18}" y="104" font-size="13">${escapeXml(arm.label)}</text>`,
    );
    legendX += Math.round(18 + arm.label.length * 6.4 + 24);
  }

  for (const pct of [0, 25, 50, 75, 100]) {
    const x = num(PLOT_X + (PLOT_W * pct) / 100);
    out.push(
      `<line class="grid" x1="${x}" y1="${ROWS_Y - 8}" x2="${x}" y2="${plotBottom}" stroke-width="1"/>`,
      `<text class="tick" x="${x}" y="${plotBottom + 20}" font-size="12" text-anchor="middle">${pct}%</text>`,
    );
  }

  BEHAVIORS.forEach((behavior, i) => {
    const rowY = ROWS_Y + i * ROW_H;
    const barsTop = rowY + (ROW_H - ARMS.length * BAR_H - (ARMS.length - 1) * BAR_GAP) / 2 - 4;
    out.push(
      `<text x="${PAD}" y="${num(barsTop + (ARMS.length * BAR_H + (ARMS.length - 1) * BAR_GAP) / 2 + 5)}" font-size="14">${escapeXml(behavior.label)}</text>`,
    );
    ARMS.forEach((arm, j) => {
      const { pass, applicable } = findCell(cells, behavior.id, arm.id);
      const y = barsTop + j * (BAR_H + BAR_GAP);
      const w = (PLOT_W * pass) / applicable;
      if (w > 0) out.push(`<path class="${arm.cls}" d="${barPath(PLOT_X, y, w, BAR_H)}"/>`);
      out.push(
        `<text class="value" x="${num(PLOT_X + w + 6)}" y="${num(y + BAR_H - 1)}" font-size="12">${escapeXml(`${pass}/${applicable}`)}</text>`,
      );
    });
  });

  out.push(`</svg>`, "");
  return out.join("\n");
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const reportPath = path.resolve(process.argv[2] ?? DEFAULT_REPORT);
  const outPath = path.resolve(process.argv[3] ?? DEFAULT_OUT);
  const svg = renderChart(JSON.parse(fs.readFileSync(reportPath, "utf8")));
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, svg);
  console.log(`wrote ${path.relative(process.cwd(), outPath)}`);
}
