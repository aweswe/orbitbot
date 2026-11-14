#!/usr/bin/env node
/**
 * `pnpm test` must not read the developer's root `.env`, load root env, or use
 * a live billing control plane. Opt-in canaries declare VERIFY_PROVIDERS.
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

const root = process.cwd();
const roots = ["apps", "packages", "infra", ".agents"];
const offenders = [];

function walk(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === "node_modules" || entry.name === ".git" || entry.name === "dist") continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(full);
      continue;
    }
    if (!/\.test\.(ts|tsx|js|mjs)$/.test(entry.name)) continue;
    const text = readFileSync(full, "utf8");
    if (text.includes("VERIFY_PROVIDERS")) continue;
    const relative = path.relative(root, full);
    if (/readFileSync\s*\(\s*["'`]\.env["'`]/.test(text)) {
      offenders.push(`${relative}: reads the root .env`);
    }
    if (/loadRootEnv\s*\(/.test(text)) {
      offenders.push(`${relative}: loads root env in a test`);
    }
    // `dotenv.parse` is a pure parser and fine in fixtures. Loading config is not.
    if (
      /import\s*\{[^}]*\b(config|configDotenv)\b[^}]*\}\s*from\s*["']dotenv["']/.test(text) ||
      /dotenv\.config\s*\(/.test(text) ||
      /require\s*\(\s*["']dotenv["']\s*\)/.test(text)
    ) {
      offenders.push(`${relative}: loads dotenv config`);
    }
  }
}

for (const dir of roots) {
  const full = path.join(root, dir);
  try {
    if (statSync(full).isDirectory()) walk(full);
  } catch {
    // absent directory
  }
}

if (offenders.length > 0) {
  console.error("Non-hermetic test files found:\n" + offenders.map((o) => `  - ${o}`).join("\n"));
  process.exit(1);
}
console.log("Test hermeticity check: clean");
