import fs from "node:fs";
import path from "node:path";
import type { AgentUsage, ModelCallObserver, UsageOperationKind } from "@forion/orbit-adapter-kit";
import type { PrismaClient } from "@forion/orbit-db";
import { getLogger } from "@forion/orbit-logging";
import { getOrbitControlPlaneClient } from "./orbit-control-plane-client.js";
import { resolveCanonicalPrincipalId, syncOrbitUserWithRebind } from "./orbit-user-sync.js";

interface ActiveRunState {
  runId: string;
  reservationId: string;
  userId: string;
  lockedCredits: number;
  spentCredits: number;
  activeTurns: number;
  settleTimer?: ReturnType<typeof setTimeout> | null;
}

interface ActiveTurnCall {
  reservationId: string;
  runKey?: string;
  userId: string;
  modelId: string;
  provider: string;
  lockedCredits: number;
  operationKind?: UsageOperationKind;
  startTime: number;
}

const activeRunReservations = new Map<string, ActiveRunState>();
const activeTurnCalls = new Map<string, ActiveTurnCall>();
const pendingRunLocks = new Map<string, Promise<ActiveRunState>>();

export interface PendingSettlement {
  id: string;
  userId: string;
  referenceId: string;
  amount: number;
  model: string;
  product: string;
  attempts: number;
  lastAttemptAt: number;
  nextRetryAt: number;
  lastError?: string;
  status?: "pending" | "processing" | "settled" | "failed";
}

const pendingSettlementOutbox = new Map<string, PendingSettlement>();
let outboxDrainTimer: NodeJS.Timeout | null = null;
let backgroundDrainInterval: NodeJS.Timeout | null = null;
let currentWalPath: string | null = null;

export function getWalFilePath(): string {
  if (currentWalPath) return currentWalPath;
  return (
    process.env.ORBIT_SETTLEMENT_WAL_PATH ||
    path.join(process.env.DATA_DIR || process.cwd(), ".orbit-settlement-outbox.wal.json")
  );
}

export function setWalFilePath(customPath: string | null): void {
  currentWalPath = customPath;
}

function saveWalSync(): void {
  const filePath = getWalFilePath();
  try {
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    const tempPath = `${filePath}.tmp.${process.pid}.${Date.now()}`;
    const data = JSON.stringify(Array.from(pendingSettlementOutbox.values()), null, 2);
    fs.writeFileSync(tempPath, data, "utf8");
    fs.renameSync(tempPath, filePath);
  } catch (err) {
    getLogger().warn("orbit_billing.wal_write_error", { error: (err as Error).message });
  }
}

function loadWalSync(): PendingSettlement[] {
  const filePath = getWalFilePath();
  try {
    if (!fs.existsSync(filePath)) return [];
    const raw = fs.readFileSync(filePath, "utf8");
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed;
    }
    return [];
  } catch (err) {
    getLogger().warn("orbit_billing.wal_read_error", { error: (err as Error).message });
    return [];
  }
}

async function executeDbQuery<T = unknown>(
  prisma: PrismaClient | undefined,
  sql: string,
  ...params: unknown[]
): Promise<T[]> {
  if (!prisma || typeof prisma.$queryRawUnsafe !== "function") return [];
  try {
    return (await prisma.$queryRawUnsafe(sql, ...params)) as T[];
  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : String(err);
    if (errMsg.includes("orbit_bot.") && errMsg.includes("does not exist")) {
      const fallbackSql = sql.replace(/orbit_bot\./g, "");
      return (await prisma.$queryRawUnsafe(fallbackSql, ...params)) as T[];
    }
    throw err;
  }
}

async function executeDbCommand(
  prisma: PrismaClient | undefined,
  sql: string,
  ...params: unknown[]
): Promise<number> {
  if (!prisma || typeof prisma.$executeRawUnsafe !== "function") return 0;
  try {
    return await prisma.$executeRawUnsafe(sql, ...params);
  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : String(err);
    if (errMsg.includes("orbit_bot.") && errMsg.includes("does not exist")) {
      const fallbackSql = sql.replace(/orbit_bot\./g, "");
      return await prisma.$executeRawUnsafe(fallbackSql, ...params);
    }
    throw err;
  }
}

