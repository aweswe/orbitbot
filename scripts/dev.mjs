#!/usr/bin/env node
// `pnpm dev`: start the API, worker, web app, and sandbox supervisor for this checkout.
//
// Several checkouts (git worktrees) can run at once. Each gets the first free block of ports,
// and all of them share one Postgres database unless this branch adds migrations that main
// does not have; those run against a database of the branch's own on the same server, so
// unmerged schema changes never reach the shared one.
//
// The database is `.env`'s DATABASE_URL when it accepts a connection. Otherwise a local
// Postgres container (`rakazo-dev-postgres`) is started and reused by every checkout.
// Setting WEB_PORT or API_PORT, in the shell or `.env`, turns off port selection. A relative
// DATA_DIR resolves in the main checkout, so checkouts sharing the database share its files.
// Branch databases, and their copied files, are dropped once the branch is deleted or merged.
//
// RAKAZO_DEV_TAILNET=1 also serves the web app over HTTPS to your other Tailscale devices, at
// https://<this machine>.<tailnet>.ts.net:<web port>. Everything still listens on loopback; the
// Tailscale daemon forwards to it, so only devices signed in to your tailnet can reach it.
import { execFileSync, spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { setDefaultResultOrder } from "node:dns";
import {
  constants,
  cpSync,
  existsSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
} from "node:fs";
import { createRequire } from "node:module";
import net from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { runPnpm, spawnPnpm } from "./pnpm.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dbPackage = path.join(root, "packages/db");
const require = createRequire(path.join(dbPackage, "package.json"));
const { Client } = require("pg");
const dotenv = require("dotenv");

const DEFAULT_PORTS = { web: 5173, api: 3100, supervisor: 7091 };
const PORT_STEP = 10;
/** Explicit staging runs use the configured database instead of a per-branch copy. */
const useConfiguredSharedDatabase = /^(1|true)$/i.test(
  process.env.ORBIT_DEV_SHARED_DB ?? "",
);
// Keep every local URL and bind on the same hostname so cookies, auth origins, and the Vite
// proxy agree. Use localhost rather than a mix of localhost and 127.0.0.1. Prefer IPv4 for
// localhost so macOS's IPv6-first resolution cannot bind the API where the proxy cannot reach it.
const LOCAL_HOST = "localhost";
setDefaultResultOrder("ipv4first");
const MANAGED = {
  container: "rakazo-dev-postgres",
  image: "postgres:18",
  port: 54318,
  owner: "rakazo",
  runtime: "rakazo_dev",
  database: "rakazo",
};
const TAILSCALE_APP_CLI = "/Applications/Tailscale.app/Contents/MacOS/Tailscale";
const SERVICES = [
  "@forion/orbit-api",
  "@forion/orbit-worker",
  "@forion/orbit-web",
  "@forion/orbit-sandbox-supervisor",
];

const fileEnv = existsSync(path.join(root, ".env"))
  ? dotenv.parse(readFileSync(path.join(root, ".env")))
  : {};
const setting = (name) => process.env[name] ?? fileEnv[name];
const log = (message) => process.stdout.write(`[dev] ${message}\n`);

// A command that runs another with secrets added to its environment, such as a secrets manager's
// `run --`. Values it adds win over `.env`.
const runWith = setting("RAKAZO_DEV_RUN_WITH")?.trim();
if (runWith && !setting("RAKAZO_DEV_RUNNING_WITH")) {
  const [command, ...args] = runWith.split(/\s+/);
  const self = [process.execPath, fileURLToPath(import.meta.url), ...process.argv.slice(2)];
  const wrapper = spawn(command, [...args, ...self], {
    stdio: "inherit",
    env: { ...process.env, RAKAZO_DEV_RUNNING_WITH: "1" },
  });
  for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => wrapper.kill(signal));
  const [code, signal] = await new Promise((resolve, reject) => {
    wrapper.once("error", (error) =>
      reject(new Error(`RAKAZO_DEV_RUN_WITH could not start ${command}`, { cause: error })),
    );
    wrapper.once("exit", (...outcome) => resolve(outcome));
  });
  if (!signal) process.exit(code ?? 1);
  process.removeAllListeners(signal);
  process.kill(process.pid, signal);
  await new Promise(() => {});
}

function run(command, args, options = {}) {
  return execFileSync(command, args, { encoding: "utf8", stdio: "pipe", ...options }).trim();
}

function portFreeOn(port, host) {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once("error", (error) =>
      resolve(error.code === "EADDRNOTAVAIL" || error.code === "EAFNOSUPPORT"),
    );
    server.listen(port, host, () => server.close(() => resolve(true)));
  });
}

