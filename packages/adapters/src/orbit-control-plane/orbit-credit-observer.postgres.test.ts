import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { PrismaClient } from "@forion/orbit-db";
import { asSystem, createDb } from "@forion/orbit-db";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  lockCredits: vi.fn(),
  commitCredits: vi.fn(),
  refundCredits: vi.fn(),
  settleCredits: vi.fn(),
}));

vi.mock("./orbit-control-plane-client.js", () => ({
  getOrbitControlPlaneClient: () => ({
    lockCredits: mocks.lockCredits,
    commitCredits: mocks.commitCredits,
    refundCredits: mocks.refundCredits,
    settleCredits: mocks.settleCredits,
  }),
}));

import {
  createOrbitModelCreditObserver,
  drainPendingSettlements,
  ensureOutboxTables,
  finalizeRunCredits,
  getPendingSettlements,
  recoverPendingSettlements,
  resetCreditObserverState,
  setWalFilePath,
} from "./orbit-credit-observer.js";

// Only the integration harness supplies both flags, with a disposable database.
// Reading the repo .env here used to point unit runs at a shared Supabase DB.
const dbTests =
  process.env.VERIFY_DATABASE && process.env.DATABASE_URL
    ? describe.sequential
    : describe.skip;

dbTests("Orbit credit observer — PostgreSQL Integration Suite", () => {
  let db: ReturnType<typeof createDb>;
  let prisma: PrismaClient;
  const testWalDir = path.join(os.tmpdir(), `orbit-pg-wal-test-${process.pid}`);
  const testWalFile = path.join(testWalDir, "test-wal.json");
  const testRefs: string[] = [];

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
    await db.prisma.$disconnect();
    await db.pool.end();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    setWalFilePath(testWalFile);
    resetCreditObserverState({ cleanWal: true });
    mocks.commitCredits.mockResolvedValue(true);
    mocks.refundCredits.mockResolvedValue(true);
    mocks.settleCredits.mockResolvedValue(true);
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

  it("enforces distributed reservation uniqueness in PostgreSQL across simulated independent processes", async () => {
    const runId = `pg-run-${process.pid}-${crypto.randomUUID().slice(0, 8)}`;
    const userId = `pg-user-${process.pid}`;
    const canonicalRef = `orbitbot:${userId}:${runId}`;
    testRefs.push(canonicalRef);

    mocks.lockCredits.mockResolvedValue({
      lockedCredits: 30,
      referenceId: canonicalRef,
    });

    const scope = { userId, spaceId: "test-space" };

    // Process A (Worker 1) executes first model turn
    const worker1 = createOrbitModelCreditObserver(scope, prisma);
    const call1 = {
      callId: "call-worker-1",
      inputTokensEstimate: 1000,
      maxOutputTokens: 500,
      provider: "orbit",
      modelId: "orbit-flash",
      runId,
    };

    const key1 = await worker1.beforeCall(call1 as any);
    expect(key1).toBe("call-worker-1");
    expect(mocks.lockCredits).toHaveBeenCalledTimes(1);

    // Verify row in real PostgreSQL
    const rows: any[] = await prisma.$queryRawUnsafe(
      "SELECT id, billing_reference_id, locked_credits, status FROM orbit_bot.credit_reservations WHERE billing_reference_id = $1;",
      canonicalRef,
    );
    expect(rows.length).toBe(1);
    expect(rows[0].billing_reference_id).toBe(canonicalRef);
    expect(rows[0].locked_credits).toBe(30);
    expect(rows[0].status).toBe("active");

    // Process B (Worker 2) is a completely separate process: simulate by resetting in-memory observer state
    resetCreditObserverState({ cleanWal: false });
    expect(getPendingSettlements().length).toBe(0);

    const worker2 = createOrbitModelCreditObserver(scope, prisma);
    const call2 = {
      callId: "call-worker-2",
      inputTokensEstimate: 1000,
      maxOutputTokens: 500,
      provider: "orbit",
      modelId: "orbit-flash",
      runId,
    };

    const key2 = await worker2.beforeCall(call2 as any);
    expect(key2).toBe("call-worker-2");

    // Worker 2 discovered active reservation in PostgreSQL: NO second lockCredits HTTP call made!
    expect(mocks.lockCredits).toHaveBeenCalledTimes(1);
  });

  it("stores settlement obligations durably in PostgreSQL and survives process restarts", async () => {
    const runId = `pg-outbox-${process.pid}-${crypto.randomUUID().slice(0, 8)}`;
    const userId = `pg-user-outbox-${process.pid}`;
    const canonicalRef = `orbitbot:${userId}:${runId}`;
    testRefs.push(canonicalRef);

    mocks.lockCredits.mockResolvedValue({
      lockedCredits: 20,
      referenceId: canonicalRef,
    });
    // Control plane drops settleCredits
    mocks.settleCredits.mockResolvedValueOnce(false);

    const scope = { userId, spaceId: "test-space" };
    const observer = createOrbitModelCreditObserver(scope, prisma);

    const turnKey = await observer.beforeCall({
      callId: "turn-1",
      inputTokensEstimate: 500,
      maxOutputTokens: 500,
      provider: "orbit",
      modelId: "orbit-flash",
      runId,
    } as any);

    // 5 credits consumed
    await observer.afterCall(turnKey, { inputTokens: 5000, outputTokens: 0 });

    // Explicit finalize
    await finalizeRunCredits(runId, undefined, prisma);

    // Verify obligation persisted to PostgreSQL
    const outboxRows: any[] = await prisma.$queryRawUnsafe(
      "SELECT id, reference_id, amount, status FROM orbit_bot.settlement_outbox WHERE reference_id = $1;",
      canonicalRef,
    );
    expect(outboxRows.length).toBe(1);
    expect(outboxRows[0].reference_id).toBe(canonicalRef);
    expect(outboxRows[0].amount).toBe(5);
    expect(outboxRows[0].status).toBe("pending");

    // SIMULATE PROCESS RESTART / CRASH: clear memory
    resetCreditObserverState({ cleanWal: false });
    expect(getPendingSettlements().length).toBe(0);

    // Process reboots and recovers pending obligations from PostgreSQL
    const recovered = await recoverPendingSettlements(prisma);
    expect(recovered.length).toBeGreaterThanOrEqual(1);
    const match = recovered.find((r) => r.referenceId === canonicalRef);
    expect(match).toBeDefined();
    expect(match!.amount).toBe(5);

    // Network recovers: settleCredits succeeds
    mocks.settleCredits.mockResolvedValue(true);
    match!.nextRetryAt = Date.now() - 1000;

    const drainRes = await drainPendingSettlements(undefined, prisma);
    expect(drainRes.succeeded).toBeGreaterThanOrEqual(1);

    // Obligation in PostgreSQL is now marked 'settled'
    const finalRows: any[] = await prisma.$queryRawUnsafe(
      "SELECT id, reference_id, status FROM orbit_bot.settlement_outbox WHERE reference_id = $1;",
      canonicalRef,
    );
    expect(finalRows[0].status).toBe("settled");
  });

  it("never refunds real model usage when settlement fails against PostgreSQL", async () => {
    const runId = `pg-no-refund-${process.pid}-${crypto.randomUUID().slice(0, 8)}`;
    const userId = `pg-user-${process.pid}`;
    const canonicalRef = `orbitbot:${userId}:${runId}`;
    testRefs.push(canonicalRef);

    mocks.lockCredits.mockResolvedValue({
      lockedCredits: 15,
      referenceId: canonicalRef,
    });
    // Settle throws a network timeout
    mocks.settleCredits.mockRejectedValue(new Error("504 Gateway Timeout"));

    const scope = { userId, spaceId: "test-space" };
    const observer = createOrbitModelCreditObserver(scope, prisma);

    const turnKey = await observer.beforeCall({
      callId: "turn-no-refund",
      inputTokensEstimate: 500,
      maxOutputTokens: 500,
      provider: "orbit",
      modelId: "orbit-flash",
      runId,
    } as any);

    await observer.afterCall(turnKey, { inputTokens: 4000, outputTokens: 0 }); // 4 credits

    await finalizeRunCredits(runId, undefined, prisma);

    // NEVER refund real model usage
    expect(mocks.refundCredits).not.toHaveBeenCalled();

    // Verify obligation stored in PostgreSQL
    const rows: any[] = await prisma.$queryRawUnsafe(
      "SELECT id, reference_id, amount FROM orbit_bot.settlement_outbox WHERE reference_id = $1;",
      canonicalRef,
    );
    expect(rows.length).toBe(1);
    expect(rows[0].amount).toBe(4);
  });
});