export async function ensureOutboxTables(prisma: PrismaClient): Promise<void> {
  if (!prisma || typeof prisma.$executeRawUnsafe !== "function") return;
  try {
    await executeDbCommand(
      prisma,
      `CREATE TABLE IF NOT EXISTS orbit_bot.credit_reservations (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        billing_reference_id TEXT NOT NULL,
        locked_credits INTEGER NOT NULL,
        spent_credits INTEGER NOT NULL DEFAULT 0,
        status TEXT NOT NULL DEFAULT 'active',
        expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '90 minutes'),
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );`,
    );
    await executeDbCommand(
      prisma,
      `CREATE UNIQUE INDEX IF NOT EXISTS idx_credit_reservations_active_ref 
       ON orbit_bot.credit_reservations (user_id, billing_reference_id) 
       WHERE status IN ('active', 'settling');`,
    );
    await executeDbCommand(
      prisma,
      `CREATE TABLE IF NOT EXISTS orbit_bot.settlement_outbox (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        reference_id TEXT NOT NULL,
        amount INTEGER NOT NULL,
        model TEXT NOT NULL DEFAULT 'orbit-flash',
        product TEXT NOT NULL DEFAULT 'orbit-bot',
        status TEXT NOT NULL DEFAULT 'pending',
        attempts INTEGER NOT NULL DEFAULT 0,
        last_attempt_at TIMESTAMPTZ,
        next_retry_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        last_error TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );`,
    );
    await executeDbCommand(
      prisma,
      `CREATE UNIQUE INDEX IF NOT EXISTS idx_settlement_outbox_active_ref 
       ON orbit_bot.settlement_outbox (reference_id) 
       WHERE status IN ('pending', 'processing');`,
    );
    await executeDbCommand(
      prisma,
      `CREATE INDEX IF NOT EXISTS idx_settlement_outbox_draining 
       ON orbit_bot.settlement_outbox (status, next_retry_at);`,
    );
  } catch (err) {
    getLogger().warn("orbit_billing.ensure_tables_failed", { error: (err as Error).message });
  }
}

async function persistSettlementToDb(
  prisma: PrismaClient | undefined,
  item: PendingSettlement,
): Promise<void> {
  if (!prisma || typeof prisma.$executeRawUnsafe !== "function") return;
  try {
    const nextRetrySec = item.nextRetryAt / 1000.0;
    const lastAttemptSec = item.lastAttemptAt ? item.lastAttemptAt / 1000.0 : null;
    await executeDbCommand(
      prisma,
      `INSERT INTO orbit_bot.settlement_outbox 
         (id, user_id, reference_id, amount, model, product, status, attempts, next_retry_at, last_attempt_at, last_error, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, 'pending', $7, to_timestamp($8), to_timestamp($9), $10, NOW())
       ON CONFLICT (reference_id) WHERE status IN ('pending', 'processing')
       DO UPDATE SET 
         amount = GREATEST(orbit_bot.settlement_outbox.amount, EXCLUDED.amount),
         attempts = EXCLUDED.attempts,
         next_retry_at = EXCLUDED.next_retry_at,
         last_attempt_at = EXCLUDED.last_attempt_at,
         last_error = EXCLUDED.last_error,
         updated_at = NOW();`,
      item.id,
      item.userId,
      item.referenceId,
      item.amount,
      item.model,
      item.product,
      item.attempts,
      nextRetrySec,
      lastAttemptSec,
      item.lastError || null,
    );
  } catch (err) {
    getLogger().warn("orbit_billing.persist_outbox_db_failed", {
      referenceId: item.referenceId,
      error: (err as Error).message,
    });
  }
}

async function deleteSettlementFromDb(
  prisma: PrismaClient | undefined,
  referenceId: string,
): Promise<void> {
  if (!prisma || typeof prisma.$executeRawUnsafe !== "function") return;
  try {
    await executeDbCommand(
      prisma,
      `UPDATE orbit_bot.settlement_outbox 
       SET status = 'settled', updated_at = NOW() 
       WHERE reference_id = $1 AND status IN ('pending', 'processing');`,
      referenceId,
    );
  } catch (err) {
    getLogger().warn("orbit_billing.delete_outbox_db_failed", {
      referenceId,
      error: (err as Error).message,
    });
  }
}

