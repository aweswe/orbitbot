import { PrismaClient } from "../packages/db/src/generated/prisma/index.js";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";
import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(here, "../.env") });

const connectionString =
  process.env.DATABASE_URL ||
  "postgresql://postgres:p0probe@127.0.0.1:55433/orbit_bot";

const pool = new pg.Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function seed() {
  console.log("Seeding Orbit Bot mission control into local database...");

  const userId = process.env.DEV_API_USER_ID || "xsviuWUARjywMLDk0bcI6";
  const orgId = "org_orbit_default";
  const spaceId = "space_orbit_default";
  const botId = "bot_orbit_main";

  // 1. User
  await prisma.user.upsert({
    where: { id: userId },
    create: {
      id: userId,
      name: "Orbit Pilot",
      email: "pilot@orbit.bot",
      emailVerified: true,
      avatarStyle: "organic",
      botAvatarSet: "organic",
    },
    update: {
      name: "Orbit Pilot",
    },
  });
  console.log("✔ Created/updated Orbit Pilot user:", userId);

  // 2. Deployment Settings
  await prisma.deploymentSettings.upsert({
    where: { id: "default" },
    create: {
      id: "default",
      ownerUserId: userId,
      signupsEnabled: true,
      signupPolicyInitialized: true,
      modelCreditsEnabled: true,
    },
    update: {
      modelCreditsEnabled: true,
    },
  });

  // 3. Organization
  await prisma.organization.upsert({
    where: { id: orgId },
    create: {
      id: orgId,
      name: "Orbit Workspace",
      slug: "orbit-default",
    },
    update: {
      name: "Orbit Workspace",
    },
  });

  // 4. Member
  await prisma.member.upsert({
    where: { organizationId_userId: { organizationId: orgId, userId } },
    create: {
      id: "member_orbit_default",
      organizationId: orgId,
      userId,
      role: "owner",
    },
    update: {},
  });

  // 5. Space
  await prisma.space.upsert({
    where: { id: spaceId },
    create: {
      id: spaceId,
      organizationId: orgId,
      name: "Orbit Mission Control",
      isDefault: true,
      createdByUserId: userId,
    },
    update: {
      name: "Orbit Mission Control",
    },
  });

  // 6. Space Member
  await prisma.spaceMember.upsert({
    where: { spaceId_userId: { spaceId, userId } },
    create: {
      id: "sm_orbit_default",
      spaceId,
      organizationId: orgId,
      userId,
      role: "owner",
    },
    update: {},
  });

  // 7. Orbit Bot Agent
  await prisma.bot.upsert({
    where: { id: botId },
    create: {
      id: botId,
      spaceId,
      organizationId: orgId,
      name: "Orbit Bot",
      description:
        "Primary autonomous AI agent powered by Requesty & Orbit Microservices Control Plane.",
      instructions:
        "You are Orbit Bot, an advanced autonomous AI coding and workflow agent connected to the Orbit microservices architecture. You have full access to tools, terminal execution, filesystem, browser, memory, subagents, and Requesty model reasoning. Assist the user with precision.",
      modelProvider: "requesty",
      modelId: "deepseek/deepseek-v4-flash",
      color: "#6366f1",
      avatarSet: "organic",
      createdByUserId: userId,
      fleetManagement: true,
      position: 0,
      thinkingLevel: "medium",
    },
    update: {
      name: "Orbit Bot",
      modelProvider: "requesty",
      modelId: "deepseek/deepseek-v4-flash",
    },
  });
  console.log("✔ Created/updated Orbit Bot agent:", botId);

  // 8. Memory document
  await prisma.memoryDocument.upsert({
    where: {
      spaceId_userId_scope_path: {
        spaceId,
        userId,
        scope: "user",
        path: "MEMORY.md",
      },
    },
    create: {
      spaceId,
      userId,
      scope: "user",
      path: "MEMORY.md",
      content:
        "# Orbit Bot Space Memory\n\n- Active microservice: Orbit Microservices (`forion-server` Control Plane)\n- Requesty routing active\n- Unified credit ledger active\n",
    },
    update: {},
  });

  console.log("✔ Orbit Bot database successfully initialized and ready!");
  await pool.end();
}

seed().catch((err) => {
  console.error("Failed to seed Orbit Bot database:", err);
  process.exit(1);
});

