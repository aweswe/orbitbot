import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  lockCredits: vi.fn(),
  commitCredits: vi.fn(),
  refundCredits: vi.fn(),
}));

vi.mock("./orbit-control-plane-client.js", () => ({
  getOrbitControlPlaneClient: () => ({
    lockCredits: mocks.lockCredits,
    commitCredits: mocks.commitCredits,
    refundCredits: mocks.refundCredits,
  }),
}));

import { createOrbitModelCreditObserver } from "./orbit-credit-observer.js";

const scope = { userId: "user-1", spaceId: "space-1" };
const call = {
  callId: "call-1",
  inputTokensEstimate: 1000,
  maxOutputTokens: 500,
  provider: "orbit",
  modelId: "orbit-flash",
} as Parameters<ReturnType<typeof createOrbitModelCreditObserver>["beforeCall"]>[0];

beforeEach(() => {
  vi.clearAllMocks();
  mocks.commitCredits.mockResolvedValue(true);
  mocks.refundCredits.mockResolvedValue(true);
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
      expect.objectContaining({ userId: "user-1", amount: 8, fromLocked: true, referenceId: "call-1" }),
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

  it("refunds the whole lock when the commit is rejected", async () => {
    mocks.lockCredits.mockResolvedValue({ lockedCredits: 6, referenceId: "call-1" });
    mocks.commitCredits.mockResolvedValue(false);
    const observer = createOrbitModelCreditObserver(scope);
    const referenceId = await observer.beforeCall(call);

    await observer.afterCall(referenceId, { inputTokens: 2000, outputTokens: 0 });

    expect(mocks.refundCredits).toHaveBeenCalledWith(
      expect.objectContaining({ amount: 6, fromLocked: true }),
    );
  });
});
