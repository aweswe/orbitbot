import { createHmac, timingSafeEqual } from "node:crypto";
import { canonicalBodyHash } from "@forion/orbit-adapters";
import type { IncomingMessage, Server, ServerResponse } from "node:http";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";

/**
 * In-process Forion credit gateway for contracts, fault injection, and the
 * 30-bot soak. It verifies HMAC v2 exactly as the client signs it, keeps an
 * in-memory wallet/reservation ledger, and never touches a network or database.
 */
export type FakeGatewayFault = (
  | { kind: "status"; status: number; body?: unknown }
  | { kind: "delay"; ms: number }
  | { kind: "close" }
  /** Apply the mutation, then return 500 (settle-after-serve failure). */
  | { kind: "mutate-then-500" }
  /** Apply the mutation twice before responding, to test idempotency. */
  | { kind: "duplicate-mutation" }
) & {
  /** Only consume this fault for a matching route and/or reservation. */
  when?: { path?: string; referenceId?: string };
};

export interface FakeForionGatewayOptions {
  secret?: string;
  /** Ledger clock. HMAC timestamps still use real time so the client's window is valid. */
  now?: () => number;
  initialBalance?: Record<string, number>;
  lockCost?: (input: { model?: string; inputTokens?: number; maxOutputTokens?: number }) => number;
}

interface Reservation {
  referenceId: string;
  userId: string;
  amount: number;
  status: "active" | "consumed" | "released";
  createdAt: number;
  requestId: string;
}

interface GatewayUser {
  balance: number;
  locked: number;
}

interface GatewayTransaction {
  userId: string;
  type: "lock" | "deduct" | "unlock";
  amount: number;
  referenceId: string;
  requestId: string;
  createdAt: number;
}

export class FakeForionGateway {
  readonly secret: string;
  readonly users = new Map<string, GatewayUser>();
  readonly reservations = new Map<string, Reservation>();
  readonly transactions: GatewayTransaction[] = [];
  readonly requests: Array<{
    method: string;
    path: string;
    userId: string;
    requestId: string;
    status: number;
    body: unknown;
  }> = [];
  readonly faults: FakeGatewayFault[] = [];
  baseUrl = "";

  private readonly now: () => number;
  private readonly lockCost: NonNullable<FakeForionGatewayOptions["lockCost"]>;
  private readonly initialBalance: Record<string, number>;
  private server?: Server;
  private sequence = 0;

  constructor(options: FakeForionGatewayOptions = {}) {
    this.secret = options.secret ?? "test-forion-secret";
    this.now = options.now ?? Date.now;
    this.initialBalance = options.initialBalance ?? { "user-1": 1_000 };
    this.lockCost =
      options.lockCost ??
      ((input) => {
        const tokens = (input.inputTokens ?? 0) + (input.maxOutputTokens ?? 0);
        return Math.max(1, Math.ceil(tokens / 1_000));
      });
    this.reset();
  }

  reset(): void {
    this.users.clear();
    for (const [userId, balance] of Object.entries(this.initialBalance)) {
      this.users.set(userId, { balance, locked: 0 });
    }
    this.reservations.clear();
    this.transactions.length = 0;
    this.requests.length = 0;
    this.faults.length = 0;
    this.sequence = 0;
  }

  balance(userId: string): { balance: number; locked: number; available: number } {
    const user = this.users.get(userId) ?? { balance: 0, locked: 0 };
    return {
      balance: user.balance,
      locked: user.locked,
      available: user.balance - user.locked,
    };
  }

  async start(): Promise<string> {
    this.server = createServer((req, res) => {
      void this.handle(req, res);
    });
    await new Promise<void>((resolve) => this.server!.listen(0, "127.0.0.1", resolve));
    this.baseUrl = `http://127.0.0.1:${(this.server.address() as AddressInfo).port}`;
    return this.baseUrl;
  }

  async close(): Promise<void> {
    if (!this.server) return;
    this.server.closeAllConnections?.();
    await new Promise<void>((resolve) => this.server!.close(() => resolve()));
    this.server = undefined;
    this.baseUrl = "";
  }

  /**
   * Consume the first fault that applies to this request. Targeted faults let
   * a concurrent soak pin a failure to one bot's reservation instead of
   * letting whichever request arrives first take it.
   */
  private takeFault(path: string, body: Record<string, unknown>): FakeGatewayFault | undefined {
    const index = this.faults.findIndex((fault) => {
      if (!fault.when) return true;
      if (fault.when.path && fault.when.path !== path) return false;
      if (fault.when.referenceId && String(body.reference_id ?? "") !== fault.when.referenceId) {
        return false;
      }
      return true;
    });
    if (index < 0) return undefined;
    return this.faults.splice(index, 1)[0];
  }

