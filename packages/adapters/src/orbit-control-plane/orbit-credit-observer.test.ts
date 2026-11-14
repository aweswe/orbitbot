import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

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
  enqueueDurableSettlement,
  enqueuePendingSettlement,
  finalizeRunCredits,
  getPendingSettlements,
  recoverPendingSettlements,
  resetCreditObserverState,
  setWalFilePath,
} from "./orbit-credit-observer.js";

const scope = { userId: "user-1", spaceId: "space-1" };
const call = {
  callId: "call-1",
  inputTokensEstimate: 1000,
  maxOutputTokens: 500,
  provider: "orbit",
  modelId: "orbit-flash",
} as Parameters<ReturnType<typeof createOrbitModelCreditObserver>["beforeCall"]>[0];

const testWalDir = path.join(os.tmpdir(), `orbit-wal-test-${process.pid}`);
const testWalFile = path.join(testWalDir, "test-wal.json");

beforeEach(() => {
  vi.clearAllMocks();
  setWalFilePath(testWalFile);
  resetCreditObserverState({ cleanWal: true });
  mocks.commitCredits.mockResolvedValue(true);
  mocks.refundCredits.mockResolvedValue(true);
  mocks.settleCredits.mockResolvedValue(true);
});

afterEach(() => {
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

describe("Orbit credit observer — lock", () => {
  it("fails closed when the control plane cannot lock credits", async () => {
    mocks.lockCredits.mockRejectedValue(new Error("control plane unreachable"));
    const observer = createOrbitModelCreditObserver(scope);

    await expect(observer.beforeCall(call)).rejects.toThrow("control plane unreachable");
  });

  it("returns the control plane reference id for settlement", async () => {
    mocks.lockCredits.mockResolvedValue({ lockedCredits: 7, referenceId: "call-1" });
    const observer = createOrbitModelCreditObserver(scope);

    await expect(observer.beforeCall(call)).resolves.toBe("call-1");
    expect(mocks.lockCredits).toHaveBeenCalledWith(
      expect.objectContaining({ userId: "user-1", model: "orbit-flash", referenceId: "call-1" }),
    );
  });

  it("locks against an existing canonical identity mapping first", async () => {
    mocks.lockCredits.mockResolvedValue({ lockedCredits: 7, referenceId: "call-1" });
    const prismaMock = {
      identityMapping: {
        findFirst: vi.fn(async () => ({
          canonicalPrincipalId: "user-canonical",
          provider: "google",
          providerSubject: "google-sub",
        })),
      },
    } as any;

    const observer = createOrbitModelCreditObserver({ ...scope }, prismaMock);
    await expect(observer.beforeCall(call)).resolves.toBe("call-1");
    expect(mocks.lockCredits).toHaveBeenCalledWith(
      expect.objectContaining({ userId: "user-canonical", referenceId: "call-1" }),
    );
  });

  it("auto-syncs and retries when control plane reports User not found", async () => {
    mocks.lockCredits
      .mockRejectedValueOnce(new Error("400: User not found"))
      .mockResolvedValueOnce({ lockedCredits: 5, referenceId: "call-rebound" });

    const prismaMock = {
      $transaction: vi.fn(async (cb) => cb(prismaMock)),
      user: {
        findUnique: vi.fn(async ({ where }: { where: { id: string } }) => {
          if (where.id === "user-1")
            return { id: "user-1", email: "test@example.com", name: "Test" };
          if (where.id === "user-canonical")
            return { id: "user-canonical", email: "test@example.com", name: "Test" };
          return null;
        }),
        findFirst: vi.fn().mockResolvedValue({ id: "user-canonical" }),
        create: vi.fn(),
        delete: vi.fn(),
      },
      account: {
        findFirst: vi.fn().mockResolvedValue({ accountId: "google-123" }),
        updateMany: vi.fn(),
      },
      session: {
        updateMany: vi.fn(),
      },
      member: {
        findMany: vi.fn().mockResolvedValue([]),
        deleteMany: vi.fn(),
        updateMany: vi.fn(),
      },
      spaceMember: {
        findMany: vi.fn().mockResolvedValue([]),
        deleteMany: vi.fn(),
        updateMany: vi.fn(),
      },
    } as any;

    const origFetch = globalThis.fetch;
    const origEnvUrl = process.env.FORION_SERVER_URL;
    const origEnvSecret = process.env.FORION_ORBIT_INTERNAL_SECRET;
    process.env.FORION_SERVER_URL = "http://localhost:3001";
    process.env.FORION_ORBIT_INTERNAL_SECRET = "secret";

    globalThis.fetch = vi
      .fn()
      .mockResolvedValueOnce({
        ok: false,
        status: 409,
        json: async () => ({ canonicalUserId: "user-canonical" }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ ok: true }),
      }) as any;

    try {
      const observer = createOrbitModelCreditObserver({ ...scope }, prismaMock);
      const res = await observer.beforeCall(call);
      expect(res).toBe("call-rebound");
      expect(mocks.lockCredits).toHaveBeenCalledTimes(2);
      expect(mocks.lockCredits).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({ userId: "user-canonical" }),
      );
    } finally {
      globalThis.fetch = origFetch;
      process.env.FORION_SERVER_URL = origEnvUrl;
      process.env.FORION_ORBIT_INTERNAL_SECRET = origEnvSecret;
    }
  });
});

