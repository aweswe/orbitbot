import { setTimeout as sleep } from "node:timers/promises";
import { PostgreSqlContainer } from "@testcontainers/postgresql";

const ATTEMPTS = 4;

export type DisposablePostgres = {
  getConnectionUri: () => string;
  stop: () => Promise<unknown>;
};

/**
 * Every database URL the app and Prisma read, pointed at one disposable database.
 * Prisma migrates DATABASE_MIGRATION_URL first and reloads `.env`, so an inherited
 * one must be overwritten, not deleted. The app is schema-scoped, so every URL
 * carries `?schema=orbit_bot` even when a container URL does not.
 */
export function schemaScopedDatabaseUrl(url: string, schema = "orbit_bot"): string {
  const parsed = new URL(url);
  if (!parsed.searchParams.has("schema")) parsed.searchParams.set("schema", schema);
  return parsed.toString();
}

export function disposableDatabaseEnv(url: string) {
  const scoped = schemaScopedDatabaseUrl(url);
  return { DATABASE_URL: scoped, DATABASE_MIGRATION_URL: scoped, REALTIME_DATABASE_URL: scoped };
}

/**
 * A disposable Postgres. CI can set CI_POSTGRES_URL to a workflow `services:` database that
 * starts beside checkout and install; otherwise Testcontainers pulls and starts one.
 * Image registries rate-limit shared CI runners per minute, so container pulls are retried.
 */
export async function startPostgres(signal?: AbortSignal): Promise<DisposablePostgres> {
  const provided = process.env.CI_POSTGRES_URL?.trim();
  if (provided) {
    return {
      getConnectionUri: () => provided,
      stop: async () => {},
    };
  }
  for (let attempt = 1; ; attempt += 1) {
    try {
      // A throwaway database needs no crash safety; parallel suites need more connections.
      return await new PostgreSqlContainer("postgres:18-alpine")
        .withCommand([
          "postgres",
          "-c",
          "fsync=off",
          "-c",
          "synchronous_commit=off",
          "-c",
          "full_page_writes=off",
          "-c",
          "max_connections=500",
        ])
        .start();
    } catch (error) {
      if (attempt === ATTEMPTS || signal?.aborted) throw error;
      const delaySeconds = attempt * 20;
      console.warn(`Postgres did not start (${String(error)}); retrying in ${delaySeconds}s`);
      await sleep(delaySeconds * 1000, undefined, { signal });
    }
  }
}
