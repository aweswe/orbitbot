import { OrbitControlPlaneClient } from "@forion/orbit-adapters";
import { describe, expect, it } from "vitest";
import { FakeForionGateway } from "./fake-forion-gateway.js";

/**
 * Thirty bots answer one group message at once. Every run locks and settles
 * through the credit gateway while transient faults hit specific reservations.
 * Two consecutive passes must end with no locked credits, no double deduction,
 * and no unanswered settlement.
 */
const BOTS = 30;
const LOCK = 7;
const USER = "soak-user";
const STARTING_BALANCE = 100_000;

async function soakPass(pass: number) {
  const gateway = new FakeForionGateway({
    secret: "soak-secret",
    initialBalance: { [USER]: STARTING_BALANCE },
    lockCost: () => LOCK,
  });
  await gateway.start();
  const client = new OrbitControlPlaneClient({
    baseUrl: gateway.baseUrl,
    apiKey: gateway.secret,
    defaultUserId: USER,
    retry: { maxAttempts: 4, baseDelayMs: 1, maxDelayMs: 5, jitterRatio: 0.5 },
  });

  try {
    const runs = Array.from({ length: BOTS }, (_, index) => {
      const referenceId = `pass-${pass}-run-${index}`;
      const refunds = index % 6 === 5;

      // Pin each fault to this bot's reservation so concurrent runs cannot
      // consume a fault that belongs to another one.
      switch (index % 6) {
        case 0:
          gateway.faults.push({
            kind: "duplicate-mutation",
            when: { path: "/api/credits/settle", referenceId },
          });
          break;
        case 1:
          gateway.faults.push({ kind: "delay", ms: 2, when: { referenceId } });
          break;
        case 2:
          gateway.faults.push({
            kind: "status",
            status: 429,
            when: { path: "/api/credits/use", referenceId },
          });
          break;
        case 3:
          gateway.faults.push({
            kind: "mutate-then-500",
            when: { path: "/api/credits/settle", referenceId },
          });
          break;
        case 4:
          gateway.faults.push({
            kind: "close",
            when: { path: "/api/credits/settle", referenceId },
          });
          break;
      }

      return (async () => {
        const lock = await client.lockCredits({
          userId: USER,
          model: "soak-model",
          inputTokens: 100,
          maxOutputTokens: 100,
          referenceId,
          requestId: `req-${referenceId}`,
        });
        expect(lock.lockedCredits).toBe(LOCK);

        if (refunds) {
          await expect(
            client.refundCredits({
              userId: USER,
              amount: LOCK,
              referenceId,
              requestId: `req-refund-${referenceId}`,
            }),
          ).resolves.toBe(true);
          return { referenceId, outcome: "refund" as const };
        }

        await expect(
          client.settleCredits({
            userId: USER,
            amount: LOCK,
            referenceId,
            model: "soak-model",
            requestId: `req-settle-${referenceId}`,
          }),
        ).resolves.toBe(true);
        return { referenceId, outcome: "spend" as const };
      })();
    });

    const results = await Promise.all(runs);
    const spenders = results.filter((result) => result.outcome === "spend").length;
    const refunders = BOTS - spenders;

    // No rounded-up lock survives the pass.
    expect(gateway.balance(USER)).toEqual({
      balance: STARTING_BALANCE - spenders * LOCK,
      locked: 0,
      available: STARTING_BALANCE - spenders * LOCK,
    });
    expect(gateway.reservations.size).toBe(BOTS);
    expect([...gateway.reservations.values()].filter((r) => r.status === "active")).toEqual([]);
    expect([...gateway.reservations.values()].filter((r) => r.status === "released")).toHaveLength(
      refunders,
    );

    // Each reservation locks once and deducts at most once, however many
    // retries the faults caused.
    for (const { referenceId } of results) {
      const rows = gateway.transactions.filter((row) => row.referenceId === referenceId);
      expect(rows.filter((row) => row.type === "lock")).toHaveLength(1);
      expect(rows.filter((row) => row.type === "deduct").length).toBeLessThanOrEqual(1);
    }

    // Every call carries the run's request id; no path ends in a 4xx.
    expect(gateway.requests.every((request) => request.requestId.startsWith("req-"))).toBe(true);
    expect(
      gateway.requests.filter((request) => [400, 401, 402, 409].includes(request.status)),
    ).toEqual([]);
    return { spenders, refunders };
  } finally {
    await gateway.close();
  }
}

describe("30-bot group soak", () => {
  it("settles every run across two passes with zero locked-credit drift", async () => {
    const first = await soakPass(1);
    const second = await soakPass(2);

    expect(first).toEqual({ spenders: 25, refunders: 5 });
    expect(second).toEqual({ spenders: 25, refunders: 5 });
  });
});