describe("Orbit credit observer — settlement", () => {
  it("commits the actual cost and refunds only the unused part of the lock", async () => {
    mocks.lockCredits.mockResolvedValue({ lockedCredits: 10, referenceId: "call-1" });
    const observer = createOrbitModelCreditObserver(scope);
    const referenceId = await observer.beforeCall(call);

    // 1_100 tokens at 1 credit / 1_000 tokens → 2 credits actual.
    await observer.afterCall(referenceId, { inputTokens: 600, outputTokens: 500 });

    expect(mocks.commitCredits).toHaveBeenCalledWith(
      expect.objectContaining({ userId: "user-1", amount: 2, referenceId: "call-1" }),
    );
    expect(mocks.refundCredits).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "user-1",
        amount: 8,
        fromLocked: true,
        referenceId: "call-1",
      }),
    );
  });

  it("never commits more than was locked", async () => {
    mocks.lockCredits.mockResolvedValue({ lockedCredits: 3, referenceId: "call-1" });
    const observer = createOrbitModelCreditObserver(scope);
    const referenceId = await observer.beforeCall(call);

    await observer.afterCall(referenceId, { inputTokens: 90_000, outputTokens: 90_000 });

    expect(mocks.commitCredits).toHaveBeenCalledWith(expect.objectContaining({ amount: 3 }));
    expect(mocks.refundCredits).not.toHaveBeenCalled();
  });

  it("refunds the whole lock when the call produced no usage", async () => {
    mocks.lockCredits.mockResolvedValue({ lockedCredits: 5, referenceId: "call-1" });
    const observer = createOrbitModelCreditObserver(scope);
    const referenceId = await observer.beforeCall(call);

    await observer.afterCall(referenceId, null);

    expect(mocks.commitCredits).not.toHaveBeenCalled();
    expect(mocks.refundCredits).toHaveBeenCalledWith(
      expect.objectContaining({ amount: 5, fromLocked: true }),
    );
  });

  it("preserves the obligation and does not refund when commit is rejected", async () => {
    mocks.lockCredits.mockResolvedValue({ lockedCredits: 6, referenceId: "call-1" });
    mocks.commitCredits.mockResolvedValue(false);
    const observer = createOrbitModelCreditObserver(scope);
    const referenceId = await observer.beforeCall(call);

    await observer.afterCall(referenceId, { inputTokens: 2000, outputTokens: 0 });

    expect(mocks.commitCredits).toHaveBeenCalled();
    expect(mocks.refundCredits).not.toHaveBeenCalled();
  });

  it("locks once for multiple turns under the same runId and settles atomically", async () => {
    vi.useFakeTimers();
    mocks.lockCredits.mockResolvedValue({
      lockedCredits: 20,
      referenceId: "orbitbot:user-1:run-1",
    });
    const observer = createOrbitModelCreditObserver(scope);

    // Turn 1
    const turn1Key = await observer.beforeCall({
      ...call,
      callId: "turn-1",
      runId: "run-1",
    });
    expect(mocks.lockCredits).toHaveBeenCalledTimes(1);
    expect(mocks.lockCredits).toHaveBeenCalledWith(
      expect.objectContaining({ referenceId: "orbitbot:user-1:run-1" }),
    );

    // Turn 1 finishes with 3 credits
    await observer.afterCall(turn1Key, { inputTokens: 1500, outputTokens: 1500 });

    // Turn 2 starts before timer fires
    const turn2Key = await observer.beforeCall({
      ...call,
      callId: "turn-2",
      runId: "run-1",
    });
    // Still only 1 lock!
    expect(mocks.lockCredits).toHaveBeenCalledTimes(1);

    // Turn 2 finishes with 4 credits
    await observer.afterCall(turn2Key, { inputTokens: 2000, outputTokens: 2000 });

    // Advance timer past debounce
    await vi.advanceTimersByTimeAsync(1600);

    // Settled atomically with total = 3 + 4 = 7 credits
    expect(mocks.settleCredits).toHaveBeenCalledTimes(1);
    expect(mocks.settleCredits).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "user-1",
        amount: 7,
        referenceId: "orbitbot:user-1:run-1",
      }),
    );
    vi.useRealTimers();
  });

  it("handles two simultaneous first model requests with single-flight mutex", async () => {
    let resolveLock!: (val: { lockedCredits: number; referenceId: string }) => void;
    mocks.lockCredits.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveLock = resolve;
        }),
    );
    const observer = createOrbitModelCreditObserver(scope);

    // Call A and Call B launch at the exact same time for run-parallel
    const promiseA = observer.beforeCall({ ...call, callId: "turn-a", runId: "run-parallel" });
    const promiseB = observer.beforeCall({ ...call, callId: "turn-b", runId: "run-parallel" });

    // Only 1 outbound lock call!
    expect(mocks.lockCredits).toHaveBeenCalledTimes(1);
    expect(mocks.lockCredits).toHaveBeenCalledWith(
      expect.objectContaining({ referenceId: "orbitbot:user-1:run-parallel" }),
    );

    // Complete the lock
    resolveLock({ lockedCredits: 25, referenceId: "orbitbot:user-1:run-parallel" });

    const [keyA, keyB] = await Promise.all([promiseA, promiseB]);
    expect(keyA).toBe("turn-a");
    expect(keyB).toBe("turn-b");
    expect(mocks.lockCredits).toHaveBeenCalledTimes(1);
  });

  it("allocates separate reservations for independent user executions", async () => {
    mocks.lockCredits
      .mockResolvedValueOnce({ lockedCredits: 10, referenceId: "orbitbot:user-1:exec-1" })
      .mockResolvedValueOnce({ lockedCredits: 10, referenceId: "orbitbot:user-1:exec-2" });

    const observer = createOrbitModelCreditObserver(scope);

    await observer.beforeCall({ ...call, callId: "c1", runId: "exec-1" });
    await observer.beforeCall({ ...call, callId: "c2", runId: "exec-2" });

    expect(mocks.lockCredits).toHaveBeenCalledTimes(2);
    expect(mocks.lockCredits).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ referenceId: "orbitbot:user-1:exec-1" }),
    );
    expect(mocks.lockCredits).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ referenceId: "orbitbot:user-1:exec-2" }),
    );
  });

  it("settles immediately when finalizeRunCredits is called explicitly", async () => {
    mocks.lockCredits.mockResolvedValue({
      lockedCredits: 15,
      referenceId: "orbitbot:user-1:run-term",
    });
    const observer = createOrbitModelCreditObserver(scope);

    const turnKey = await observer.beforeCall({ ...call, callId: "t1", runId: "run-term" });
    await observer.afterCall(turnKey, { inputTokens: 5000, outputTokens: 0 }); // 5 credits

    // Explicit execution lifecycle termination
    await finalizeRunCredits("run-term");

    expect(mocks.settleCredits).toHaveBeenCalledTimes(1);
    expect(mocks.settleCredits).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "user-1",
        amount: 5,
        referenceId: "orbitbot:user-1:run-term",
      }),
    );
  });

  it("enqueues failed settlement into the outbox and drains successfully upon recovery", async () => {
    mocks.lockCredits.mockResolvedValue({
      lockedCredits: 10,
      referenceId: "orbitbot:user-1:run-failed-settle",
    });
    mocks.settleCredits.mockResolvedValueOnce(false); // Fails first attempt

    const observer = createOrbitModelCreditObserver(scope);
    const turnKey = await observer.beforeCall({
      ...call,
      callId: "t-fail",
      runId: "run-failed-settle",
    });
    await observer.afterCall(turnKey, { inputTokens: 4000, outputTokens: 0 }); // 4 credits

    await finalizeRunCredits("run-failed-settle");

    // Outbox must contain the pending settlement
    const pending = getPendingSettlements();
    expect(pending.length).toBe(1);
    const firstPending = pending[0]!;
    expect(firstPending.referenceId).toBe("orbitbot:user-1:run-failed-settle");
    expect(firstPending.amount).toBe(4);

    // Network recovers: settleCredits returns true
    mocks.settleCredits.mockResolvedValueOnce(true);
    // Fast-forward or force nextRetryAt to now
    firstPending.nextRetryAt = Date.now() - 1000;

    const drainResult = await drainPendingSettlements();
    expect(drainResult.succeeded).toBe(1);
    expect(getPendingSettlements().length).toBe(0);
  });
});

