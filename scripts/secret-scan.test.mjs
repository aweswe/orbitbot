import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { after, describe, it } from "node:test";

const scanner = path.resolve("scripts/secret-scan.mjs");
const roots = [];

function repoWith(files) {
  const root = mkdtempSync(path.join(tmpdir(), "orbit-secret-scan-"));
  roots.push(root);
  execFileSync("git", ["init", "-q"], { cwd: root });
  execFileSync("git", ["config", "user.email", "test@example.test"], { cwd: root });
  execFileSync("git", ["config", "user.name", "test"], { cwd: root });
  for (const [file, content] of Object.entries(files)) {
    const full = path.join(root, file);
    mkdirSync(path.dirname(full), { recursive: true });
    writeFileSync(full, content);
  }
  execFileSync("git", ["add", "-A"], { cwd: root });
  return root;
}

function scan(root) {
  return spawnSync(process.execPath, [scanner, "--json"], {
    cwd: process.cwd(),
    env: { ...process.env, SECRET_SCAN_ROOT: root },
    encoding: "utf8",
  });
}

after(() => {
  for (const root of roots) rmSync(root, { recursive: true, force: true });
});

describe("secret scan", () => {
  it("passes a clean repository", () => {
    const result = scan(repoWith({ "README.md": "Orbit Bot\n" }));
    assert.equal(result.status, 0);
    assert.deepEqual(JSON.parse(result.stdout).findings, []);
  });

  it("detects a synthetic database password without printing it", () => {
    const secret = "s3cret-db-password-value";
    const result = scan(
      repoWith({ "config.ts": `const url = "postgres://user:${secret}@db.example/app";\n` }),
    );
    assert.equal(result.status, 1);
    const findings = JSON.parse(result.stdout).findings;
    assert.equal(findings[0].kind, "postgres-url-password");
    assert.ok(!result.stdout.includes(secret));
    assert.ok(!result.stderr.includes(secret));
  });

  it("detects a provider key", () => {
    const result = scan(repoWith({ "script.ts": `const key = "sk-live_${"a".repeat(24)}";\n` }));
    assert.equal(result.status, 1);
    assert.equal(JSON.parse(result.stdout).findings[0].kind, "provider-key");
  });

  it("allows explicit placeholders", () => {
    const result = scan(
      repoWith({ ".env.example": "DATABASE_URL=postgres://user:password@localhost:5432/orbit\n" }),
    );
    assert.equal(result.status, 0);
  });

  it("rejects a tracked .env file", () => {
    const result = scan(
      repoWith({ ".env": "DATABASE_URL=postgres://user:password@localhost:5432/orbit\n" }),
    );
    assert.equal(result.status, 1);
    assert.equal(JSON.parse(result.stdout).findings[0].kind, "tracked-env-file");
  });

  it("detects a session-cookie artifact without printing it", () => {
    const cookie = `_user_session_=${"a".repeat(40)}`;
    const result = scan(repoWith({ "trace.yaml": `cookie: ${cookie}\n` }));
    assert.equal(result.status, 1);
    assert.equal(JSON.parse(result.stdout).findings[0].kind, "session-cookie");
    assert.ok(!result.stdout.includes(cookie));
  });
});
