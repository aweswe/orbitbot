#!/usr/bin/env node
/**
 * Orbit Bot development commands.
 *
 * Everything here operates only on this checkout and a disposable local
 * PostgreSQL container. It never prints a password or connection URL.
 */
import { execFileSync, spawn, spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import net from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dbPackage = path.join(root, "packages/db");
const require = createRequire(path.join(dbPackage, "package.json"));
const dotenv = require("dotenv");
const { Client } = require("pg");

const CONTAINER = "orbitbot-dev-postgres";
const IMAGE = "pgvector/pgvector:pg17";
const PORT = 55451;
const OWNER = "rakazo";
const OWNER_PASSWORD = "orbitbot_dev_only";
const DATABASE = "orbitbot_dev";
const RUNTIME = "rakazo_dev";
const RUNTIME_PASSWORD = "orbitbot_dev_runtime";
const SCHEMA = "orbit_bot";

const DEV_URLS = {
  migration: `postgres://${OWNER}:${OWNER_PASSWORD}@127.0.0.1:${PORT}/${DATABASE}?schema=${SCHEMA}`,
  runtime: `postgres://${RUNTIME}:${RUNTIME_PASSWORD}@127.0.0.1:${PORT}/${DATABASE}?schema=${SCHEMA}`,
};

function fileEnv() {
  return existsSync(path.join(root, ".env"))
    ? dotenv.parse(readFileSync(path.join(root, ".env")))
    : {};
}
function envWithProcess() {
  return { ...fileEnv(), ...process.env };
}
function log(message) {
  process.stdout.write(`[dev] ${message}\n`);
}
function fail(message) {
  process.stderr.write(`[dev] ${message}\n`);
  process.exitCode = 1;
}

function target(url) {
  const parsed = new URL(url);
  const host = parsed.hostname;
  const local = host === "localhost" || host === "127.0.0.1" || host === "::1";
  const database = decodeURIComponent(parsed.pathname.replace(/^\/+/, ""));
  return {
    local,
    hostKind: local
      ? "local"
      : /pooler/i.test(host)
        ? "pooler"
        : /supabase/i.test(host)
          ? "supabase"
          : "remote",
    port: parsed.port || "5432",
    database,
    schema: parsed.searchParams.get("schema"),
    user: decodeURIComponent(parsed.username),
    sensitive: !local || database === "postgres" || /pooler|supabase/i.test(host),
    redacted: `${local ? host : "remote"}:${parsed.port || "5432"}/${database}?schema=${parsed.searchParams.get("schema") ?? "public"}`,
  };
}

function requireUrl(name, env) {
  const value = env[name]?.trim();
  if (!value) throw new Error(`${name} is required`);
  return value;
}

function connect(url, applicationName = "orbitbot-dev-tools") {
  const info = target(url);
  return new Client({
    connectionString: url,
    ssl: info.local ? undefined : { rejectUnauthorized: false },
    applicationName,
    options: `-c default_transaction_read_only=on -c statement_timeout=20000 -c search_path=${SCHEMA},public`,
  });
}

async function inspect(url) {
  const info = target(url);
  const client = connect(url);
  await client.connect();
  try {
    const q = async (sql, params) => (await client.query(sql, params)).rows;
    const ledger = (
      await q(`select to_regclass('${SCHEMA}._prisma_migrations') is not null as ok`)
    )[0].ok;
    const out = {
      target: info.redacted,
      hostKind: info.hostKind,
      sensitive: info.sensitive,
      version: (await q("show server_version"))[0].server_version,
      role: (
        await q(
          "select current_user as name, rolsuper, rolbypassrls, rolcreaterole, rolcanlogin from pg_roles where rolname = current_user",
        )
      )[0],
      ledger: { exists: ledger },
    };
    if (ledger) {
      out.ledger.total = (
        await q(`select count(*)::int as n from ${SCHEMA}._prisma_migrations`)
      )[0].n;
      out.ledger.finished = (
        await q(
          `select count(*)::int as n from ${SCHEMA}._prisma_migrations where finished_at is not null and rolled_back_at is null`,
        )
      )[0].n;
      out.ledger.failed = (
        await q(
          `select count(*)::int as n from ${SCHEMA}._prisma_migrations where finished_at is null and rolled_back_at is null`,
        )
      )[0].n;
      out.ledger.rolledBack = (
        await q(
          `select count(*)::int as n from ${SCHEMA}._prisma_migrations where rolled_back_at is not null`,
        )
      )[0].n;
      const applied = new Set(
        (
          await q(
            `select migration_name from ${SCHEMA}._prisma_migrations where finished_at is not null and rolled_back_at is null`,
          )
        ).map((row) => row.migration_name),
      );
      const local = readMigrationDirs();
      out.ledger.pending = local.filter((name) => !applied.has(name));
      out.ledger.unknown = [...applied].filter((name) => !local.includes(name));
    }
    out.tables = (
      await q(
        `select count(*)::int as n from information_schema.tables where table_schema='${SCHEMA}' and table_type='BASE TABLE' and table_name <> '_prisma_migrations'`,
      )
    )[0].n;
    out.columns = (
      await q(
        `select count(*)::int as n from information_schema.columns where table_schema='${SCHEMA}' and table_name <> '_prisma_migrations'`,
      )
    )[0].n;
    out.policies = (
      await q(`select count(*)::int as n from pg_policies where schemaname='${SCHEMA}'`)
    )[0].n;
    out.roles = await q(
      `select rolname, rolsuper, rolbypassrls, rolcreaterole, rolcanlogin from pg_roles where rolname in ('${RUNTIME}','rakazo_app') order by 1`,
    );
    const runtimeExists =
      (await q("select 1 from pg_roles where rolname = $1", [RUNTIME])).length > 0;
    out.runtimePrivileges = runtimeExists
      ? await q(`select
      has_schema_privilege('${RUNTIME}','${SCHEMA}','USAGE') as schema_usage,
      has_table_privilege('${RUNTIME}','${SCHEMA}._prisma_migrations','SELECT') as ledger_select,
      has_table_privilege('${RUNTIME}','${SCHEMA}.billing_audit_events','UPDATE') as billing_update`)
      : { missing: true };
    return out;
  } finally {
    await client.end();
  }
}

function readMigrationDirs() {
  const dir = path.join(dbPackage, "prisma/migrations");
  return execFileSync(
    "find",
    [dir, "-mindepth", "1", "-maxdepth", "1", "-type", "d", "-exec", "basename", "{}", ";"],
    { encoding: "utf8" },
  )
    .split("\n")
    .filter(Boolean)
    .sort();
}

async function doctor() {
  const env = envWithProcess();
  const problems = [];
  const warnings = [];
  for (const name of ["BETTER_AUTH_SECRET"]) {
    if (!env[name]?.trim()) problems.push(`${name} is missing`);
  }
  let runtimeUrl = env.DATABASE_URL?.trim();
  let migrationUrl = (env.DATABASE_MIGRATION_URL || env.DATABASE_URL)?.trim();
  if (!runtimeUrl && containerState() === "running") {
    runtimeUrl = DEV_URLS.runtime;
    migrationUrl = DEV_URLS.migration;
    log("using the running dev:up disposable database");
  }
  if (!runtimeUrl) problems.push("DATABASE_URL is missing and the dev:up database is not running");
  migrationUrl = migrationUrl || runtimeUrl;
  if (runtimeUrl) {
    const info = target(runtimeUrl);
    if (info.schema !== SCHEMA) problems.push(`DATABASE_URL must include ?schema=${SCHEMA}`);
    if (info.sensitive)
      warnings.push(
        `DATABASE_URL points at a shared/production-sensitive target (${info.redacted}); use dev:up or ORBIT_TEST_DATABASE_CONFIRM=reset only on a disposable database`,
      );
  }
  if (runtimeUrl && migrationUrl && target(runtimeUrl).user === target(migrationUrl).user) {
    problems.push(
      "DATABASE_URL and DATABASE_MIGRATION_URL use the same login; row-level security is bypassed",
    );
  }
  const provider = (env.PI_DEFAULT_PROVIDER || "").toLowerCase();
  const providerKey = {
    requesty: "REQUESTY_API_KEY",
    openrouter: "OPENROUTER_API_KEY",
    anthropic: "ANTHROPIC_API_KEY",
    openai: "OPENAI_API_KEY",
    deepseek: "DEEPSEEK_API_KEY",
    gemini: "GEMINI_API_KEY",
  }[provider];
  if (providerKey && !env[providerKey]?.trim())
    warnings.push(`${providerKey} is missing for PI_DEFAULT_PROVIDER=${provider}`);
  if (!runtimeUrl) {
    warnings.push("database checks skipped: no DATABASE_URL");
  } else {
    try {
      const state = await inspect(migrationUrl);
      log(`database ${state.target} (${state.hostKind}) PostgreSQL ${state.version}`);
      log(
        `ledger ${state.ledger.finished ?? 0} finished, ${state.ledger.pending?.length ?? 0} pending, ${state.ledger.rolledBack ?? 0} rolled back`,
      );
      log(
        `schema ${state.tables} tables, ${state.columns} columns, ${state.policies} RLS policies`,
      );
      if (state.ledger.pending?.length)
        warnings.push(`pending migrations: ${state.ledger.pending.join(", ")}`);
      if (state.role.rolbypassrls)
        warnings.push(`current login ${state.role.name} bypasses row-level security`);
    } catch (error) {
      problems.push(`database is not reachable: ${error.message}`);
    }
  }
  const ports = [Number(env.API_PORT || 3100), Number(env.WEB_PORT || 5173)];
  for (const port of ports) {
    if (await portInUse(port)) warnings.push(`port ${port} is already in use`);
  }
  const scan = spawnSync(process.execPath, [path.join(root, "scripts/secret-scan.mjs")], {
    cwd: root,
    encoding: "utf8",
  });
  if (scan.status !== 0) {
    problems.push(
      "secret scan found high-confidence credentials; run node scripts/secret-scan.mjs",
    );
    for (const line of `${scan.stdout}${scan.stderr}`
      .split("\n")
      .filter((entry) => entry.trim().startsWith("  "))) {
      log(line);
    }
  }
  for (const message of warnings) log(`WARN ${message}`);
  for (const message of problems) fail(`FAIL ${message}`);
  if (!problems.length) log("doctor: OK");
}

function portInUse(port) {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once("error", () => resolve(true));
    server.listen(port, "127.0.0.1", () => server.close(() => resolve(false)));
  });
}