async function portFree(port) {
  // A service bound to localhost may use either loopback family. Check both so a port
  // already occupied on IPv6 is not selected for an IPv4 listener, or vice versa.
  const [ipv4, ipv6] = await Promise.all([portFreeOn(port, "127.0.0.1"), portFreeOn(port, "::1")]);
  return ipv4 && ipv6;
}

async function choosePorts() {
  for (let block = 0; block < 50; block += 1) {
    const ports = Object.fromEntries(
      Object.entries(DEFAULT_PORTS).map(([name, port]) => [name, port + block * PORT_STEP]),
    );
    const free = await Promise.all(Object.values(ports).map(portFree));
    if (free.every(Boolean)) return ports;
  }
  throw new Error("No free port block found near the defaults. Set WEB_PORT and API_PORT in .env.");
}

function portEnv({ web, api, supervisor }) {
  const webUrl = `http://${LOCAL_HOST}:${web}`;
  const apiUrl = `http://${LOCAL_HOST}:${api}`;
  return {
    WEB_PORT: String(web),
    WEB_ORIGIN: webUrl,
    BETTER_AUTH_URL: webUrl,
    API_PORT: String(api),
    API_HOST: LOCAL_HOST,
    API_URL: apiUrl,
    API_PROXY_TARGET: apiUrl,
    SUPERVISOR_PORT: String(supervisor),
    SUPERVISOR_HOST: LOCAL_HOST,
    SANDBOX_SUPERVISOR_URL: `http://${LOCAL_HOST}:${supervisor}`,
    RAKAZO_DEV_HOST: LOCAL_HOST,
  };
}

async function connects(url) {
  const client = new Client({ connectionString: url, connectionTimeoutMillis: 2000 });
  try {
    await client.connect();
    return true;
  } catch {
    return false;
  } finally {
    await client.end().catch(() => {});
  }
}

function withDatabase(url, database) {
  const parsed = new URL(url);
  parsed.pathname = `/${database}`;
  return parsed.toString();
}

