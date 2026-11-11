#!/usr/bin/env node
/**
 * Orbit Bot secret scanner.
 *
 * Scans tracked or staged text files for high-confidence credentials and never
 * prints the matched value.
 *
 *   node scripts/secret-scan.mjs
 *   node scripts/secret-scan.mjs --staged
 *   node scripts/secret-scan.mjs --json
 */
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const args = process.argv.slice(2);
const root = resolve(process.env.SECRET_SCAN_ROOT || process.cwd());
const staged = args.includes("--staged");
const json = args.includes("--json");

const PLACEHOLDER =
  /^(?:pass|password|test|example|changeme|synthetic|dummy|redacted|placeholder|postgres|rakazo|orbit|user|secret|pw)$/i;
const URL_PATTERN = /postgres(?:ql)?:\/\/\S+/g;
const PRIVATE_KEY = /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/;
const PROVIDER_KEY =
  /\b(?:AKIA[0-9A-Z]{16}|sk-(?:live_)?[A-Za-z0-9]{20,}|dop_v1_[a-f0-9]{40,}|ghp_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{30,}|AIza[0-9A-Za-z_-]{30,})\b/;
const BEARER = /\bAuthorization\s*:\s*Bearer\s+([A-Za-z0-9._~-]{30,})/i;
const SESSION_COOKIE =
  /(?:^|[;\s"'])_user_session_=[A-Za-z0-9._~-]{20,}|eyJhbGciOiJkaXIi[A-Za-z0-9._~-]{20,}/;
const ASSIGNMENT =
  /\b(?:BETTER_AUTH_SECRET|ENCRYPTION_KEY|REQUESTY_API_KEY|GEMINI_API_KEY|E2B_API_KEY|FORION_API_KEY|FORION_ORBIT_INTERNAL_SECRET|GOOGLE_CLIENT_SECRET|SANDBOX_SUPERVISOR_TOKEN|SCREEN_PROXY_SECRET)\b\s*[:=]\s*["'`]([^"'`\n]{20,})["'`]/;
const FORBIDDEN_ENV = new Set([
  ".env",
  ".env.local",
  ".env.development",
  ".env.production",
  ".env.test",
  ".env.staging",
]);
// Reviewed fixtures: test/smoke files and the self-host compose examples contain
// deliberately synthetic values. Production source is still scanned.
const REVIEWED_FIXTURE =
  /(?:^|\/)[^/]+\.(?:test|spec)\.(?:ts|tsx|js|mjs|py)$|(?:^|\/)[^/]+\.smoke\.sh$|^infra\/compose\/|^packages\/testkit\/src\/|^apps\/api\/src\/env\.test\.ts$|^apps\/worker\/src\/secret-store\.test\.ts$/;
const BINARY_EXT =
  /\.(?:png|jpe?g|webp|avif|ico|icns|gif|bmp|tiff?|otf|ttf|woff2?|eot|pdf|zip|gz|tgz|mp[34]|mov|webm|wav|ogg)$/i;

function isPlaceholder(value) {
  const v = String(value ?? "").trim();
  if (!v) return true;
  if (PLACEHOLDER.test(v)) return true;
  if (v === "…" || v === "..." || /^[•*]+$/.test(v)) return true;
  if (/^(?:REPLACE|CHANGE|YOUR_|EXAMPLE|<|\$\{|\*\*\*|\[)/i.test(v)) return true;
  if (
    /(?:placeholder|example|redacted|synthetic|change[_-]?me|test-secret|test-encryption)/i.test(v)
  )
    return true;
  return false;
}

function lineFinding(line) {
  // A documented shell substitution is not a literal credential.
  if (/\$\(|\$\{/.test(line)) return null;
  if (SESSION_COOKIE.test(line)) return { kind: "session-cookie" };
  for (const match of line.matchAll(URL_PATTERN)) {
    const raw = match[0].replace(/[.,);'"]+$/, "");
    try {
      const parsed = new URL(raw);
      if (parsed.password && !isPlaceholder(decodeURIComponent(parsed.password))) {
        return { kind: "postgres-url-password" };
      }
    } catch {}
  }
  if (PRIVATE_KEY.test(line)) return { kind: "private-key" };
  if (PROVIDER_KEY.test(line)) {
    const value = line.match(PROVIDER_KEY)?.[0] ?? "";
    if (!isPlaceholder(value)) return { kind: "provider-key" };
  }
  const bearer = line.match(BEARER)?.[1];
  if (bearer && !isPlaceholder(bearer)) return { kind: "bearer-token" };
  const assigned = line.match(ASSIGNMENT)?.[1];
  if (assigned && !isPlaceholder(assigned)) return { kind: "secret-assignment" };
  return null;
}

function filesToScan() {
  if (staged) {
    const raw = execFileSync(
      "git",
      ["-C", root, "diff", "--cached", "--name-only", "--diff-filter=ACMRTUXB", "-z"],
      { encoding: "utf8" },
    );
    return raw
      .split("\0")
      .filter(Boolean)
      .map((file) => ({
        file,
        content: BINARY_EXT.test(file)
          ? ""
          : execFileSync("git", ["-C", root, "show", `:${file}`], {
              encoding: "utf8",
              maxBuffer: 64 * 1024 * 1024,
            }),
      }));
  }
  const raw = execFileSync("git", ["-C", root, "ls-files", "-z"], { encoding: "utf8" });
  return raw
    .split("\0")
    .filter(Boolean)
    .map((file) => {
      try {
        return { file, content: readFileSync(resolve(root, file), "utf8") };
      } catch {
        return { file, content: "" };
      }
    });
}

const findings = [];
for (const { file, content } of filesToScan()) {
  const base = file.split("/").pop();
  if (FORBIDDEN_ENV.has(base)) {
    findings.push({ file, line: 1, kind: "tracked-env-file" });
    continue;
  }
  if (REVIEWED_FIXTURE.test(file) || BINARY_EXT.test(file)) continue;
  if (content.includes("\0") || content.includes("�")) continue;
  const lines = content.split("\n");
  for (let i = 0; i < lines.length; i += 1) {
    const found = lineFinding(lines[i]);
    if (found) findings.push({ file, line: i + 1, kind: found.kind });
  }
}

if (json) {
  console.log(JSON.stringify({ root, staged, findings }, null, 2));
} else if (findings.length === 0) {
  console.log(
    `[secret-scan] OK — ${staged ? "staged" : "tracked"} files contain no high-confidence hardcoded credentials.`,
  );
} else {
  console.error(`[secret-scan] FAILED — ${findings.length} finding(s):`);
  for (const finding of findings)
    console.error(`  ${finding.file}:${finding.line}  ${finding.kind}`);
  console.error("[secret-scan] Values are intentionally not printed.");
}
process.exitCode = findings.length === 0 ? 0 : 1;
