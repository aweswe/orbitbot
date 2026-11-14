import { OrbitControlPlaneClient } from "@forion/orbit-adapters";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { FakeForionGateway } from "./fake-forion-gateway.js";

describe("FakeForionGateway", () => {
  let gateway: FakeForionGateway;
  let client: OrbitControlPlaneClient;

  beforeAll(async () => {
    gateway = new FakeForionGateway({
      secret: "test-secret",
      initialBalance: { "user-1": 1_000 },
      lockCost: () => 7,
    });
    await gateway.start();
    client = new OrbitControlPlaneClient({
      baseUrl: gateway.baseUrl,
      apiKey: gateway.secret,
      defaultUserId: "user-1",
    });
  });

  afterAll(async () => {
    await gateway.close();
  });

  beforeEach(() => {
    gateway.reset();
  });

  it("locks and settles exactly once", async () => {
    const lock = await client.lockCredits({
      userId: "user-1",
      model: "test-model",
      inputTokens: 100,
      maxOutputTokens: 100,
      referenceId: "run-1",
    });
    expect(lock.lockedCredits).toBe(7);
    expect(gateway.balance("user-1")).toEqual({ balance: 1_000, locked: 7, available: 993 });

    expect(
      await client.settleCredits({
        userId: "user-1",
        amount: 7,
        referenceId: "run-1",
      }),
    ).toBe(true);
    expect(gateway.balance("user-1")).toEqual({ balance: 993, locked: 0, available: 993 });
  });

  it("rejects a commit above the reservation and leaves the lock intact", async () => {
    await client.lockCredits({
      userId: "user-1",
      model: "test-model",
      inputTokens: 100,
      maxOutputTokens: 100,
      referenceId: "run-2",
    });

    expect(
      await client.commitCredits({
        userId: "user-1",
        amount: 19,
        referenceId: "run-2",
      }),
    ).toBe(false);
    expect(gateway.balance("user-1")).toEqual({ balance: 1_000, locked: 7, available: 993 });

    expect(
      await client.settleCredits({ userId: "user-1", amount: 7, referenceId: "run-2" }),
    ).toBe(true);
  });

  it("is idempotent when settle is delivered twice", async () => {
    await client.lockCredits({
      userId: "user-1",
      model: "test-model",
      inputTokens: 100,
      maxOutputTokens: 100,
      referenceId: "run-3",
    });
    gateway.faults.push({ kind: "duplicate-mutation" });

    expect(
      await client.settleCredits({ userId: "user-1", amount: 7, referenceId: "run-3" }),
    ).toBe(true);
    expect(gateway.balance("user-1")).toEqual({ balance: 993, locked: 0, available: 993 });
  });

  it("records a settle-after-serve failure and completes on retry", async () => {
    await client.lockCredits({
      userId: "user-1",
      model: "test-model",
      inputTokens: 100,
      maxOutputTokens: 100,
      referenceId: "run-4",
    });
    gateway.faults.push({ kind: "mutate-then-500" });

    expect(
      await client.settleCredits({ userId: "user-1", amount: 7, referenceId: "run-4" }),
    ).toBe(false);
    expect(gateway.balance("user-1")).toEqual({ balance: 993, locked: 0, available: 993 });

    expect(
      await client.settleCredits({ userId: "user-1", amount: 7, referenceId: "run-4" }),
    ).toBe(true);
    expect(gateway.balance("user-1")).toEqual({ balance: 993, locked: 0, available: 993 });
  });

  it("surfaces a 429 without mutating the ledger", async () => {
    gateway.faults.push({ kind: "status", status: 429 });
    await expect(
      client.lockCredits({
        userId: "user-1",
        model: "test-model",
        inputTokens: 100,
        maxOutputTokens: 100,
        referenceId: "run-5",
      }),
    ).rejects.toThrow(/429/);
    expect(gateway.balance("user-1")).toEqual({ balance: 1_000, locked: 0, available: 1_000 });
  });

  it("rejects a forged HMAC signature", async () => {
    const forged = new OrbitControlPlaneClient({
      baseUrl: gateway.baseUrl,
      apiKey: "wrong-secret",
      defaultUserId: "user-1",
    });
    await expect(
      forged.lockCredits({
        userId: "user-1",
        model: "test-model",
        inputTokens: 100,
        maxOutputTokens: 100,
        referenceId: "run-6",
      }),
    ).rejects.toThrow(/401/);
  });
});
