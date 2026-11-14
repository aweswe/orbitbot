import crypto from "node:crypto";
import fs from "node:fs";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
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

/**
 * Hermetic half: an in-process verifier for the HMAC v2 contract. It never
 * contacts Forion and never reads the repo `.env`. The real guard is covered by
 * Forion's orbit-identity.guard.spec.ts.
 */
describe("HMAC v2 request signing (hermetic)", () => {
  const secret = "test-forion-secret";
  const userId = "test-user";
  const signaturePath = "/api/ai/chat/completions";
  let server: ReturnType<typeof createServer>;
  let baseUrl = "";

  beforeAll(async () => {
    server = createServer((req, res) => {
      const ts = String(req.headers["x-orbit-req-ts"] ?? "");
      const sig = String(req.headers["x-orbit-req-sig"] ?? "");
      const headerUser = String(req.headers["x-orbit-user-id"] ?? "");
      const expected = crypto
        .createHmac("sha256", secret)
        .update(`v2|${req.method}|${headerUser}|${req.url}|${ts}`)
        .digest("base64");
      if (!sig || sig !== expected) {
        res.writeHead(401, { "content-type": "application/json" });
        res.end(JSON.stringify({ error: "invalid signature" }));
        return;
      }
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({ ok: true }));
    });
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });

  afterAll(async () => {
    await new Promise<void>((resolve, reject) =>
      server.close((err) => (err ? reject(err) : resolve())),
    );
  });

  it("accepts a correctly signed request", async () => {
    const headers = signOrbitInternalRequest(secret, "POST", signaturePath, userId);
    const res = await fetch(`${baseUrl}${signaturePath}`, {
      method: "POST",
      headers,
      body: "{}",
    });
    expect(res.status).toBe(200);
  });

  it("rejects a tampered timestamp", async () => {
    const headers = signOrbitInternalRequest(secret, "POST", signaturePath, userId);
    const res = await fetch(`${baseUrl}${signaturePath}`, {
      method: "POST",
      headers: {
        ...headers,
        "x-orbit-req-ts": (Number(headers["x-orbit-req-ts"]) + 10).toString(),
      },
      body: "{}",
    });
    expect(res.status).toBe(401);
  });

  it("binds the method and path into the signature", async () => {
    const wrongMethod = signOrbitInternalRequest(secret, "GET", signaturePath, userId);
    const methodRes = await fetch(`${baseUrl}${signaturePath}`, {
      method: "POST",
      headers: wrongMethod,
      body: "{}",
    });
    expect(methodRes.status).toBe(401);

    const wrongPath = signOrbitInternalRequest(secret, "POST", "/api/ai/other", userId);
    const pathRes = await fetch(`${baseUrl}${signaturePath}`, {
      method: "POST",
      headers: wrongPath,
      body: "{}",
    });
    expect(pathRes.status).toBe(401);
  });
});

/**
 * Database half: only runs under the integration harness, which supplies a
 * disposable migrated database. `pnpm test` leaves VERIFY_DATABASE unset and
 * skips these scenarios instead of touching a developer's shared database.
 */
const hasDisposableDatabase = Boolean(
  process.env.VERIFY_DATABASE && process.env.DATABASE_URL,
);

describe.skipIf(!hasDisposableDatabase).sequential(
  "Reservation and outbox durability (disposable database)",
  () => {
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
          .$executeRawUnsafe(
            "DELETE FROM orbit_bot.settlement_outbox WHERE reference_id = $1;",
            ref,
          )
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
        // ignore cleanup failures
      }
    });

    it("yields exactly one reservation when two workers race", async () => {
      const runId = `race-run-${process.pid}-${crypto.randomUUID().slice(0, 8)}`;
      const userId = `race-user-${process.pid}`;
      const canonicalRef = `orbitbot:${userId}:${runId}`;
      testRefs.push(canonicalRef);

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
      expect(rowsA.length + rowsB.length).toBe(1);

      const countRows: any[] = await prisma.$queryRawUnsafe(
        "SELECT COUNT(*)::int as count FROM orbit_bot.credit_reservations WHERE billing_reference_id = $1 AND status = 'active';",
        canonicalRef,
      );
      expect(countRows[0].count).toBe(1);
    });

    it("recovers a pending obligation after a simulated process death", async () => {
      const runId = `crash-run-${process.pid}-${crypto.randomUUID().slice(0, 8)}`;
      const userId = `crash-user-${process.pid}`;
      const canonicalRef = `orbitbot:${userId}:${runId}`;
      testRefs.push(canonicalRef);

      await prisma.$executeRawUnsafe(
        `INSERT INTO orbit_bot.settlement_outbox (
          id, user_id, reference_id, amount, model, product, status, attempts, created_at, updated_at
        ) VALUES (
          $1, $2, $3, 12, 'test/model', 'orbit-bot', 'pending', 0, NOW(), NOW()
        );`,
        `outbox-${Date.now()}`,
        userId,
        canonicalRef,
      );

      resetCreditObserverState({ cleanWal: true });
      expect(getPendingSettlements().length).toBe(0);

      const recovered = await recoverPendingSettlements(prisma);
      const match = recovered.find((r) => r.referenceId === canonicalRef);
      expect(match).toBeDefined();
      expect(match!.amount).toBe(12);
      expect(match!.model).toBe("test/model");

      const mockClient = { settleCredits: vi.fn().mockResolvedValue(true) };
      match!.nextRetryAt = Date.now() - 1000;
      const drainResult = await drainPendingSettlements(mockClient as any, prisma);
      expect(drainResult.succeeded).toBeGreaterThanOrEqual(1);

      const finalRows: any[] = await prisma.$queryRawUnsafe(
        "SELECT status FROM orbit_bot.settlement_outbox WHERE reference_id = $1;",
        canonicalRef,
      );
      expect(finalRows[0].status).toBe("settled");
    });
  },
);