async function loadSettlementsFromDb(
  prisma: PrismaClient | undefined,
): Promise<PendingSettlement[]> {
  if (!prisma || typeof prisma.$queryRawUnsafe !== "function") return [];
  try {
    const rows = await executeDbQuery<{
      id: string;
      user_id: string;
      reference_id: string;
      amount: number;
      model: string;
      product: string;
      status: string;
      attempts: number;
      last_attempt_ms: number | null;
      next_retry_ms: number;
      last_error: string | null;
    }>(
      prisma,
      `SELECT id, user_id, reference_id, amount, model, product, status, attempts,
              EXTRACT(EPOCH FROM last_attempt_at) * 1000 AS last_attempt_ms,
              EXTRACT(EPOCH FROM next_retry_at) * 1000 AS next_retry_ms,
              last_error
       FROM orbit_bot.settlement_outbox
       WHERE status = 'pending'
       ORDER BY next_retry_at ASC;`,
    );

    return rows.map((r) => ({
      id: r.id,
      userId: r.user_id,
      referenceId: r.reference_id,
      amount: Number(r.amount),
      model: r.model || "orbit-flash",
      product: r.product || "orbit-bot",
      attempts: Number(r.attempts || 0),
      lastAttemptAt: r.last_attempt_ms ? Number(r.last_attempt_ms) : Date.now(),
      nextRetryAt: r.next_retry_ms ? Number(r.next_retry_ms) : Date.now(),
      lastError: r.last_error || undefined,
      status: "pending",
    }));
  } catch (err) {
    getLogger().warn("orbit_billing.load_outbox_db_failed", { error: (err as Error).message });
    return [];
  }
}

export async function recoverPendingSettlements(
  prisma?: PrismaClient,
): Promise<PendingSettlement[]> {
  // 1. Load from DB
  const dbItems = await loadSettlementsFromDb(prisma);
  for (const item of dbItems) {
    const existing = pendingSettlementOutbox.get(item.referenceId);
    if (!existing || existing.attempts < item.attempts) {
      pendingSettlementOutbox.set(item.referenceId, item);
    }
  }

  // 2. Load from WAL file
  const walItems = loadWalSync();
  for (const item of walItems) {
    if (!pendingSettlementOutbox.has(item.referenceId)) {
      pendingSettlementOutbox.set(item.referenceId, item);
      if (prisma) {
        await persistSettlementToDb(prisma, item);
      }
    }
  }

  // 3. Reschedule drain if any pending items exist
  if (pendingSettlementOutbox.size > 0) {
    saveWalSync();
    scheduleOutboxDrain();
  }

  return Array.from(pendingSettlementOutbox.values());
}

export function getPendingSettlements(): PendingSettlement[] {
  return Array.from(pendingSettlementOutbox.values());
}

