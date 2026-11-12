/**
 * Fail-closed target resolution for Prisma migration commands.
 *
 * Migrations require an explicitly exported DATABASE_MIGRATION_URL with
 * ?schema=orbit_bot. There is no DATABASE_URL, .env, or localhost fallback.
 * `prisma generate`/`validate` do not need a target and use an inert placeholder.
 */

const POSTGRES_PROTOCOLS = new Set(["postgres:", "postgresql:"]);
export const INERT_DATABASE_URL = "postgresql://invalid.invalid:5432/invalid";

export class MigrationConfigError extends Error {
  readonly code = "MIGRATION_CONFIG";
}

function fail(message: string): never {
  throw new MigrationConfigError(message);
}

function parsePostgresUrl(url: string | undefined, label: string) {
  if (!url?.trim()) fail(`${label} is required (explicit URL, no fallback).`);
  let parsed: URL;
  try {
    parsed = new URL(url.trim());
  } catch {
    fail(`${label} is not a valid absolute URL.`);
  }
  if (!POSTGRES_PROTOCOLS.has(parsed.protocol)) {
    fail(`${label} must use postgres:// or postgresql://.`);
  }
  if (!parsed.hostname) fail(`${label} must name a database host.`);
  const port = parsed.port || "5432";
  if (!/^\d+$/.test(port) || Number(port) < 1 || Number(port) > 65535) {
    fail(`${label} must use a valid port.`);
  }
  const database = decodeURIComponent(parsed.pathname.replace(/^\/+/, ""));
  if (!database) fail(`${label} must name a database.`);
  return { parsed, host: parsed.hostname, database };
}

export function requireMigrationUrl(
  env: Record<string, string | undefined> = process.env,
  options: { expectedSchema?: string } = {},
): string {
  const url = env.DATABASE_MIGRATION_URL;
  const { parsed, host, database } = parsePostgresUrl(url, "DATABASE_MIGRATION_URL");
  const expectedSchema = options.expectedSchema ?? "orbit_bot";
  const schema = parsed.searchParams.get("schema");
  if (schema !== expectedSchema) {
    fail(`DATABASE_MIGRATION_URL must include ?schema=${expectedSchema}.`);
  }

  const allowedHosts = (env.MIGRATION_ALLOWED_HOSTS ?? "")
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);
  if (allowedHosts.length && !allowedHosts.includes(host.toLowerCase())) {
    fail(`host "${host}" is not in MIGRATION_ALLOWED_HOSTS.`);
  }
  const allowedDatabases = (env.MIGRATION_ALLOWED_DATABASES ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  if (allowedDatabases.length && !allowedDatabases.includes(database)) {
    fail(`database "${database}" is not in MIGRATION_ALLOWED_DATABASES.`);
  }

  const migrationUser = decodeURIComponent(parsed.username);
  if (!migrationUser) fail("DATABASE_MIGRATION_URL must name a migration login.");
  const runtimeUrl = env.DATABASE_URL?.trim();
  if (runtimeUrl) {
    const runtime = parsePostgresUrl(runtimeUrl, "DATABASE_URL");
    const runtimeUser = decodeURIComponent(runtime.parsed.username);
    if (runtimeUser && migrationUser === runtimeUser) {
      fail(
        "migration and application credentials must be different logins; DATABASE_MIGRATION_URL matches DATABASE_URL.",
      );
    }
  }
  return url!.trim();
}

/** Safe target string for logs: host:port/database/schema, never user or password. */
export function redactedTarget(url: string): string {
  const parsed = new URL(url);
  const database = decodeURIComponent(parsed.pathname.replace(/^\/+/, ""));
  const schema = parsed.searchParams.get("schema");
  return `${parsed.hostname}:${parsed.port || "5432"}/${database}${schema ? `?schema=${schema}` : ""}`;
}

/** Migration-like Prisma commands need a real target; generate/validate do not. */
export function prismaCommandNeedsDatabase(argv: readonly string[] = process.argv): boolean {
  return argv.some((arg) => ["migrate", "db", "studio"].includes(arg));
}
