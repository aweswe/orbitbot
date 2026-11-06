import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..");
const dbPackage = path.join(root, "packages/db/package.json");
const require = createRequire(dbPackage);

const { Pool } = require("pg");
const dotenv = require("dotenv");

dotenv.config({ path: path.resolve(root, ".env") });

const connectionString =
  process.env.DATABASE_URL ||
  "postgresql://postgres:p0probe@127.0.0.1:55433/orbit_bot";

const pool = new Pool({ connectionString });

async function seed() {
  console.log("Seeding Orbit Bot mission control into local PostgreSQL...");
  const client = await pool.connect();

  try {
    const userId = process.env.DEV_API_USER_ID || "xsviuWUARjywMLDk0bcI6";
    const orgId = "org_orbit_default";
    const spaceId = "space_orbit_default";
    const botId = "bot_orbit_main";
    const now = new Date();

    // 1. User
    await client.query(
      `INSERT INTO "user" ("id", "name", "email", "emailVerified", "avatarStyle", "botAvatarSet", "createdAt", "updatedAt")
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT ("id") DO UPDATE SET "name" = EXCLUDED."name", "updatedAt" = EXCLUDED."updatedAt"`,
      [userId, "Orbit Pilot", "pilot@orbit.bot", true, "organic", "organic", now, now]
    );
    console.log("✔ Created/updated user:", userId);

    // 2. Deployment Settings
    await client.query(
      `INSERT INTO "deployment_settings" ("id", "ownerUserId", "signupsEnabled", "signupPolicyInitialized", "modelCreditsEnabled", "createdAt", "updatedAt")
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT ("id") DO UPDATE SET "modelCreditsEnabled" = EXCLUDED."modelCreditsEnabled", "updatedAt" = EXCLUDED."updatedAt"`,
      ["default", userId, true, true, true, now, now]
    );
    console.log("✔ Initialized deployment settings with modelCreditsEnabled: true");

    // 3. Organization
    await client.query(
      `INSERT INTO "organization" ("id", "name", "slug", "createdAt")
       VALUES ($1, $2, $3, $4)
       ON CONFLICT ("id") DO UPDATE SET "name" = EXCLUDED."name"`,
      [orgId, "Orbit Workspace", "orbit-default", now]
    );
    console.log("✔ Created/updated organization:", orgId);

    // 4. Member
    await client.query(
      `INSERT INTO "member" ("id", "organizationId", "userId", "role", "createdAt")
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT ("organizationId", "userId") DO NOTHING`,
      ["member_orbit_default", orgId, userId, "owner", now]
    );
    console.log("✔ Created member:", userId);

    // 5. Space
    await client.query(
      `INSERT INTO "spaces" ("id", "organizationId", "name", "isDefault", "createdByUserId", "createdAt")
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT ("id") DO UPDATE SET "name" = EXCLUDED."name"`,
      [spaceId, orgId, "Orbit Mission Control", true, userId, now]
    );
    console.log("✔ Created/updated space:", spaceId);

    // 6. Space Member
    await client.query(
      `INSERT INTO "space_members" ("id", "spaceId", "organizationId", "userId", "role", "createdAt")
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT ("spaceId", "userId") DO NOTHING`,
      ["sm_orbit_default", spaceId, orgId, userId, "owner", now]
    );
    console.log("✔ Created space member:", userId);

    // 7. Bot
    await client.query(
      `INSERT INTO "bots" (
         "id", "spaceId", "userId", "name", "description", "instructions", "color", "avatarSet",
         "modelProvider", "modelId", "thinkingLevel", "fleetManagement", "position", "createdAt", "updatedAt"
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
       ON CONFLICT ("id") DO UPDATE SET
         "name" = EXCLUDED."name",
         "modelProvider" = EXCLUDED."modelProvider",
         "modelId" = EXCLUDED."modelId",
         "updatedAt" = EXCLUDED."updatedAt"`,
      [
        botId,
        spaceId,
        userId,
        "Orbit Bot",
        "Primary autonomous AI agent powered by Requesty & Orbit Microservices Control Plane.",
        "You are Orbit Bot, an advanced autonomous AI coding and workflow agent connected to the Orbit microservices architecture. You have full access to tools, terminal execution, filesystem, browser, memory, subagents, and Requesty model reasoning. Assist the user with precision.",
        "#6366f1",
        "organic",
        "requesty",
        "deepseek/deepseek-v4-flash",
        "medium",
        true,
        0,
        now,
        now
      ]
    );
    console.log("✔ Created/updated Orbit Bot agent:", botId);

    // 8. Memory document
    await client.query(
      `INSERT INTO "memory_documents" ("id", "spaceId", "userId", "scope", "path", "content", "createdAt", "updatedAt")
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT ("spaceId", "scope", "botId", "path") DO UPDATE SET "content" = EXCLUDED."content"`,
      [
        "mem_orbit_default",
        spaceId,
        userId,
        "user",
        "MEMORY.md",
        "# Orbit Bot Space Memory\n\n- Active microservice: Orbit Microservices (`forion-server` Control Plane)\n- Requesty routing active\n- Unified credit ledger active\n",
        now,
        now
      ]
    );
    console.log("✔ Created/updated default memory document");

    console.log("🚀 Orbit Bot database seeding completed successfully!");
  } finally {
    client.release();
    await pool.end();
  }
}

seed().catch((err) => {
  console.error("Seeding failed:", err);
  process.exit(1);
});