async function startManagedPostgres() {
  try {
    run("docker", ["version", "--format", "{{.Server.Version}}"]);
  } catch {
    throw new Error(
      "DATABASE_URL in .env does not accept a connection and Docker is not running to start a local Postgres.",
    );
  }
  const state = (() => {
    try {
      return run("docker", ["inspect", "--format", "{{.State.Running}}", MANAGED.container]);
    } catch {
      return null;
    }
  })();
  if (state === null) {
    log(`Starting a shared Postgres container (${MANAGED.container})`);
    run("docker", [
      "run",
      "-d",
      "--name",
      MANAGED.container,
      "--restart",
      "unless-stopped",
      "-e",
      `POSTGRES_USER=${MANAGED.owner}`,
      // Development only: the container is published on loopback and holds throwaway data.
      "-e",
      `POSTGRES_PASSWORD=${MANAGED.owner}`,
      "-e",
      `POSTGRES_DB=${MANAGED.database}`,
      "-p",
      `127.0.0.1:${MANAGED.port}:5432`,
      "-v",
      `${MANAGED.container}:/var/lib/postgresql`,
      MANAGED.image,
    ]);
  } else if (state !== "true") {
    run("docker", ["start", MANAGED.container]);
  }
  for (let attempt = 0; attempt < 60; attempt += 1) {
    try {
      run("docker", ["exec", MANAGED.container, "pg_isready", "-q", "-U", MANAGED.owner]);
      break;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  }
  const server = `${LOCAL_HOST}:${MANAGED.port}`;
  const ownerUrl = `postgres://${MANAGED.owner}:${MANAGED.owner}@${server}/${MANAGED.database}?schema=orbit_bot`;
  // initdb briefly starts a server during bootstrap, then stops and starts it again.
  // pg_isready can succeed in that window, so require a real connection too.
  let ready = false;
  for (let attempt = 0; attempt < 120; attempt += 1) {
    if (await connects(ownerUrl)) {
      ready = true;
      break;
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  if (!ready) throw new Error(`Postgres at ${server} did not accept a connection`);
  return {
    url: `postgres://${MANAGED.runtime}:${MANAGED.runtime}@${server}/${MANAGED.database}?schema=orbit_bot`,
    migrationUrl: ownerUrl,
  };
}

function loginOf(url) {
  try {
    return new URL(url).username;
  } catch {
    return "";
  }
}

async function sharedDatabase() {
  const url = setting("DATABASE_URL");
  const migrationUrl = setting("DATABASE_MIGRATION_URL") || url;
  if (useConfiguredSharedDatabase) {
    if (!url || !migrationUrl) {
      throw new Error("ORBIT_DEV_SHARED_DB requires DATABASE_URL and DATABASE_MIGRATION_URL");
    }
    log("Using the configured shared database; account data is shared with every client.");
    return { url, migrationUrl };
  }
  if (url && loginOf(url) === loginOf(migrationUrl)) {
    log(
      "DATABASE_URL and DATABASE_MIGRATION_URL use the same login; using the local container so migrations run with a separate owner",
    );
    return startManagedPostgres();
  }
  if (url && (await connects(migrationUrl))) return { url, migrationUrl };
  if (url) log("DATABASE_URL in .env does not accept a connection; using the local container");
  return startManagedPostgres();
}

function migrationNames(ref) {
  return new Set(
    run("git", ["ls-tree", "--name-only", ref, "packages/db/prisma/migrations/"], { cwd: root })
      .split("\n")
      .filter(Boolean)
      .map((entry) => path.basename(entry)),
  );
}

function mainMigrations() {
  try {
    return migrationNames("origin/main");
  } catch {
    // Without main to compare against, any migration may be unmerged.
    throw new Error("Could not read origin/main. Run `git fetch origin main` and try again.");
  }
}

/** Migration folders in a checkout's working tree, committed or not. */
function checkoutMigrations(checkout) {
  const dir = path.join(checkout, "packages/db/prisma/migrations");
  if (!existsSync(dir)) return new Set();
  return new Set(readdirSync(dir).filter((name) => statSync(path.join(dir, name)).isDirectory()));
}

/** Migrations in this checkout that origin/main does not have. */
function branchOnlyMigrations(onMain) {
  return [...checkoutMigrations(root)].filter((name) => !onMain.has(name));
}

/** A branch's migrations: its worktree's files when it is checked out, else its commits. */
function branchMigrations(branch) {
  const worktrees = run("git", ["worktree", "list", "--porcelain"], { cwd: root }).split("\n\n");
  for (const entry of worktrees) {
    const lines = entry.split("\n");
    if (lines.includes(`branch refs/heads/${branch}`)) {
      return checkoutMigrations(lines[0].replace(/^worktree /, ""));
    }
  }
  try {
    return migrationNames(`refs/heads/${branch}`);
  } catch {
    return new Set(); // Deleted.
  }
}

// Marks a finished branch database and records which repository and branch own it.
const BRANCH_DATABASE_COMMENT = "rakazo dev branch: ";

function branchDatabaseComment(branch) {
  return BRANCH_DATABASE_COMMENT + JSON.stringify({ repo: repositoryId(), branch });
}

function repositoryId() {
  return path.resolve(root, run("git", ["rev-parse", "--git-common-dir"], { cwd: root }));
}

function currentBranch() {
  return run("git", ["rev-parse", "--abbrev-ref", "HEAD"], { cwd: root });
}

/** `<shared>_<branch>_<hash>`, within Postgres's 63-byte limit on names. */
function branchDatabaseName(sharedName, branch) {
  // Distinct branches can clean up to the same name; the hash keeps their databases apart.
  const hash = createHash("sha256").update(branch).digest("hex").slice(0, 8);
  const readable = branch
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  const prefix = `${sharedName}_${readable}`.slice(0, 63 - hash.length - 1).replace(/_+$/, "");
  return `${prefix}_${hash}`;
}

/** A branch database's files, kept apart so deleting one never removes a file main still uses. */
function branchDataDir(sharedDataDir, name) {
  return path.join(path.dirname(sharedDataDir), ".rakazo-dev-branches", name, "data");
}

async function branchDatabase(shared, sharedDataDir) {
  const sharedName = new URL(shared.migrationUrl).pathname.slice(1);
  const branch = currentBranch();
  const name = branchDatabaseName(sharedName, branch);
  const dataDir = branchDataDir(sharedDataDir, name);
  const owner = new Client({ connectionString: shared.migrationUrl });
  await owner.connect();
  try {
    // Two starts of the same branch take turns; the lock ends with this connection.
    await owner.query("SELECT pg_advisory_lock(hashtext($1))", [name]);
    const existing = await owner.query(
      `SELECT shobj_description(oid, 'pg_database') AS comment FROM pg_database WHERE datname = $1`,
      [name],
    );
    if (existing.rowCount && existing.rows[0].comment)
      return branchConnection(shared, name, dataDir);
    // No comment means an earlier start stopped partway; begin again.
    if (existing.rowCount) await owner.query(`DROP DATABASE "${name}"`);
    rmSync(path.dirname(dataDir), { recursive: true, force: true });
    let copied = true;
    try {
      // A copy keeps your accounts and bots; it needs no open connections to the source.
      await owner.query(`CREATE DATABASE "${name}" TEMPLATE "${sharedName}"`);
    } catch {
      copied = false;
      await owner.query(`CREATE DATABASE "${name}"`);
    }
    try {
      if (copied && existsSync(sharedDataDir)) {
        // Copy-on-write where the filesystem supports it, so this is cheap even for large homes.
        cpSync(sharedDataDir, dataDir, { recursive: true, mode: constants.COPYFILE_FICLONE });
      }
    } catch (error) {
      await owner.query(`DROP DATABASE "${name}"`);
      rmSync(path.dirname(dataDir), { recursive: true, force: true });
      throw new Error(`Could not copy ${sharedDataDir} for ${name}`, { cause: error });
    }
    await owner.query(
      `COMMENT ON DATABASE "${name}" IS ${owner.escapeLiteral(branchDatabaseComment(branch))}`,
    );
    log(
      copied
        ? `Copied the shared database and files to ${name}`
        : `Created an empty ${name} (the shared one was in use, so it could not be copied)`,
    );
  } finally {
    await owner.end();
  }
  return branchConnection(shared, name, dataDir);
}

function branchConnection(shared, name, dataDir) {
  return {
    url: withDatabase(shared.url, name),
    migrationUrl: withDatabase(shared.migrationUrl, name),
    dataDir,
  };
}

/**
 * Drop this repository's branch databases that nothing needs anymore: the branch was deleted, or
 * main now has all of its migrations, counting uncommitted ones in a branch's worktree. `keep`, the
 * branch about to start, and any database another checkout still has open are left alone.
 */
async function pruneBranchDatabases(shared, sharedDataDir, onMain, keep) {
  const owner = new Client({ connectionString: shared.migrationUrl });
  await owner.connect();
  try {
    const { rows } = await owner.query(
      `SELECT d.datname AS name, substr(c.description, $2) AS owner
         FROM pg_database d JOIN pg_shdescription c ON c.objoid = d.oid
        WHERE c.description LIKE $1 || '%'`,
      [BRANCH_DATABASE_COMMENT, BRANCH_DATABASE_COMMENT.length + 1],
    );
    const repo = repositoryId();
    for (const row of rows) {
      let branch;
      try {
        const parsed = JSON.parse(row.owner);
        if (parsed.repo !== repo) continue;
        branch = parsed.branch;
      } catch {
        continue;
      }
      if (branch === keep) continue;
      if ([...branchMigrations(branch)].some((name) => !onMain.has(name))) continue;
      try {
        await owner.query(`DROP DATABASE "${row.name}"`);
        rmSync(path.dirname(branchDataDir(sharedDataDir, row.name)), {
          recursive: true,
          force: true,
        });
        log(`Removed ${row.name}; ${branch} no longer needs its own database`);
      } catch {
        // Still in use by a running checkout.
      }
    }
  } finally {
    await owner.end();
  }
}

function tailscaleCli() {
  for (const cli of ["tailscale", TAILSCALE_APP_CLI]) {
    try {
      run(cli, ["version"]);
      return cli;
    } catch {}
  }
  throw new Error("RAKAZO_DEV_TAILNET is set, but the tailscale CLI was not found.");
}

/** Serve the loopback web port to the tailnet over HTTPS on the same port number. */
function shareOnTailnet(webPort) {
  const cli = tailscaleCli();
  const host = JSON.parse(run(cli, ["status", "--json"])).Self?.DNSName?.replace(/\.$/, "");
  if (!host) throw new Error("Tailscale is not connected. Sign in to Tailscale and try again.");
  // Inherit stdio: the first run may print a link to turn on HTTPS for the tailnet and wait.
  execFileSync(cli, ["serve", "--bg", `--https=${webPort}`, `http://${LOCAL_HOST}:${webPort}`], {
    stdio: "inherit",
  });
  return {
    host,
    origin: `https://${host}:${webPort}`,
    stop() {
      try {
        run(cli, ["serve", `--https=${webPort}`, "off"]);
      } catch {
        log(`Could not stop sharing port ${webPort}; run: tailscale serve --https=${webPort} off`);
      }
    },
  };
}

function generateClientIfStale(env) {
  const client = path.join(dbPackage, "src/generated/prisma/client.ts");
  const schema = path.join(dbPackage, "prisma/schema.prisma");
  if (existsSync(client) && statSync(client).mtimeMs >= statSync(schema).mtimeMs) return;
  log("Generating the Prisma client");
  runPnpm(["--filter", "@forion/orbit-db", "generate"], {
    cwd: root,
    env,
    stdio: "inherit",
  });
}

const env = { ...process.env, COREPACK_ENABLE_DOWNLOAD_PROMPT: "0" };
if (!/(^|\s)--dns-result-order=/.test(env.NODE_OPTIONS ?? "")) {
  env.NODE_OPTIONS = `${env.NODE_OPTIONS ?? ""} --dns-result-order=ipv4first`.trim();
}

let ports = null;
if (!setting("WEB_PORT") && !setting("API_PORT")) {
  ports = await choosePorts();
  Object.assign(env, portEnv(ports));
} else {
  const web = Number(setting("WEB_PORT") ?? DEFAULT_PORTS.web);
  const api = Number(setting("API_PORT") ?? DEFAULT_PORTS.api);
  const supervisor = Number(setting("SUPERVISOR_PORT") ?? DEFAULT_PORTS.supervisor);
  Object.assign(env, portEnv({ web, api, supervisor }));
}

// Checkouts that share a database also share its job queue, so any checkout's worker may write a
// file another checkout's API reads. A relative DATA_DIR resolves in the main checkout for all.
const mainCheckout = path.dirname(
  path.resolve(root, run("git", ["rev-parse", "--git-common-dir"], { cwd: root })),
);
const sharedDataDir = path.resolve(mainCheckout, setting("DATA_DIR") || "./data");

const shared = { ...(await sharedDatabase()), dataDir: sharedDataDir };
let database = shared;
const onMain = mainMigrations();
const pending = branchOnlyMigrations(onMain);
await pruneBranchDatabases(shared, sharedDataDir, onMain, pending.length ? currentBranch() : null);
if (pending.length && !useConfiguredSharedDatabase) {
  log(`This branch adds ${pending.length} migration(s), so it gets its own database`);
  database = await branchDatabase(shared, sharedDataDir);
} else if (pending.length) {
  log(`Applying ${pending.length} branch migration(s) to the configured shared database`);
}
env.DATABASE_URL = database.url;
env.DATABASE_MIGRATION_URL = database.migrationUrl;
env.DATA_DIR = database.dataDir;

generateClientIfStale(env);
if (useConfiguredSharedDatabase) {
  // Staging already owns its schema and migration role; this client points at it as-is.
  log("Skipping migrations; the configured shared database is already provisioned.");
} else {
  // Checkouts starting together would otherwise grant the server-wide runtime role at the same
  // moment and fail. Advisory locks are per database, so every checkout locks the shared one.
  const migrationLock = new Client({ connectionString: shared.migrationUrl });
  await migrationLock.connect();
  try {
    await migrationLock.query("SELECT pg_advisory_lock(hashtext('rakazo dev migrate'))");
    runPnpm(["db:migrate"], { cwd: root, env, stdio: "inherit" });
  } finally {
    await migrationLock.end();
  }
}

let tailnet = null;
if (/^(1|true)$/i.test(setting("RAKAZO_DEV_TAILNET") ?? "")) {
  // The emulator's inbox has no sign-in check; it is safe only while nothing but this machine
  // can reach the web server.
  if (setting("EMAIL_EMULATOR") === "true") {
    throw new Error("RAKAZO_DEV_TAILNET cannot be used with EMAIL_EMULATOR=true.");
  }
  tailnet = shareOnTailnet(Number(env.WEB_PORT ?? setting("WEB_PORT") ?? 5173));
  // Every way this process ends, including a failed launch, turns sharing off.
  process.on("exit", () => tailnet.stop());
  // Sign-in cookies and links follow this origin, so use the tailnet URL on this machine too.
  env.WEB_ORIGIN = tailnet.origin;
  env.BETTER_AUTH_URL = tailnet.origin;
  env.RAKAZO_ALLOWED_HOSTS = [setting("RAKAZO_ALLOWED_HOSTS"), tailnet.host]
    .filter(Boolean)
    .join(",");
}

if (tailnet) log(`Open ${tailnet.origin} from any device on your tailnet`);
else if (ports) log(`Open http://${LOCAL_HOST}:${ports.web}`);
const turbo = spawnPnpm(
  ["exec", "turbo", "dev", "--env-mode=loose", ...SERVICES.map((name) => `--filter=${name}`)],
  { cwd: root, env, stdio: "inherit" },
);
for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => turbo.kill(signal));
turbo.on("exit", (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  else process.exit(code ?? 0);
});