  private requestId(req: IncomingMessage): string {
    const header = req.headers["x-request-id"] ?? req.headers["x-orbit-request-id"];
    return String(header ?? `gateway-${++this.sequence}`);
  }

  private authorized(
    req: IncomingMessage,
    userId: string,
    requestId: string,
    body: Record<string, unknown>,
  ): boolean {
    const auth = String(req.headers.authorization ?? "");
    if (auth !== `Bearer ${this.secret}`) return false;
    const ts = Number(req.headers["x-orbit-req-ts"]);
    if (!Number.isFinite(ts) || Math.abs(Math.floor(Date.now() / 1000) - ts) > 300) {
      return false;
    }
    const sig = String(req.headers["x-orbit-req-sig"] ?? "");
    const version = String(req.headers["x-orbit-sig-version"] ?? "");
    let payload = `v2|${req.method}|${userId}|${req.url}|${ts}`;
    if (version === "3") {
      const declared = String(req.headers["x-orbit-body-sha256"] ?? "");
      const nonce = String(req.headers["x-orbit-req-nonce"] ?? "");
      if (!declared || !nonce || declared !== canonicalBodyHash(body)) return false;
      payload = `v3|${req.method}|${userId}|${req.url}|${ts}|${declared}|${nonce}`;
    }
    const expected = createHmac("sha256", this.secret).update(payload).digest("base64");
    const got = Buffer.from(sig);
    const want = Buffer.from(expected);
    return got.length === want.length && timingSafeEqual(got, want);
  }

  private send(res: ServerResponse, status: number, body: unknown, requestId: string): void {
    res.writeHead(status, {
      "content-type": "application/json",
      "x-request-id": requestId,
    });
    res.end(JSON.stringify(body));
  }

  private async handle(req: IncomingMessage, res: ServerResponse): Promise<void> {
    const requestId = this.requestId(req);
    const url = new URL(req.url ?? "/", "http://gateway");
    const userId = String(req.headers["x-orbit-user-id"] ?? "");
    const raw = await readBody(req);
    let body: Record<string, unknown> = {};
    try {
      body = raw ? (JSON.parse(raw) as Record<string, unknown>) : {};
    } catch {
      this.record(req, url.pathname, userId, requestId, 400, body);
      this.send(res, 400, { error: "invalid json" }, requestId);
      return;
    }

    if (!this.authorized(req, userId, requestId, body)) {
      this.record(req, url.pathname, userId, requestId, 401, body);
      this.send(res, 401, { error: "invalid signature" }, requestId);
      return;
    }

    const fault = this.takeFault(url.pathname, body);
    if (fault?.kind === "delay") {
      await new Promise((resolve) => setTimeout(resolve, fault.ms));
    }
    if (fault?.kind === "status") {
      this.record(req, url.pathname, userId, requestId, fault.status, body);
      this.send(res, fault.status, fault.body ?? { error: "injected" }, requestId);
      return;
    }
    if (fault?.kind === "close") {
      this.record(req, url.pathname, userId, requestId, 0, body);
      res.destroy();
      return;
    }

    const execute = (): { status: number; body: unknown } =>
      this.execute(req.method ?? "GET", url.pathname, userId, requestId, body);

    let result: { status: number; body: unknown };
    if (fault?.kind === "duplicate-mutation") {
      result = execute();
      if (result.status < 400) result = execute();
    } else {
      result = execute();
    }

    const finalStatus = fault?.kind === "mutate-then-500" ? 500 : result.status;
    this.record(req, url.pathname, userId, requestId, finalStatus, body);
    this.send(
      res,
      finalStatus,
      fault?.kind === "mutate-then-500" ? { error: "settle failed after mutation" } : result.body,
      requestId,
    );
  }

  private record(
    req: IncomingMessage,
    path: string,
    userId: string,
    requestId: string,
    status: number,
    body: unknown,
  ): void {
    this.requests.push({ method: req.method ?? "GET", path, userId, requestId, status, body });
  }

  private execute(
    method: string,
    path: string,
    userId: string,
    requestId: string,
    body: Record<string, unknown>,
  ): { status: number; body: unknown } {
    if (method === "GET" && path.startsWith("/api/credits/balance/")) {
      const target = decodeURIComponent(path.slice("/api/credits/balance/".length));
      const balance = this.balance(target);
      return {
        status: 200,
        body: {
          success: true,
          data: {
            available: balance.available,
            locked: balance.locked,
            total: balance.balance,
            executionTier: "pro",
          },
        },
      };
    }

    if (method === "POST" && path === "/api/credits/use") {
      return this.lock(userId, requestId, body);
    }
    if (method === "POST" && path === "/api/credits/commit") {
      return this.commit(userId, requestId, body);
    }
    if (method === "POST" && path === "/api/credits/settle") {
      return this.settle(userId, requestId, body);
    }
    if (method === "POST" && path === "/api/credits/refund") {
      return this.refund(userId, requestId, body);
    }
    return { status: 404, body: { error: "not found" } };
  }