describe("P0 Crash Recovery & Durable WAL Outbox", () => {
  it("survives process crash / restart by recovering un-settled obligations from disk WAL", async () => {
    mocks.lockCredits.mockResolvedValue({
      lockedCredits: 12,
      referenceId: "orbitbot:user-1:run-crash-test",
    });
    mocks.settleCredits.mockResolvedValueOnce(false); // Control plane drops settle

    const observer = createOrbitModelCreditObserver(scope);
    const turnKey = await observer.beforeCall({
      ...call,
      callId: "t-crash",
      runId: "run-crash-test",
    });
    await observer.afterCall(turnKey, { inputTokens: 5000, outputTokens: 0 }); // 5 credits

    await finalizeRunCredits("run-crash-test");

    // Verify WAL file was created on disk
    expect(fs.existsSync(testWalFile)).toBe(true);
    const walRaw = JSON.parse(fs.readFileSync(testWalFile, "utf8"));
    expect(walRaw.length).toBe(1);
    expect(walRaw[0].referenceId).toBe("orbitbot:user-1:run-crash-test");
    expect(walRaw[0].amount).toBe(5);

    // SIMULATE PROCESS CRASH: wipe in-memory observer state
    resetCreditObserverState({ cleanWal: false });
    expect(getPendingSettlements().length).toBe(0);

    // SIMULATE PROCESS RESTART: recover pending obligations from WAL on disk
    const recovered = await recoverPendingSettlements();
    expect(recovered.length).toBe(1);
    expect(recovered[0]!.referenceId).toBe("orbitbot:user-1:run-crash-test");
    expect(recovered[0]!.amount).toBe(5);

    // Control plane recovers: settle succeeds
    mocks.settleCredits.mockResolvedValue(true);
    recovered[0]!.nextRetryAt = Date.now() - 1000;

    const drainResult = await drainPendingSettlements();
    expect(drainResult.succeeded).toBe(1);
    expect(getPendingSettlements().length).toBe(0);

    // WAL file on disk is cleaned up after settlement resolution
    const walAfter = JSON.parse(fs.readFileSync(testWalFile, "utf8"));
    expect(walAfter.length).toBe(0);
  });

  it("applies exponential backoff on repeated settlement failures", async () => {
    const item = enqueuePendingSettlement({
      userId: "user-1",
      referenceId: "orbitbot:user-1:run-backoff",
      amount: 8,
      model: "orbit-flash",
      product: "orbit-bot",
    });

    mocks.settleCredits.mockResolvedValue(false);

    // Force retry 1
    item.nextRetryAt = Date.now() - 1000;
    const now1 = Date.now();
    await drainPendingSettlements();
    expect(item.attempts).toBe(1);
    // Backoff for attempt 1: 5_000 * 2^1 = 10_000 ms
    expect(item.nextRetryAt).toBeGreaterThanOrEqual(now1 + 9_000);

    // Force retry 2
    item.nextRetryAt = Date.now() - 1000;
    const now2 = Date.now();
    await drainPendingSettlements();
    expect(item.attempts).toBe(2);
    // Backoff for attempt 2: 5_000 * 2^2 = 20_000 ms
    expect(item.nextRetryAt).toBeGreaterThanOrEqual(now2 + 19_000);
  });
});

