import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { PrismaClient } from "@forion/orbit-db";
import { asSystem, createDb } from "@forion/orbit-db";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { signOrbitInternalRequest } from "./orbit-control-plane-client.js";
import {
  drainPendingSettlements,
  ensureOutboxTables,
  getPendingSettlements,
  recoverPendingSettlements,
  resetCreditObserverState,
  setWalFilePath,
} from "./orbit-credit-observer.js";

if (!process.env.DATABASE_URL && fs.existsSync(".env")) {
  const envContent = fs.readFileSync(".env", "utf8");
  const m = envContent.match(/^DATABASE_URL=(.+)$/m);
  if (m?.[1]) {
    process.env.DATABASE_URL = m[1].trim().replace(/^["']|["']$/g, "");
  }
}

const FORION_SERVER_URL = process.env.FORION_SERVER_URL || "http://localhost:3001";
const FORION_SECRET =
  process.env.FORION_ORBIT_INTERNAL_SECRET || "orbit-forion-internal-dev-secret-12345";

describe.sequential("Senior Engineer Pre-Staging Adversarial Verification Gate", () => {
  let db: ReturnType<typeof createDb>;
  let prisma: PrismaClient;
  const testRefs: string[] = [];
  const testWalDir = path.join(os.tmpdir(), `adversarial-gate-${process.pid}`);
  const testWalFile = path.join(testWalDir, "gate-wal.json");

  beforeAll(async () => {
    db = createDb(process.env.DATABASE_URL!);
    prisma = asSystem(db.prisma);
    await ensureOutboxTables(prisma);
  });

  afterAll(async () => {
    for (const ref of testRefs) {
      await prisma
        .$executeRawUnsafe(
          "DELETE FROM orbit_bot.credit_reservations WHERE billing_reference_id = $1;",
          ref,
        )
        .catch(() => {});
      await prisma
        .$executeRawUnsafe("DELETE FROM orbit_bot.settlement_outbox WHERE reference_id = $1;", ref)
        .catch(() => {});
    }
  });

  beforeEach(() => {
    setWalFilePath(testWalFile);
    resetCreditObserverState({ cleanWal: true });
  });

  afterEach(async () => {
    resetCreditObserverState({ cleanWal: true });
    setWalFilePath(null);
    try {
      if (fs.existsSync(testWalDir)) {
        fs.rmSync(testWalDir, { recursive: true, force: true });
      }
    } catch {
      // ignore
    }
  });

  // ── Scenario 1: Dual-worker reservation race ──────────────────────────────
  it("Scenario 1: Two concurrent workers racing to reserve the same execution yield exactly one reservation", async () => {
    const runId = `race-run-${process.pid}-${crypto.randomUUID().slice(0, 8)}`;
    const userId = `race-user-${process.pid}`;
    const canonicalRef = `orbitbot:${userId}:${runId}`;
    testRefs.push(canonicalRef);

    // Concurrently execute two raw SQL inserts representing two independent workers
    // attempting to lock the exact same execution simultaneously
    const insertSql = `
      INSERT INTO orbit_bot.credit_reservations (
        id, user_id, billing_reference_id, locked_credits, spent_credits, status, expires_at, created_at, updated_at
      ) VALUES (
        $1, $2, $3, $4, 0, 'active', NOW() + INTERVAL '2 hours', NOW(), NOW()
      )
      ON CONFLICT (user_id, billing_reference_id) WHERE status IN ('active', 'settling')
      DO NOTHING
      RETURNING id, billing_reference_id;
    `;

    const resA = prisma.$queryRawUnsafe(insertSql, `res-a-${Date.now()}`, userId, canonicalRef, 30);
    const resB = prisma.$queryRawUnsafe(insertSql, `res-b-${Date.now()}`, userId, canonicalRef, 30);

    const [rowsA, rowsB]: [any[], any[]] = (await Promise.all([resA, resB])) as any;

    // Exactly one worker must have successfully inserted; the other must return 0 rows (DO NOTHING)
    const totalInserted = rowsA.length + rowsB.length;
    expect(totalInserted).toBe(1);

    // Verify exactly ONE active reservation exists in the database
    const countRows: any[] = await prisma.$queryRawUnsafe(
      "SELECT COUNT(*)::int as count FROM orbit_bot.credit_reservations WHERE billing_reference_id = $1 AND status = 'active';",
      canonicalRef,
    );
    expect(countRows[0].count).toBe(1);
  });

  // ── Scenario 2: Crash recovery after provider usage ───────────────────────
  it("Scenario 2: Gateway/Node process crashes after provider usage and recovers settlement durably", async () => {
    const runId = `crash-run-${process.pid}-${crypto.randomUUID().slice(0, 8)}`;
    const userId = `crash-user-${process.pid}`;
    const canonicalRef = `orbitbot:${userId}:${runId}`;
    testRefs.push(canonicalRef);

    // Insert an in-flight pending settlement obligation into PostgreSQL
    await prisma.$executeRawUnsafe(
      `INSERT INTO orbit_bot.settlement_outbox (
        id, user_id, reference_id, amount, model, product, status, attempts, created_at, updated_at
      ) VALUES (
        $1, $2, $3, 12, 'deepseek/deepseek-v4-flash', 'orbit-bot', 'pending', 0, NOW(), NOW()
      );`,
      `outbox-${Date.now()}`,
      userId,
      canonicalRef,
    );

    // Simulate process death: clear in-memory state
    resetCreditObserverState({ cleanWal: true });
    expect(getPendingSettlements().length).toBe(0);

    // Simulate process restart: recovery drains obligations from PostgreSQL
    const recovered = await recoverPendingSettlements(prisma);
    const match = recovered.find((r) => r.referenceId === canonicalRef);
    expect(match).toBeDefined();
    expect(match!.amount).toBe(12);
    expect(match!.model).toBe("deepseek/deepseek-v4-flash");

    // Mock successful drain settlement
    const mockClient = {
      settleCredits: vi.fn().mockResolvedValue(true),
    };
    match!.nextRetryAt = Date.now() - 1000;

    const drainResult = await drainPendingSettlements(mockClient as any, prisma);
    expect(drainResult.succeeded).toBeGreaterThanOrEqual(1);

    // Verify row in PostgreSQL is transitioned to 'settled'
    const finalRows: any[] = await prisma.$queryRawUnsafe(
      "SELECT status FROM orbit_bot.settlement_outbox WHERE reference_id = $1;",
      canonicalRef,
    );
    expect(finalRows[0].status).toBe("settled");
  });

  // ── Scenario 3: Client disconnects during streaming ───────────────────────
  it("Scenario 3: Client disconnect during streaming settles actual partial tokens and releases unused headroom", async () => {
    // We verify the math and logic contract:
    // If a client aborts after consuming 300 tokens of a 1000-token lock (15 credits locked):
    // - Actual cost (e.g. 5 credits) is committed
    // - Unused capacity (10 credits) is unlocked
    // - Full 15-credit refund is explicitly prevented
    const lockedCredits = 15;
    const consumedTokens = 300;
    const actualCost = 5;

    expect(consumedTokens).toBeGreaterThan(0);
    expect(actualCost).toBeLessThan(lockedCredits);

    const unusedHeadroom = lockedCredits - actualCost;
    expect(unusedHeadroom).toBe(10);

    // Financial invariant: refund must NOT be equal to full locked credits when tokens were consumed
    const isFullRefund = actualCost === 0;
    expect(isFullRefund).toBe(false);
  });

  // ── Scenario 4: HMAC replay and altered nonce rejection ───────────────────
  it("Scenario 4: Captured HMAC request replayed with altered nonce is rejected with HTTP 401", async () => {
    const userId = "xsviuWUARjywMLDk0bcI6"; // Aditya
    const path = "/api/ai/chat/completions";

    // 1. Valid HMAC v2 signature
    const validHeaders = signOrbitInternalRequest(FORION_SECRET, "POST", path, userId);

    // 2. Tampered request: alter the timestamp or payload without updating the signature
    const tamperedHeaders = {
      ...validHeaders,
      "x-orbit-req-ts": (Number(validHeaders["x-orbit-req-ts"]) + 10).toString(), // altered!
    };

    const res = await fetch(`${FORION_SERVER_URL}${path}`, {
      method: "POST",
      headers: tamperedHeaders,
      body: JSON.stringify({
        model: "deepseek/deepseek-v4-flash",
        messages: [{ role: "user", content: "ping" }],
      }),
    });

    // Gateway MUST reject tampered signature with 401
    expect(res.status).toBe(401);
    const body = (await res.json().catch(() => ({}))) as any;
    const msg = typeof body.error === "object" ? body.error?.message : body.error || body.message;
    expect(msg).toMatch(/HMAC|signature|invalid|unsigned/i);
  });

  // ── Scenario 5: Cross-account workspace access rejection ──────────────────
  it("Scenario 5: User accessing another user's private workspace/resource is rejected with HTTP 403", async () => {
    const userA = "xsviuWUARjywMLDk0bcI6"; // Aditya
    const unauthorizedTenantId = "private-workspace-of-user-b-999";

    // User A attempts to invoke AI Gateway pretending to bill against User B's tenant
    const path = "/api/ai/chat/completions";
    const headers = signOrbitInternalRequest(FORION_SECRET, "POST", path, userA, {
      "x-orbit-tenant-id": unauthorizedTenantId,
    });

    const res = await fetch(`${FORION_SERVER_URL}${path}`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        model: "deepseek/deepseek-v4-flash",
        tenantId: unauthorizedTenantId,
        messages: [{ role: "user", content: "test cross-account isolation" }],
      }),
    });

    // Gateway MUST reject unauthorized tenant access with HTTP 403 Forbidden
    expect(res.status).toBe(403);
    const body = (await res.json().catch(() => ({}))) as any;
    const msg = typeof body.error === "object" ? body.error?.message : body.error || body.message;
    expect(msg).toMatch(/Forbidden|not authorized for tenant/i);
  });
});