  private lock(
    userId: string,
    requestId: string,
    body: Record<string, unknown>,
  ): { status: number; body: unknown } {
    const referenceId = String(body.reference_id ?? `ref-${++this.sequence}`);
    const existing = this.reservations.get(referenceId);
    if (existing && existing.status === "active") {
      return {
        status: 200,
        body: { success: true, data: { cost: existing.amount, locked: true } },
      };
    }
    if (existing) {
      return { status: 409, body: { error: "reference already settled" } };
    }
    const user = this.users.get(userId) ?? { balance: 0, locked: 0 };
    this.users.set(userId, user);
    const cost = this.lockCost({
      model: typeof body.model === "string" ? body.model : undefined,
      inputTokens: Number(body.input_tokens) || 0,
      maxOutputTokens: Number(body.max_output_tokens) || 0,
    });
    if (user.balance - user.locked < cost) {
      return { status: 402, body: { error: "insufficient credits" } };
    }
    user.locked += cost;
    this.reservations.set(referenceId, {
      referenceId,
      userId,
      amount: cost,
      status: "active",
      createdAt: this.now(),
      requestId,
    });
    this.transactions.push({
      userId,
      type: "lock",
      amount: cost,
      referenceId,
      requestId,
      createdAt: this.now(),
    });
    return { status: 200, body: { success: true, data: { cost, locked: true } } };
  }

  private commit(
    userId: string,
    requestId: string,
    body: Record<string, unknown>,
  ): { status: number; body: unknown } {
    const amount = Number(body.amount);
    const referenceId = String(body.reference_id ?? "");
    const reservation = this.reservations.get(referenceId);
    if (!reservation) return { status: 400, body: { error: "unknown reservation" } };
    if (reservation.status === "consumed") {
      return { status: 200, body: { success: true, data: { idempotent: true } } };
    }
    if (amount > reservation.amount) {
      return {
        status: 400,
        body: {
          error: `Cannot commit ${amount} credits — reservation only ${reservation.amount} locked`,
        },
      };
    }
    const user = this.users.get(userId) ?? { balance: 0, locked: 0 };
    this.users.set(userId, user);
    user.balance -= amount;
    user.locked -= amount;
    reservation.status = "consumed";
    this.transactions.push({
      userId,
      type: "deduct",
      amount,
      referenceId,
      requestId,
      createdAt: this.now(),
    });
    return { status: 200, body: { success: true, data: { amount } } };
  }

  private settle(
    userId: string,
    requestId: string,
    body: Record<string, unknown>,
  ): { status: number; body: unknown } {
    const amount = Number(body.amount);
    const referenceId = String(body.reference_id ?? "");
    const reservation = this.reservations.get(referenceId);
    if (!reservation) return { status: 400, body: { error: "unknown reservation" } };
    if (reservation.status === "consumed") {
      return { status: 200, body: { success: true, data: { committed: 0, released: true } } };
    }
    const spent = Math.min(amount, reservation.amount);
    const user = this.users.get(userId) ?? { balance: 0, locked: 0 };
    this.users.set(userId, user);
    user.balance -= spent;
    user.locked -= reservation.amount;
    reservation.status = "consumed";
    this.transactions.push({
      userId,
      type: "deduct",
      amount: spent,
      referenceId,
      requestId,
      createdAt: this.now(),
    });
    return { status: 200, body: { success: true, data: { committed: spent, released: true } } };
  }

  private refund(
    userId: string,
    requestId: string,
    body: Record<string, unknown>,
  ): { status: number; body: unknown } {
    const amount = Number(body.amount);
    const referenceId = String(body.reference_id ?? "");
    const reservation = this.reservations.get(referenceId);
    if (!reservation) return { status: 400, body: { error: "unknown reservation" } };
    if (amount > reservation.amount) {
      return { status: 400, body: { error: "refund exceeds reservation" } };
    }
    const user = this.users.get(userId) ?? { balance: 0, locked: 0 };
    this.users.set(userId, user);
    user.locked = Math.max(0, user.locked - amount);
    if (amount >= reservation.amount) reservation.status = "released";
    this.transactions.push({
      userId,
      type: "unlock",
      amount,
      referenceId,
      requestId,
      createdAt: this.now(),
    });
    return { status: 200, body: { success: true, data: { amount } } };
  }
}

async function readBody(req: IncomingMessage): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(Buffer.from(chunk));
  return Buffer.concat(chunks).toString("utf8");
}