describe("P0 Financial Correctness — Real model usage is NEVER refunded", () => {
  it("never refunds real model usage when single-call commitCredits throws a network exception", async () => {
    mocks.lockCredits.mockResolvedValue({ lockedCredits: 8, referenceId: "call-throw-1" });
    mocks.commitCredits.mockRejectedValue(new Error("ECONNRESET: socket hang up"));

    const observer = createOrbitModelCreditObserver(scope);
    const referenceId = await observer.beforeCall(call);

    // 3 credits of actual usage consumed
    await observer.afterCall(referenceId, { inputTokens: 3000, outputTokens: 0 });

    // Commit threw an exception, but usage was real (> 0).
    // CRITICAL: refundCredits MUST NOT be called!
    expect(mocks.refundCredits).not.toHaveBeenCalled();

    // Obligation must be safely preserved in durable outbox
    const pending = getPendingSettlements();
    expect(pending.length).toBe(1);
    expect(pending[0]!.referenceId).toBe("call-throw-1");
    expect(pending[0]!.amount).toBe(3);
  });

  it("never refunds real model usage when settleCredits throws a network timeout", async () => {
    mocks.lockCredits.mockResolvedValue({
      lockedCredits: 20,
      referenceId: "orbitbot:user-1:run-timeout",
    });
    mocks.settleCredits.mockRejectedValue(new Error("ETIMEDOUT: upstream gateway unreachable"));

    const observer = createOrbitModelCreditObserver(scope);
    const turnKey = await observer.beforeCall({
      ...call,
      callId: "turn-timeout",
      runId: "run-timeout",
    });

    // 6 credits consumed
    await observer.afterCall(turnKey, { inputTokens: 6000, outputTokens: 0 });

    await finalizeRunCredits("run-timeout");

    // Settle threw error. Consumed tokens must NOT be refunded!
    expect(mocks.refundCredits).not.toHaveBeenCalled();

    // Preserved in durable outbox
    const pending = getPendingSettlements();
    expect(pending.length).toBe(1);
    expect(pending[0]!.referenceId).toBe("orbitbot:user-1:run-timeout");
    expect(pending[0]!.amount).toBe(6);
  });

  it("never refunds real model usage during execution termination", async () => {
    mocks.lockCredits.mockResolvedValue({
      lockedCredits: 15,
      referenceId: "orbitbot:user-1:run-fail-settle",
    });
    mocks.settleCredits.mockResolvedValue(false);

    const observer = createOrbitModelCreditObserver(scope);
    const turnKey = await observer.beforeCall({
      ...call,
      callId: "turn-fail",
      runId: "run-fail-settle",
    });

    await observer.afterCall(turnKey, { inputTokens: 4000, outputTokens: 0 }); // 4 credits

    await finalizeRunCredits("run-fail-settle");

    // Must NOT refund the consumed 4 credits
    expect(mocks.refundCredits).not.toHaveBeenCalled();

    // Must be in outbox
    expect(getPendingSettlements()[0]!.amount).toBe(4);
  });
});

