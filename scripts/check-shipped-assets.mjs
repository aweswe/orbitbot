#!/usr/bin/env node
/**
 * Closed-source release gate: no unlicensed font binaries and no source maps in
 * shipped artifacts. Run after a production build; safe when build dirs are absent.
 */
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

const blockedNames = ["corpta demo.otf", "aeonik-medium.woff"];
const blockedHashes = new Set([
  "dd039d7b41291ff741bb3b301720980ea44a0f5d4752d1321bdec544833130d0",
  "cfa52bfb7c9df5b5d37bec72d115f232aec6b5c5f119354759e0eb115531df40",
]);
const buildDirs = [
  "apps/web/dist",
  "apps/desktop/out",
  "apps/www/dist",
  "apps/api/dist",
  "apps/worker/dist",
];

const problems = [];

for (const tracked of execFileSync("git", ["ls-files"], { encoding: "utf8" }).split("\n")) {
  const base = path.basename(tracked).toLowerCase();
  if (blockedNames.includes(base)) problems.push(`tracked unlicensed font: ${tracked}`);
}

function walk(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(full);
      continue;
    }
    if (entry.name.endsWith(".map")) {
      problems.push(`source map in shipped artifact: ${full}`);
      continue;
    }
    const base = entry.name.toLowerCase();
    if (blockedNames.includes(base)) {
      problems.push(`unlicensed font in shipped artifact: ${full}`);
      continue;
    }
    if (!/\.(otf|ttf|woff2?)$/.test(base)) continue;
    const digest = createHash("sha256").update(readFileSync(full)).digest("hex");
    if (blockedHashes.has(digest)) problems.push(`blocked font hash: ${full}`);
  }
}

for (const dir of buildDirs) {
  if (existsSync(dir) && statSync(dir).isDirectory()) walk(dir);
}

if (problems.length > 0) {
  console.error("Shipped-asset check failed:\n" + problems.map((p) => `  - ${p}`).join("\n"));
  process.exit(1);
}
console.log("Shipped-asset check: clean");
