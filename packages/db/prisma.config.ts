import { defineConfig } from "prisma/config";
import {
  INERT_DATABASE_URL,
  prismaCommandNeedsDatabase,
  redactedTarget,
  requireMigrationUrl,
} from "./src/migration-config.js";

const needsDatabase = prismaCommandNeedsDatabase();
const databaseUrl = needsDatabase
  ? requireMigrationUrl(process.env)
  : process.env.DATABASE_MIGRATION_URL || INERT_DATABASE_URL;
if (needsDatabase) console.log(`[prisma] target ${redactedTarget(databaseUrl)}`);

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    // The migrate command passes a copy without the deferred migrations it holds back.
    path: process.env.RAKAZO_MIGRATIONS_PATH || "prisma/migrations",
  },
  datasource: {
    // Migration commands require an explicit ?schema=orbit_bot owner URL. There
    // is no DATABASE_URL/.env/localhost fallback; generate/validate use an inert URL.
    url: databaseUrl,
  },
});