export function enqueuePendingSettlement(
  settlement: Omit<PendingSettlement, "id" | "attempts" | "lastAttemptAt" | "nextRetryAt">,
  error?: string,
  prisma?: PrismaClient,
): PendingSettlement {
  const existing = pendingSettlementOutbox.get(settlement.referenceId);
  if (existing) {
    existing.amount = Math.max(existing.amount, settlement.amount);
    existing.lastError = error || existing.lastError;
    saveWalSync();
    if (prisma) {
      persistSettlementToDb(prisma, existing).catch(() => {});
    }
    return existing;
  }

  const item: PendingSettlement = {
    id: `ps_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    userId: settlement.userId,
    referenceId: settlement.referenceId,
    amount: settlement.amount,
    model: settlement.model || "orbit-flash",
    product: settlement.product || "orbit-bot",
    attempts: 0,
    lastAttemptAt: Date.now(),
    nextRetryAt: Date.now() + 5_000,
    lastError: error,
    status: "pending",
  };

  pendingSettlementOutbox.set(settlement.referenceId, item);
  saveWalSync();
  if (prisma) {
    persistSettlementToDb(prisma, item).catch(() => {});
  }

  getLogger().warn("orbit_billing.settlement_outbox_enqueued", {
    userId: item.userId,
    referenceId: item.referenceId,
    amount: item.amount,
    error,
  });

  scheduleOutboxDrain();
  return item;
}

export async function enqueueDurableSettlement(
  settlement: Omit<PendingSettlement, "id" | "attempts" | "lastAttemptAt" | "nextRetryAt">,
  error?: string,
  prisma?: PrismaClient,
): Promise<PendingSettlement> {
  const item = enqueuePendingSettlement(settlement, error, prisma);
  if (prisma) {
    await persistSettlementToDb(prisma, item);
  }
  return item;
}

export async function drainPendingSettlements(
  client = getOrbitControlPlaneClient(),
  prisma?: PrismaClient,
): Promise<{ processed: number; succeeded: number; failed: number }> {
  let processed = 0;
  let succeeded = 0;
  let failed = 0;
  const now = Date.now();

  for (const [refId, item] of pendingSettlementOutbox.entries()) {
    if (now < item.nextRetryAt) continue;

    processed++;
    item.attempts++;
    item.lastAttemptAt = now;

    try {
      let ok = false;
      if (typeof client.settleCredits === "function") {
        ok = await client.settleCredits({
          userId: item.userId,
          amount: item.amount,
          referenceId: item.referenceId,
          model: item.model,
          product: item.product,
        });
      } else {
        ok = await client.commitCredits({
          userId: item.userId,
          amount: item.amount,
          referenceId: item.referenceId,
          product: item.product,
        });
      }

      if (ok) {
        pendingSettlementOutbox.delete(refId);
        saveWalSync();
        if (prisma) {
          await deleteSettlementFromDb(prisma, refId);
        }
        succeeded++;
        getLogger().info("orbit_billing.settlement_outbox_resolved", {
          referenceId: item.referenceId,
          userId: item.userId,
          amount: item.amount,
          attempts: item.attempts,
        });
      } else {
        failed++;
        const backoff = Math.min(300_000, 5_000 * 2 ** Math.min(item.attempts, 6));
        item.nextRetryAt = now + backoff;
        item.lastError = item.lastError || "Settlement call returned false";
        saveWalSync();
        if (prisma) {
          await persistSettlementToDb(prisma, item);
        }
        getLogger().warn("orbit_billing.settlement_outbox_retry_failed", {
          referenceId: item.referenceId,
          userId: item.userId,
          attempts: item.attempts,
          nextRetryAt: item.nextRetryAt,
        });
      }
    } catch (err) {
      failed++;
      item.lastError = (err as Error).message;
      const backoff = Math.min(300_000, 5_000 * 2 ** Math.min(item.attempts, 6));
      item.nextRetryAt = now + backoff;
      saveWalSync();
      if (prisma) {
        await persistSettlementToDb(prisma, item);
      }
      getLogger().warn("orbit_billing.settlement_outbox_retry_error", {
        referenceId: item.referenceId,
        userId: item.userId,
        attempts: item.attempts,
        error: item.lastError,
      });
    }
  }

  if (pendingSettlementOutbox.size > 0) {
    scheduleOutboxDrain();
  }

  return { processed, succeeded, failed };
}

function scheduleOutboxDrain() {
  if (outboxDrainTimer) return;
  outboxDrainTimer = setTimeout(async () => {
    outboxDrainTimer = null;
    await drainPendingSettlements();
  }, 5_000);
  if (typeof outboxDrainTimer.unref === "function") {
    outboxDrainTimer.unref();
  }
}

export function startBackgroundOutboxDrain(
  intervalMs = 15_000,
  client = getOrbitControlPlaneClient(),
  prisma?: PrismaClient,
): void {
  if (backgroundDrainInterval) return;
  backgroundDrainInterval = setInterval(async () => {
    try {
      await drainPendingSettlements(client, prisma);
    } catch (err) {
      getLogger().warn("orbit_billing.background_drain_error", { error: (err as Error).message });
    }
  }, intervalMs);
  if (typeof backgroundDrainInterval.unref === "function") {
    backgroundDrainInterval.unref();
  }
}

export function stopBackgroundOutboxDrain(): void {
  if (backgroundDrainInterval) {
    clearInterval(backgroundDrainInterval);
    backgroundDrainInterval = null;
  }
  if (outboxDrainTimer) {
    clearTimeout(outboxDrainTimer);
    outboxDrainTimer = null;
  }
}

/** Credits for a finished call: priced by cost when known, otherwise by tokens. */
export function creditCostFor(usage: AgentUsage | null): number {
  if (!usage) return 0;
  if (usage.costUsd && usage.costUsd > 0) return Math.max(1, Math.ceil(usage.costUsd / 0.002));
  const tokens = (usage.inputTokens ?? 0) + (usage.outputTokens ?? 0);
  return tokens > 0 ? Math.max(1, Math.ceil(tokens / 1000)) : 0;
}

async function settleRun(
  client: ReturnType<typeof getOrbitControlPlaneClient>,
  runState: ActiveRunState,
  prisma?: PrismaClient,
) {
  const { userId, reservationId, spentCredits, lockedCredits } = runState;
  if (lockedCredits <= 0) return;

  // Zero tokens spent: safe to refund the locked capacity
  if (spentCredits <= 0) {
    try {
      await client.refundCredits({
        userId,
        amount: lockedCredits,
        fromLocked: true,
        referenceId: reservationId,
        product: "orbit-bot",
      });
    } catch (err) {
      getLogger().warn("orbit_billing.zero_usage_refund_error", {
        userId,
        reservationId,
        error: (err as Error).message,
      });
    }
    return;
  }

  // Real tokens WERE consumed (spentCredits > 0).
  // CRITICAL RULE: NEVER REFUND CONSUMED MODEL USAGE UNDER ANY CIRCUMSTANCES.

  // 1. Prefer atomic settleCredits if available on client
  if (typeof client.settleCredits === "function") {
    try {
      const ok = await client.settleCredits({
        userId,
        amount: spentCredits,
        referenceId: reservationId,
        product: "orbit-bot",
      });
      if (!ok) {
        enqueuePendingSettlement(
          {
            userId,
            referenceId: reservationId,
            amount: spentCredits,
            model: "orbit-flash",
            product: "orbit-bot",
          },
          "settleCredits returned false",
          prisma,
        );
        getLogger().warn("orbit_billing.settlement_pending", {
          userId,
          reservationId,
          spentCredits,
          message:
            "Settlement failed on control plane; preserved pending obligation in outbox (never refunding consumed usage)",
        });
      }
      return;
    } catch (err) {
      enqueuePendingSettlement(
        {
          userId,
          referenceId: reservationId,
          amount: spentCredits,
          model: "orbit-flash",
          product: "orbit-bot",
        },
        (err as Error).message,
        prisma,
      );
      getLogger().warn("orbit_billing.settlement_error_pending", {
        userId,
        reservationId,
        spentCredits,
        error: (err as Error).message,
      });
      return;
    }
  }

  // 2. Fallback if client is a mock with separate commit/refund
  const committed = Math.min(spentCredits, lockedCredits);
  let committedOk = false;
  try {
    committedOk = await client.commitCredits({
      userId,
      amount: committed,
      referenceId: reservationId,
      product: "orbit-bot",
    });
  } catch (err) {
    committedOk = false;
    getLogger().warn("orbit_billing.commit_exception", { error: (err as Error).message });
  }

  if (!committedOk) {
    // CRITICAL: Never refund consumed credits on commit failure
    enqueuePendingSettlement(
      {
        userId,
        referenceId: reservationId,
        amount: committed,
        model: "orbit-flash",
        product: "orbit-bot",
      },
      "commitCredits returned false",
      prisma,
    );
    getLogger().warn("orbit_billing.commit_failed_pending", {
      userId,
      reservationId,
      spentCredits,
      message: "Commit failed; obligation queued in outbox, will NOT refund consumed usage",
    });
    return;
  }

  if (lockedCredits > committed) {
    try {
      await client.refundCredits({
        userId,
        amount: lockedCredits - committed,
        fromLocked: true,
        referenceId: reservationId,
        product: "orbit-bot",
      });
    } catch (err) {
      getLogger().warn("orbit_billing.remainder_refund_error", {
        userId,
        reservationId,
        error: (err as Error).message,
      });
    }
  }
}

async function settleSingleCall(
  client: ReturnType<typeof getOrbitControlPlaneClient>,
  active: ActiveTurnCall,
  usage: AgentUsage | null,
  prisma?: PrismaClient,
) {
  const { userId, reservationId, lockedCredits } = active;
  if (lockedCredits <= 0) return;

  const actual = creditCostFor(usage);
  if (actual <= 0) {
    try {
      await client.refundCredits({
        userId,
        amount: lockedCredits,
        fromLocked: true,
        referenceId: reservationId,
        product: "orbit-bot",
      });
    } catch (err) {
      getLogger().warn("orbit_billing.single_call_zero_refund_error", {
        userId,
        reservationId,
        error: (err as Error).message,
      });
    }
    return;
  }

  // Real tokens consumed (actual > 0). NEVER refund consumed usage.
  const committed = Math.min(actual, lockedCredits);
  let committedOk = false;
  try {
    committedOk = await client.commitCredits({
      userId,
      amount: committed,
      referenceId: reservationId,
      product: "orbit-bot",
    });
  } catch (err) {
    committedOk = false;
    getLogger().warn("orbit_billing.single_call_commit_error", { error: (err as Error).message });
  }

  if (!committedOk) {
    // CRITICAL: Never refund consumed credits on commit failure
    enqueuePendingSettlement(
      {
        userId,
        referenceId: reservationId,
        amount: committed,
        model: active.modelId || "orbit-flash",
        product: "orbit-bot",
      },
      "single call commit failed",
      prisma,
    );
    getLogger().warn("orbit_billing.single_call_commit_pending", {
      userId,
      reservationId,
      actual,
    });
    return;
  }

  if (lockedCredits > committed) {
    try {
      await client.refundCredits({
        userId,
        amount: lockedCredits - committed,
        fromLocked: true,
        referenceId: reservationId,
        product: "orbit-bot",
      });
    } catch (err) {
      getLogger().warn("orbit_billing.single_call_remainder_refund_error", {
        userId,
        reservationId,
        error: (err as Error).message,
      });
    }
  }
}

/**
 * Authoritatively settle active credit reservations for an execution that ended.
 * Can be called synchronously by executor when a run finishes or terminates.
 */
export async function finalizeRunCredits(
  runId: string,
  client = getOrbitControlPlaneClient(),
  prisma?: PrismaClient,
): Promise<void> {
  // Settle in-memory reservations for this runId
  for (const [key, runState] of activeRunReservations.entries()) {
    if (runState.runId === runId) {
      if (runState.settleTimer) {
        clearTimeout(runState.settleTimer);
        runState.settleTimer = null;
      }
      activeRunReservations.delete(key);
      await settleRun(client, runState, prisma);
    }
  }

  // Also coordinate distributed reservations in PostgreSQL if prisma is present
  if (prisma && typeof prisma.$queryRawUnsafe === "function") {
    try {
      const claimRows: Array<{
        id: string;
        user_id: string;
        billing_reference_id: string;
        locked_credits: number;
        spent_credits: number;
      }> = await executeDbQuery(
        prisma,
        `UPDATE orbit_bot.credit_reservations 
         SET status = 'settling', updated_at = NOW() 
         WHERE billing_reference_id LIKE $1 AND status = 'active'
         RETURNING id, user_id, billing_reference_id, locked_credits, spent_credits;`,
        `%:${runId}`,
      );

      for (const row of claimRows) {
        const state: ActiveRunState = {
          runId,
          reservationId: row.billing_reference_id,
          userId: row.user_id,
          lockedCredits: Number(row.locked_credits),
          spentCredits: Number(row.spent_credits || 0),
          activeTurns: 0,
        };
        await settleRun(client, state, prisma);
        await executeDbCommand(
          prisma,
          `UPDATE orbit_bot.credit_reservations 
           SET status = $1, updated_at = NOW() 
           WHERE id = $2;`,
          state.spentCredits > 0 ? "consumed" : "released",
          row.id,
        );
      }
    } catch (err) {
      getLogger().warn("orbit_billing.finalize_db_settlement_failed", {
        runId,
        error: (err as Error).message,
      });
    }
  }
}

/** Resets in-memory observer state and optionally WAL file between test runs. */
export function resetCreditObserverState(options?: { cleanWal?: boolean }): void {
  stopBackgroundOutboxDrain();
  for (const runState of activeRunReservations.values()) {
    if (runState.settleTimer) {
      clearTimeout(runState.settleTimer);
    }
  }
  pendingSettlementOutbox.clear();
  activeRunReservations.clear();
  activeTurnCalls.clear();
  pendingRunLocks.clear();

  if (options?.cleanWal) {
    const walFile = getWalFilePath();
    if (fs.existsSync(walFile)) {
      try {
        fs.unlinkSync(walFile);
      } catch {
        // ignore
      }
    }
  }
}

async function lockCreditsWithAutoSync(
  client: ReturnType<typeof getOrbitControlPlaneClient>,
  scope: { userId: string; spaceId: string },
  params: {
    model: string;
    inputTokens: number;
    maxOutputTokens: number;
    product: string;
    referenceId: string;
  },
  prisma?: PrismaClient,
): Promise<{ lockedCredits: number; referenceId: string; effectiveUserId: string }> {
  // Orbit Chat and Orbit Bot share one Forion wallet. The local sign-in id may
  // be mapped to an existing canonical Forion user; lock against that id from
  // the first call, not only after Forion answers "User not found".
  const canonicalUserId = prisma
    ? await resolveCanonicalPrincipalId(prisma, scope.userId)
    : scope.userId;
  if (canonicalUserId !== scope.userId) {
    scope.userId = canonicalUserId;
  }
  try {
    const res = await client.lockCredits({
      userId: canonicalUserId,
      ...params,
    });
    return { ...res, effectiveUserId: canonicalUserId };
  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : String(err);
    if (errMsg.includes("User not found") && prisma) {
      getLogger().info("orbit_billing.lazy_user_sync_attempt", {
        userId: scope.userId,
      });
      const syncRes = await syncOrbitUserWithRebind(prisma, scope.userId);
      if (syncRes.ok) {
        const effectiveUserId = syncRes.canonicalUserId || scope.userId;
        scope.userId = effectiveUserId;
        const newRef = params.referenceId.includes(scope.userId)
          ? params.referenceId
          : params.referenceId.replace(/orbitbot:[^:]+:/, `orbitbot:${effectiveUserId}:`);
        const res = await client.lockCredits({
          userId: effectiveUserId,
          ...params,
          referenceId: newRef,
        });
        return { ...res, effectiveUserId };
      }
    }
    throw err;
  }
}

/**
 * Orbit Credit Observer for Orbit.
 *
 * Plugs into the PiAgentRuntime's ModelCallObserver hook.
 * Awaited BEFORE models.streamSimple begins, enforcing strict fail-closed balance verification
 * against Orbit's Microservices Control Plane (`forion-server`).
 *
 * Enforces distributed reservation uniqueness in PostgreSQL so concurrent workers for the same execution
 * (orbitbot:${userId}:${runId}) cannot create duplicate locks.
 * Persists all settlement obligations durably in PostgreSQL + WAL file to survive process restarts, crashes,
 * and network partitions.
 */
export function createOrbitModelCreditObserver(
  scope: {
    userId: string;
    spaceId: string;
  },
  prisma?: PrismaClient,
): ModelCallObserver {
  const client = getOrbitControlPlaneClient();

  return {
    async beforeCall(call) {
      const inputTokens = call.inputTokensEstimate || 120;
      const maxOutput = call.maxOutputTokens || 4096;

      if (call.runId) {
        const runKey = `${scope.userId}:${call.runId}`;
        let runState = activeRunReservations.get(runKey);

        if (!runState) {
          // Single-flight in-process promise
          let pendingPromise = pendingRunLocks.get(runKey);
          if (!pendingPromise) {
            pendingPromise = (async () => {
              try {
                const canonicalRef = `orbitbot:${scope.userId}:${call.runId}`;

                // Distributed reservation uniqueness in PostgreSQL across separate worker processes
                if (prisma && typeof prisma.$queryRawUnsafe === "function") {
                  try {
                    // 1. Check if active reservation already exists in PostgreSQL
                    // 1. Check if ANY reservation already exists in PostgreSQL across full lifecycle (permanent execution idempotency)
                    const existingRows = await executeDbQuery<{
                      id: string;
                      billing_reference_id: string;
                      locked_credits: number;
                      spent_credits: number;
                      status: string;
                    }>(
                      prisma,
                      `SELECT id, billing_reference_id, locked_credits, spent_credits, status 
                       FROM orbit_bot.credit_reservations 
                       WHERE user_id = $1 AND billing_reference_id = $2
                       ORDER BY created_at DESC
                       LIMIT 1;`,
                      scope.userId,
                      canonicalRef,
                    );

                    if (existingRows.length > 0) {
                      const row = existingRows[0]!;
                      // Permanent execution idempotency: if terminal state reached, prevent duplicate charges
                      const isTerminal = ["consumed", "released", "settled"].includes(row.status);
                      const state: ActiveRunState = {
                        runId: call.runId!,
                        reservationId: row.billing_reference_id || canonicalRef,
                        userId: scope.userId,
                        lockedCredits: isTerminal ? 0 : Number(row.locked_credits),
                        spentCredits: Number(row.spent_credits || 0),
                        activeTurns: 0,
                        settleTimer: null,
                      };
                      activeRunReservations.set(runKey, state);
                      return state;
                    }

                    // 2. Lock credits via control plane (with auto-sync)
                    const { lockedCredits, referenceId, effectiveUserId } =
                      await lockCreditsWithAutoSync(
                        client,
                        scope,
                        {
                          model: call.modelId,
                          inputTokens,
                          maxOutputTokens: maxOutput,
                          product: "orbit-bot",
                          referenceId: canonicalRef,
                        },
                        prisma,
                      );

                    // 3. Atomically upsert reservation into PostgreSQL
                    const reservationId = `res_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
                    const insertRows = await executeDbQuery<{
                      id: string;
                      billing_reference_id: string;
                      locked_credits: number;
                      spent_credits: number;
                    }>(
                      prisma,
                      `INSERT INTO orbit_bot.credit_reservations 
                         (id, user_id, billing_reference_id, locked_credits, spent_credits, status, expires_at)
                       VALUES ($1, $2, $3, $4, 0, 'active', NOW() + INTERVAL '90 minutes')
                       ON CONFLICT (user_id, billing_reference_id) WHERE status IN ('active', 'settling')
                       DO UPDATE SET updated_at = NOW()
                       RETURNING id, billing_reference_id, locked_credits, spent_credits;`,
                      reservationId,
                      effectiveUserId,
                      referenceId,
                      lockedCredits,
                    );

                    const finalRow = insertRows[0];
                    const state: ActiveRunState = {
                      runId: call.runId!,
                      reservationId: referenceId,
                      userId: effectiveUserId,
                      lockedCredits: Number(finalRow?.locked_credits ?? lockedCredits),
                      spentCredits: Number(finalRow?.spent_credits ?? 0),
                      activeTurns: 0,
                      settleTimer: null,
                    };
                    activeRunReservations.set(runKey, state);
                    return state;
                  } catch (dbErr) {
                    getLogger().warn("orbit_billing.db_reservation_check_failed", {
                      error: (dbErr as Error).message,
                    });
                  }
                }

                // In-memory fallback (when prisma is not passed or DB unreachable)
                const { lockedCredits, referenceId, effectiveUserId } =
                  await lockCreditsWithAutoSync(
                    client,
                    scope,
                    {
                      model: call.modelId,
                      inputTokens,
                      maxOutputTokens: maxOutput,
                      product: "orbit-bot",
                      referenceId: canonicalRef,
                    },
                    prisma,
                  );

                const state: ActiveRunState = {
                  runId: call.runId!,
                  reservationId: referenceId,
                  userId: effectiveUserId,
                  lockedCredits,
                  spentCredits: 0,
                  activeTurns: 0,
                  settleTimer: null,
                };
                activeRunReservations.set(runKey, state);
                return state;
              } finally {
                pendingRunLocks.delete(runKey);
              }
            })();
            pendingRunLocks.set(runKey, pendingPromise);
          }
          runState = await pendingPromise;
        }

        // Re-use parent execution reservation for this turn
        if (runState.settleTimer) {
          clearTimeout(runState.settleTimer);
          runState.settleTimer = null;
        }
        runState.activeTurns++;

        const turnKey =
          call.callId || `turn_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
        activeTurnCalls.set(turnKey, {
          reservationId: runState.reservationId,
          runKey,
          userId: runState.userId,
          modelId: call.modelId,
          provider: call.provider,
          lockedCredits: runState.lockedCredits,
          operationKind: call.operationKind,
          startTime: Date.now(),
        });
        return turnKey;
      }

      // Standalone call without runId (e.g. ad-hoc model probes, unit tests)
      const callId =
        call.callId || `orbit_call_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
      const { lockedCredits, referenceId, effectiveUserId } = await lockCreditsWithAutoSync(
        client,
        scope,
        {
          model: call.modelId,
          inputTokens,
          maxOutputTokens: maxOutput,
          product: "orbit-bot",
          referenceId: callId,
        },
        prisma,
      );

      activeTurnCalls.set(referenceId, {
        reservationId: referenceId,
        userId: effectiveUserId,
        modelId: call.modelId,
        provider: call.provider,
        lockedCredits,
        operationKind: call.operationKind,
        startTime: Date.now(),
      });

      return referenceId;
    },

    async afterCall(reservationId, usage: AgentUsage | null) {
      const active = activeTurnCalls.get(reservationId);
      activeTurnCalls.delete(reservationId);
      if (!active) return;

      if (active.runKey) {
        const runState = activeRunReservations.get(active.runKey);
        if (!runState) return;

        const actual = creditCostFor(usage);
        runState.spentCredits += actual;
        runState.activeTurns = Math.max(0, runState.activeTurns - 1);

        if (prisma && typeof prisma.$executeRawUnsafe === "function" && actual > 0) {
          executeDbCommand(
            prisma,
            `UPDATE orbit_bot.credit_reservations 
             SET spent_credits = spent_credits + $1, updated_at = NOW() 
             WHERE billing_reference_id = $2 AND status = 'active';`,
            actual,
            runState.reservationId,
          ).catch((err) => {
            getLogger().warn("orbit_billing.db_spent_credits_update_failed", {
              error: (err as Error).message,
            });
          });
        }

        if (runState.settleTimer) {
          clearTimeout(runState.settleTimer);
        }

        // Schedule settlement after turns finish (quiesce debounce)
        const key = active.runKey;
        runState.settleTimer = setTimeout(async () => {
          activeRunReservations.delete(key);
          await settleRun(client, runState, prisma);
        }, 1500);
        return;
      }

      await settleSingleCall(client, active, usage, prisma);
    },

    async onRequestId(reservationId, providerRequestId) {
      getLogger().info("orbit_billing.call_connected", {
        reservationId,
        providerRequestId,
      });
    },
  };
}
