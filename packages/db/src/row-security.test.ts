import { describe, expect, it, vi } from "vitest";
import type { PrismaClient } from "./generated/prisma/client.js";
import {
  installTransactionContext,
  rlsBypassKey,
  runAsSystem,
  runAsTenant,
  withRowLevelSecurity,
} from "./row-security.js";

describe("rlsBypassKey", () => {
  it("follows the password pg logs in with", () => {
    const key = rlsBypassKey("postgres://app:secret@db/rakazo");
    expect(key).toMatch(/^[0-9a-f]{64}$/);
    expect(rlsBypassKey("postgres://app@db/rakazo?password=secret")).toBe(key);
    expect(rlsBypassKey("postgres://app:other@db/rakazo?password=secret")).toBe(key);
    expect(rlsBypassKey("postgres://app:secret@db/rakazo?password=")).toBe(key);
    expect(rlsBypassKey("postgres://app:s%cret@db/rakazo")).toMatch(/^[0-9a-f]{64}$/);
  });

  it("is empty without a password", () => {
    expect(rlsBypassKey("postgres://app@db/rakazo")).toBe("");
    expect(rlsBypassKey("not a url")).toBe("");
  });
});

describe("withRowLevelSecurity", () => {
  type AllOperations = (params: {
    model?: string;
    operation: string;
    args: unknown;
    query: (args: unknown) => Promise<unknown>;
    __internalParams?: { transaction?: { kind: string } };
  }) => Promise<unknown>;

  function createClient() {
    let extension: { query: { $allOperations: AllOperations } } | undefined;
    const executeRaw = vi.fn().mockResolvedValue(0);
    const queryRaw = vi.fn();
    const queryRawUnsafe = vi.fn();
    const tx = {
      $executeRaw: executeRaw,
      $queryRaw: queryRaw,
      $queryRawUnsafe: queryRawUnsafe,
      $executeRawUnsafe: vi.fn(),
    };
    const transaction = vi.fn(async (input: unknown) => {
      if (typeof input === "function") return input(tx);
      const results: unknown[] = [];
      for (const item of input as Array<Promise<unknown>>) results.push(await item);
      return results;
    });
    withRowLevelSecurity({
      $executeRaw: executeRaw,
      $transaction: transaction,
      $extends: (value: typeof extension) => {
        extension = value;
        return value;
      },
    } as unknown as PrismaClient);
    return {
      allOperations: extension!.query.$allOperations,
      executeRaw,
      queryRaw,
      queryRawUnsafe,
      transaction,
    };
  }

  const deadlock = () => Object.assign(new Error("write conflict or deadlock"), { code: "P2034" });

  it("runs a statement that lost a deadlock again", async () => {
    const { allOperations, transaction } = createClient();
    const query = vi.fn().mockRejectedValueOnce(deadlock()).mockResolvedValueOnce(["row"]);

    const result = runAsTenant({ spaceId: "space-fixture", userId: "user-fixture" }, () =>
      allOperations({
        model: "ExternalConversation",
        operation: "findMany",
        args: {},
        query,
      }),
    );

    await expect(result).resolves.toEqual(["row"]);
    expect(query).toHaveBeenCalledTimes(2);
    // Each attempt is its own transaction, so the context goes with it.
    expect(transaction).toHaveBeenCalledTimes(2);
  });

  it("sets the context in the same transaction as a findUnique", async () => {
    const { allOperations, executeRaw, transaction } = createClient();
    const query = vi.fn().mockResolvedValue({ id: "row" });

    const result = runAsSystem("test fixture", () =>
      allOperations({
        model: "UsageRecord",
        operation: "findUnique",
        args: { where: { id: "row" } },
        query,
      }),
    );

    await expect(result).resolves.toEqual({ id: "row" });
    expect(query).toHaveBeenCalledOnce();
    expect(transaction).toHaveBeenCalledOnce();
    expect(executeRaw).toHaveBeenCalledOnce();
  });

  it("wraps raw SQL, which may name a protected table", async () => {
    const { allOperations, queryRaw, transaction } = createClient();
    queryRaw.mockResolvedValue([{ id: "row" }]);

    const result = runAsTenant({ spaceId: "space-fixture", userId: "user-fixture" }, () =>
      allOperations({
        operation: "$queryRaw",
        args: { strings: ["SELECT ", "::int AS id"], values: [1] },
        query: vi.fn(),
      }),
    );

    await expect(result).resolves.toEqual([{ id: "row" }]);
    expect(transaction).toHaveBeenCalledOnce();
    expect(queryRaw).toHaveBeenCalledOnce();
  });

  it("wraps an unprotected model, whose include may load a protected relation", async () => {
    const { allOperations, transaction } = createClient();
    const query = vi.fn().mockResolvedValue({ id: "user" });

    const result = runAsTenant({ spaceId: "space-fixture", userId: "user-fixture" }, () =>
      allOperations({
        model: "User",
        operation: "findUnique",
        args: { where: { id: "user" } },
        query,
      }),
    );

    await expect(result).resolves.toEqual({ id: "user" });
    expect(transaction).toHaveBeenCalledOnce();
  });

  it("leaves a statement inside a transaction to whoever opened it", async () => {
    const { allOperations, transaction } = createClient();
    const error = deadlock();
    const query = vi.fn().mockRejectedValue(error);

    const result = runAsSystem("test fixture", () =>
      allOperations({
        model: "UsageRecord",
        operation: "createMany",
        args: {},
        query,
        __internalParams: { transaction: { kind: "itx" } },
      }),
    );

    await expect(result).rejects.toBe(error);
    expect(query).toHaveBeenCalledOnce();
    expect(transaction).not.toHaveBeenCalled();
  });

  it("rejects an empty tenant instead of querying without a context", async () => {
    const { allOperations } = createClient();
    const query = vi.fn();

    expect(() =>
      runAsTenant({ spaceId: "", userId: "user-fixture" }, () =>
        allOperations({ model: "UsageRecord", operation: "findMany", args: {}, query }),
      ),
    ).toThrow("spaceId and userId");
    expect(query).not.toHaveBeenCalled();
  });
});

describe("installTransactionContext", () => {
  it("carries the context through a later $extends", async () => {
    const executeRaw = vi.fn().mockResolvedValue(0);
    const extended = {
      $transaction: vi.fn(async (run: (tx: unknown) => Promise<unknown>) =>
        run({ $executeRaw: executeRaw }),
      ),
    };
    const base = {
      $transaction: vi.fn(),
      $extends: vi.fn(() => extended),
    };
    installTransactionContext(base as unknown as PrismaClient, "bypass-key", "orbit_bot");
    const client = base.$extends() as unknown as typeof extended;

    const result = await runAsTenant({ spaceId: "space-fixture", userId: "user-fixture" }, () =>
      client.$transaction(async () => "ok"),
    );

    expect(result).toBe("ok");
    expect(executeRaw).toHaveBeenCalledOnce();
  });
});
