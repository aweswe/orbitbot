import { describe, expect, it } from "vitest";
import {
  INERT_DATABASE_URL,
  prismaCommandNeedsDatabase,
  redactedTarget,
  requireMigrationUrl,
} from "./migration-config.js";

const clone =
  "postgresql://phase7_owner:secret-one@127.0.0.1:55440/phase7_orbit?schema=orbit_bot";
const app =
  "postgresql://phase7_app:secret-two@127.0.0.1:55440/phase7_orbit?schema=orbit_bot";

describe("requireMigrationUrl", () => {
  it("requires an explicit DATABASE_MIGRATION_URL", () => {
    expect(() => requireMigrationUrl({ DATABASE_URL: app })).toThrow(
      /DATABASE_MIGRATION_URL is required/,
    );
    expect(() => requireMigrationUrl({ POSTGRES_URL: clone })).toThrow(
      /DATABASE_MIGRATION_URL is required/,
    );
  });

  it("does not fall back to DATABASE_URL", () => {
    expect(() => requireMigrationUrl({ DATABASE_URL: clone })).toThrow(
      /DATABASE_MIGRATION_URL is required/,
    );
  });

  it("rejects malformed URLs, non-postgres schemes, and missing database names", () => {
    for (const url of [
      "not-a-url",
      "https://owner:pass@db.example.test/phase7?schema=orbit_bot",
      "postgresql://owner:pass@db.example.test:5432/?schema=orbit_bot",
      "postgresql://owner:pass@db.example.test:0/phase7?schema=orbit_bot",
    ]) {
      expect(() => requireMigrationUrl({ DATABASE_MIGRATION_URL: url })).toThrow(
        /valid absolute URL|postgres|database|port/,
      );
    }
  });

  it("requires the expected orbit_bot schema and rejects another schema", () => {
    expect(() =>
      requireMigrationUrl({
        DATABASE_MIGRATION_URL: "postgresql://owner:pass@127.0.0.1:55440/phase7_orbit",
      }),
    ).toThrow(/schema=orbit_bot/);
    expect(() =>
      requireMigrationUrl({
        DATABASE_MIGRATION_URL:
          "postgresql://owner:pass@127.0.0.1:55440/phase7?schema=public",
      }),
    ).toThrow(/schema=orbit_bot/);
  });

  it("rejects the runtime login as the migration login", () => {
    expect(() =>
      requireMigrationUrl({ DATABASE_MIGRATION_URL: clone, DATABASE_URL: clone }),
    ).toThrow(/different logins/);
  });

  it("returns an explicit clone URL unchanged when the runtime URL differs", () => {
    expect(requireMigrationUrl({ DATABASE_MIGRATION_URL: clone, DATABASE_URL: app })).toBe(
      clone,
    );
  });

  it("enforces optional host and database allowlists", () => {
    expect(() =>
      requireMigrationUrl({
        DATABASE_MIGRATION_URL: clone,
        MIGRATION_ALLOWED_HOSTS: "other.example.test",
      }),
    ).toThrow(/not in MIGRATION_ALLOWED_HOSTS/);
    expect(() =>
      requireMigrationUrl({
        DATABASE_MIGRATION_URL: clone,
        MIGRATION_ALLOWED_DATABASES: "other_db",
      }),
    ).toThrow(/not in MIGRATION_ALLOWED_DATABASES/);
  });

  it("redacts login, password, and query credentials", () => {
    const target = redactedTarget(clone);
    expect(target).toBe("127.0.0.1:55440/phase7_orbit?schema=orbit_bot");
    expect(target).not.toMatch(/phase7_owner|secret-one/);
  });
});

describe("prismaCommandNeedsDatabase", () => {
  it("recognizes migration-like commands and not generate/validate", () => {
    expect(prismaCommandNeedsDatabase(["node", "prisma", "migrate", "deploy"])).toBe(true);
    expect(prismaCommandNeedsDatabase(["node", "prisma", "db", "push"])).toBe(true);
    expect(prismaCommandNeedsDatabase(["node", "prisma", "generate"])).toBe(false);
    expect(prismaCommandNeedsDatabase(["node", "prisma", "validate"])).toBe(false);
  });

  it("uses an inert target only for commands that do not touch a database", () => {
    expect(INERT_DATABASE_URL).not.toMatch(/localhost|127\.0\.0\.1/);
  });
});