function scanTrackedFiles() {
  const findings = [];
  const files = execFileSync("git", ["-C", root, "ls-files", "-z"], { encoding: "utf8" })
    .split("\0")
    .filter(Boolean);
  const placeholder =
    /^(pass|password|test|example|changeme|synthetic|dummy|redacted|placeholder|postgres|rakazo|user)$/i;
  for (const file of files) {
    if (/(^|\/)\.env(\.local|\.development|\.production|\.test|\.staging)?$/.test(file)) {
      findings.push(`${file}: tracked env file`);
      continue;
    }
    let text;
    try {
      text = readFileSync(path.join(root, file), "utf8");
    } catch {
      continue;
    }
    if (text.includes("\0")) continue;
    text.split("\n").forEach((line, index) => {
      for (const match of line.matchAll(/postgres(?:ql)?:\/\/[^\s]+/g)) {
        try {
          const parsed = new URL(match[0].replace(/[.,);'"]+$/, ""));
          if (
            parsed.password &&
            !placeholder.test(decodeURIComponent(parsed.password)) &&
            !/example|placeholder|redacted|synthetic/i.test(decodeURIComponent(parsed.password))
          ) {
            findings.push(`${file}:${index + 1}: postgres-url-password`);
          }
        } catch {}
      }
      if (
        /(?:^|[;\s"'])_user_session_=[A-Za-z0-9._~-]{20,}|eyJhbGciOiJkaXIi[A-Za-z0-9._~-]{20,}/.test(
          line,
        )
      )
        findings.push(`${file}:${index + 1}: session-cookie`);
      if (
        /\b(?:AKIA[0-9A-Z]{16}|sk-(?:live_)?[A-Za-z0-9]{20,}|dop_v1_[a-f0-9]{40,}|ghp_[A-Za-z0-9]{30,})\b/.test(
          line,
        )
      )
        findings.push(`${file}:${index + 1}: provider-key`);
    });
  }
  return { findings };
}

function run(command, args, env = process.env) {
  const result = spawnSync(command, args, { cwd: root, env, stdio: "inherit" });
  if (result.status !== 0) throw new Error(`${command} exited with ${result.status}`);
}

function ensureDocker() {
  const result = spawnSync("docker", ["version", "--format", "{{.Server.Version}}"], {
    encoding: "utf8",
  });
  if (result.status !== 0) throw new Error("Docker is not running");
}

function containerState() {
  const result = spawnSync("docker", ["inspect", "-f", "{{.State.Running}}", CONTAINER], {
    encoding: "utf8",
  });
  if (result.status !== 0) return "missing";
  return result.stdout.trim() === "true" ? "running" : "stopped";
}

async function startContainer() {
  ensureDocker();
  const state = containerState();
  if (state === "missing") {
    log(`starting ${CONTAINER}`);
    run("docker", [
      "run",
      "-d",
      "--name",
      CONTAINER,
      "--restart",
      "unless-stopped",
      "-e",
      `POSTGRES_USER=${OWNER}`,
      "-e",
      `POSTGRES_PASSWORD=${OWNER_PASSWORD}`,
      "-e",
      `POSTGRES_DB=${DATABASE}`,
      "-p",
      `127.0.0.1:${PORT}:5432`,
      IMAGE,
      "postgres",
      "-c",
      "fsync=off",
      "-c",
      "synchronous_commit=off",
      "-c",
      "full_page_writes=off",
      "-c",
      "max_connections=500",
    ]);
  } else if (state === "stopped") {
    run("docker", ["start", CONTAINER]);
  }
  for (let attempt = 0; attempt < 60; attempt += 1) {
    if (spawnSync("docker", ["exec", CONTAINER, "pg_isready", "-q", "-U", OWNER]).status === 0)
      return;
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(`${CONTAINER} did not become ready`);
}

function devEnv(extra = {}) {
  return {
    ...process.env,
    ...fileEnv(),
    DATABASE_URL: DEV_URLS.runtime,
    DATABASE_MIGRATION_URL: DEV_URLS.migration,
    REALTIME_DATABASE_URL: DEV_URLS.runtime,
    ...extra,
  };
}

function migrate() {
  log("generating the Prisma client");
  run("pnpm", ["db:generate"], devEnv());
  log("applying migrations to the disposable database");
  run("pnpm", ["db:migrate"], devEnv());
}

async function up(args) {
  await startContainer();
  migrate();
  if (args.includes("--no-app")) return;
  log("starting API, worker, web and supervisor (Ctrl-C keeps the database running)");
  const child = spawn("node", ["scripts/dev.mjs"], {
    cwd: root,
    stdio: "inherit",
    env: devEnv({
      AGENT_RUNTIME: args.includes("--live-providers")
        ? process.env.AGENT_RUNTIME || "pi"
        : "scripted",
      SANDBOX_PROVIDER: args.includes("--live-providers")
        ? process.env.SANDBOX_PROVIDER || "desktop"
        : "fake",
    }),
  });
  for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => child.kill(signal));
  const [code, signal] = await new Promise((resolve) =>
    child.once("exit", (...outcome) => resolve(outcome)),
  );
  if (!signal) process.exitCode = code ?? 1;
}

function down() {
  if (containerState() === "missing") {
    log(`${CONTAINER} is not running`);
    return;
  }
  run("docker", ["stop", CONTAINER]);
  log(`${CONTAINER} stopped; data remains in the container`);
}

async function status() {
  log(`container ${CONTAINER}: ${containerState()}`);
  const env = envWithProcess();
  try {
    const state = await inspect(env.DATABASE_MIGRATION_URL || env.DATABASE_URL);
    log(
      `database ${state.target}: ${state.tables} tables, ${state.ledger.pending?.length ?? 0} pending migrations`,
    );
  } catch (error) {
    log(`database: ${error.message}`);
  }
  for (const [name, port] of [
    ["api", Number(env.API_PORT || 3100)],
    ["web", Number(env.WEB_PORT || 5173)],
  ]) {
    log(`${name} port ${port}: ${(await portInUse(port)) ? "in use" : "free"}`);
  }
  const ps = spawnSync("ps", ["-axo", "pid=,command="], { encoding: "utf8" }).stdout;
  for (const name of ["apps/api/src/index.ts", "apps/worker/src/index.ts", "apps/web"]) {
    const matching = ps.split("\n").filter((line) => line.includes(root) && line.includes(name));
    log(`${name}: ${matching.length ? `${matching.length} process(es)` : "not running"}`);
  }
}

function logs(args) {
  const tail = args.includes("--tail") ? args[args.indexOf("--tail") + 1] : "100";
  if (containerState() !== "missing") run("docker", ["logs", "--tail", tail, CONTAINER]);
  const dataDir = path.join(root, "data");
  if (existsSync(dataDir)) {
    const logDir = path.join(dataDir, "logs");
    if (existsSync(logDir)) log(`logs are under ${logDir}`);
  }
}

async function verifyDb() {
  const env = envWithProcess();
  const url = env.DATABASE_MIGRATION_URL || env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_MIGRATION_URL is required");
  const state = await inspect(url);
  log(JSON.stringify(state, null, 2));
  const problems = [];
  if (!state.ledger.exists) problems.push("no Prisma migration ledger");
  if (state.ledger.pending?.length)
    problems.push(`pending migrations: ${state.ledger.pending.join(", ")}`);
  if (state.ledger.unknown?.length)
    problems.push(`ledger names missing locally: ${state.ledger.unknown.join(", ")}`);
  if (state.policies === 0) problems.push("no RLS policies");
  if (state.sensitive) problems.push(`target is production-sensitive (${state.target})`);
  for (const message of problems) fail(`FAIL ${message}`);
  if (!problems.length) log("verify-db: OK");
}

function resetTestData() {
  const env = envWithProcess();
  const url = env.DATABASE_MIGRATION_URL;
  if (!url) throw new Error("DATABASE_MIGRATION_URL is required");
  const info = target(url);
  if (env.ORBIT_TEST_DATABASE_CONFIRM !== "reset")
    throw new Error(
      "set ORBIT_TEST_DATABASE_CONFIRM=reset to confirm resetting a disposable database",
    );
  if (!info.local) throw new Error("reset-test-data refuses a non-local database");
  if (info.schema !== SCHEMA) throw new Error(`reset-test-data requires ?schema=${SCHEMA}`);
  if (!/(test|dev|phase12|disposable)/i.test(info.database))
    throw new Error("database name must contain test, dev, phase12 or disposable");
  log(`resetting ${info.redacted}`);
  const client = new Client({ connectionString: url });
  const sql = `DROP SCHEMA IF EXISTS ${SCHEMA} CASCADE; DROP SCHEMA IF EXISTS graphile_worker CASCADE; DROP SCHEMA IF EXISTS rakazo_private CASCADE;`;
  const result = spawnSync(
    "node",
    [
      "-e",
      `const {Client}=require(${JSON.stringify(require.resolve("pg"))});(async()=>{const c=new Client({connectionString:process.env.DATABASE_MIGRATION_URL});await c.connect();await c.query(${JSON.stringify(sql)});await c.end();})()`,
    ],
    {
      cwd: root,
      stdio: "inherit",
      env: { ...process.env, DATABASE_MIGRATION_URL: url },
    },
  );
  if (result.status !== 0) throw new Error("reset failed");
  void client;
  migrate();
}

async function main() {
  const [command, ...args] = process.argv.slice(2);
  const commands = {
    doctor,
    up: () => up(args),
    down,
    status,
    logs: () => logs(args),
    test: () => test(args),
    "verify-db": verifyDb,
    "reset-test-data": resetTestData,
  };
  const action = commands[command];
  if (!action) {
    process.stderr.write(
      `Usage: node scripts/dev-tools.mjs <${Object.keys(commands).join("|")}>\n`,
    );
    process.exitCode = 2;
    return;
  }
  await action();
}

async function test(args) {
  if (args.includes("--integration")) {
    await startContainer();
    migrate();
    const result = spawnSync("pnpm", ["test:integration"], {
      cwd: root,
      stdio: "inherit",
      env: { ...devEnv(), CI_POSTGRES_URL: DEV_URLS.migration },
    });
    process.exitCode = result.status ?? 1;
    return;
  }
  const result = spawnSync("pnpm", ["test"], { cwd: root, stdio: "inherit", env: devEnv() });
  process.exitCode = result.status ?? 1;
}

main().catch((error) => {
  fail(error.message);
  process.exitCode = 1;
});