describe("P0 Distributed Reservation Uniqueness in PostgreSQL", () => {
  it("concurrent workers for the same execution reuse active reservation from PostgreSQL without duplicate locks", async () => {
    const mockDbReservation = {
      id: "res-pg-1",
      billing_reference_id: "orbitbot:user-1:run-distributed",
      locked_credits: 25,
      spent_credits: 0,
      status: "active",
    };

    let dbRows: any[] = [];
    const mockPrisma = {
      $queryRawUnsafe: vi.fn(async (sql: string, ..._params: any[]) => {
        if (sql.includes("SELECT") && sql.includes("credit_reservations")) {
          // If already in db, return it
          return dbRows;
        }
        if (sql.includes("INSERT INTO") && sql.includes("credit_reservations")) {
          dbRows = [mockDbReservation];
          return dbRows;
        }
        return [];
      }),
      $executeRawUnsafe: vi.fn().mockResolvedValue(1),
    } as any;

    mocks.lockCredits.mockResolvedValue({
      lockedCredits: 25,
      referenceId: "orbitbot:user-1:run-distributed",
    });

    // Worker 1 runs
    const worker1 = createOrbitModelCreditObserver(scope, mockPrisma);
    const key1 = await worker1.beforeCall({
      ...call,
      callId: "worker-1-turn",
      runId: "run-distributed",
    });

    expect(key1).toBe("worker-1-turn");
    expect(mocks.lockCredits).toHaveBeenCalledTimes(1);

    // Worker 2 (separate observer representing separate process/container)
    resetCreditObserverState({ cleanWal: false }); // Reset local in-memory observer state to simulate isolated worker process

    const worker2 = createOrbitModelCreditObserver(scope, mockPrisma);
    const key2 = await worker2.beforeCall({
      ...call,
      callId: "worker-2-turn",
      runId: "run-distributed",
    });

    expect(key2).toBe("worker-2-turn");
    // Worker 2 retrieved active reservation from PostgreSQL — lockCredits was NOT called again!
    expect(mocks.lockCredits).toHaveBeenCalledTimes(1);
  });

  it("persists and synchronizes settlement outbox in PostgreSQL", async () => {
    const executedCommands: string[] = [];
    const mockPrisma = {
      $queryRawUnsafe: vi.fn().mockResolvedValue([]),
      $executeRawUnsafe: vi.fn(async (sql: string) => {
        executedCommands.push(sql);
        return 1;
      }),
    } as any;

    await enqueueDurableSettlement(
      {
        userId: "user-1",
        referenceId: "orbitbot:user-1:run-durable-pg",
        amount: 10,
        model: "orbit-flash",
        product: "orbit-bot",
      },
      "Test failure",
      mockPrisma,
    );

    // Verified database insert command was executed
    expect(
      executedCommands.some((c) => c.includes("INSERT INTO") && c.includes("settlement_outbox")),
    ).toBe(true);

    // Settle successfully and verify DB update
    mocks.settleCredits.mockResolvedValue(true);
    const item = getPendingSettlements()[0]!;
    item.nextRetryAt = Date.now() - 1000;

    await drainPendingSettlements(undefined, mockPrisma);
    expect(executedCommands.some((c) => c.includes("UPDATE") && c.includes("settled"))).toBe(true);
  });
});
