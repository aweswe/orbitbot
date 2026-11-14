import { createHash, createHmac, randomUUID } from "node:crypto";
import { getLogger } from "@forion/orbit-logging";

/**
 * Orbit Control Plane Client for Orbit
 *
 * Communicates with `forion-server` (Orbit Microservices Control Plane) for:
 * 1. Wallet balances & billing status
 * 2. Credit locking (preflight before model execution)
 * 3. Credit commitment (after model execution settles actual tokens)
 * 4. Credit refund (if execution fails or is cancelled)
 * 5. Available model catalog and routing
 *
 * Authenticates using the Orbit Microservices signed internal channel:
 * HMAC-SHA256(v2|METHOD|userId|path|ts) using `FORION_ORBIT_INTERNAL_SECRET`.
 *
 * NOTE: Does NOT modify `forion-server` — adheres to the existing forion-server REST API contracts.
 */

export interface OrbitCreditLockInput {
  userId: string;
  model: string;
  inputTokens: number;
  maxOutputTokens: number;
  product?: string;
  referenceId?: string;
  requestId?: string;
}

export interface OrbitCreditCommitInput {
  userId: string;
  amount: number;
  referenceId?: string;
  product?: string;
  requestId?: string;
}

export interface OrbitCreditRefundInput {
  userId: string;
  amount: number;
  fromLocked?: boolean;
  referenceId?: string;
  product?: string;
  requestId?: string;
}

export interface OrbitCreditSettleInput {
  userId: string;
  amount: number;
  referenceId: string;
  model?: string;
  product?: string;
  requestId?: string;
}

export interface OrbitBillingSnapshot {
  wallet: {
    userId: string;
    balance: number;
    lockedBalance: number;
    availableBalance: number;
  };
  subscription?: {
    planId: string;
    status: string;
    currentPeriodEnd?: string;
  };
  executionTier?: "free" | "pro" | "unlimited";
}

/** JSON with sorted object keys so both services hash the same bytes. */
export function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value) ?? "null";
  if (Array.isArray(value)) {
    return `[${value.map((item) => canonicalJson(item === undefined ? null : item)).join(",")}]`;
  }
  const record = value as Record<string, unknown>;
  const entries = Object.keys(record)
    .filter((key) => record[key] !== undefined)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${canonicalJson(record[key])}`);
  return `{${entries.join(",")}}`;
}

/** SHA-256 of the canonical request body; the empty body has a stable hash. */
export function canonicalBodyHash(body: unknown): string {
  let value = body;
  if (body instanceof Uint8Array) {
    value = new TextDecoder().decode(body);
  }
  if (value === undefined || value === null || value === "") {
    return createHash("sha256").update("").digest("hex");
  }
  if (typeof value === "string") {
    const text = value;
    try {
      value = JSON.parse(text);
    } catch {
      return createHash("sha256").update(text).digest("hex");
    }
  }
  return createHash("sha256").update(canonicalJson(value)).digest("hex");
}

/**
 * Sign a Forion internal request. Passing `body` upgrades the request to v3,
 * which binds the canonical body and adds a nonce; omitting it keeps the
 * method/path-bound v2 format for callers that have no body yet.
 */
export function signOrbitInternalRequest(
  secret: string,
  method: string,
  pathAndQuery: string,
  userId: string,
  extraHeaders?: Record<string, string>,
  body?: unknown,
): Record<string, string> {
  const ts = Math.floor(Date.now() / 1000).toString();
  const bodyBound = body !== undefined;
  const nonce = bodyBound ? randomUUID() : undefined;
  const bodyHash = bodyBound ? canonicalBodyHash(body) : undefined;
  const payload = bodyBound
    ? `v3|${method.toUpperCase()}|${userId}|${pathAndQuery}|${ts}|${bodyHash}|${nonce}`
    : `v2|${method.toUpperCase()}|${userId}|${pathAndQuery}|${ts}`;
  const sig = createHmac("sha256", secret).update(payload).digest("base64");

  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${secret}`,
    "x-orbit-user-id": userId,
    "x-user-id": userId,
    "x-orbit-req-ts": ts,
    "x-orbit-sig-version": bodyBound ? "3" : "2",
    "x-orbit-req-sig": sig,
    ...(bodyBound
      ? { "x-orbit-body-sha256": bodyHash!, "x-orbit-req-nonce": nonce! }
      : {}),
    "X-Orbit-Client": "orbit-bot",
    ...extraHeaders,
  };
}

export interface OrbitControlPlaneRetryOptions {
  /** Total attempts including the first. */
  maxAttempts?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
  /** Fraction of random extra delay added to every backoff. */
  jitterRatio?: number;
}

const RETRYABLE_STATUS = new Set([429, 500, 502, 503, 504]);

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function retryAfterMs(response: Response): number | undefined {
  const header = response.headers.get("retry-after");
  if (!header) return undefined;
  const seconds = Number(header);
  if (Number.isFinite(seconds)) return Math.max(0, seconds * 1_000);
  const date = Date.parse(header);
  return Number.isNaN(date) ? undefined : Math.max(0, date - Date.now());
}

export class OrbitControlPlaneClient {
  private readonly baseUrl: string;
  private readonly internalSecret: string;
  private readonly defaultUserId: string;
  private readonly retry: Required<OrbitControlPlaneRetryOptions>;

  constructor(options?: {
    baseUrl?: string;
    apiKey?: string;
    defaultUserId?: string;
    retry?: OrbitControlPlaneRetryOptions;
  }) {
    this.retry = {
      maxAttempts: Math.max(1, options?.retry?.maxAttempts ?? 3),
      baseDelayMs: Math.max(0, options?.retry?.baseDelayMs ?? 100),
      maxDelayMs: Math.max(0, options?.retry?.maxDelayMs ?? 2_000),
      jitterRatio: Math.max(0, options?.retry?.jitterRatio ?? 0.5),
    };
    this.baseUrl = (
      options?.baseUrl ||
      process.env.FORION_SERVER_URL ||
      process.env.ORBIT_CONTROL_PLANE_URL ||
      "http://localhost:3001"
    ).replace(/\/$/, "");
    const secret =
      options?.apiKey || process.env.FORION_ORBIT_INTERNAL_SECRET || process.env.FORION_API_KEY;
    // No shipped fallback: a missing secret must stop billing, not fall back to
    // a value every Orbit checkout knows.
    if (!secret) {
      throw new Error("FORION_ORBIT_INTERNAL_SECRET is required for Orbit billing");
    }
    this.internalSecret = secret;
    this.defaultUserId = options?.defaultUserId || process.env.DEV_API_USER_ID || "";
  }

  /** Billing is always user-scoped; an empty id is a bug, never "the default user". */
  private requireUserId(userId: string | undefined): string {
    if (!userId) throw new Error("Orbit billing requires an authenticated user id");
    return userId;
  }

  private headers(
    method: string,
    pathAndQuery: string,
    userId: string,
    requestId?: string,
    body?: unknown,
  ): Record<string, string> {
    return signOrbitInternalRequest(
      this.internalSecret,
      method,
      pathAndQuery,
      userId,
      requestId ? { "x-request-id": requestId } : undefined,
      body,
    );
  }

  /**
   * Billing calls carry an idempotency key (the reservation reference), so a
   * rate-limited or transiently failed call is safe to repeat. Back off with
   * jitter so thirty bots answering at once do not retry in lockstep.
   */
  private async fetchWithRetry(url: string, makeInit: () => RequestInit): Promise<Response> {
    const { maxAttempts, baseDelayMs, maxDelayMs, jitterRatio } = this.retry;
    for (let attempt = 1; ; attempt++) {
      try {
        // Re-sign every attempt: the nonce and timestamp are part of the
        // signature, and a replayed signature is rejected by Forion.
        const response = await fetch(url, makeInit());
        if (!RETRYABLE_STATUS.has(response.status) || attempt >= maxAttempts) {
          return response;
        }
        await response.body?.cancel().catch(() => {});
        await sleep(this.retryDelay(response, attempt, baseDelayMs, maxDelayMs, jitterRatio));
      } catch (err) {
        if (attempt >= maxAttempts) throw err;
        await sleep(this.backoff(attempt, baseDelayMs, maxDelayMs, jitterRatio));
      }
    }
  }

  private retryDelay(
    response: Response,
    attempt: number,
    baseDelayMs: number,
    maxDelayMs: number,
    jitterRatio: number,
  ): number {
    const named = retryAfterMs(response);
    const base = named ?? baseDelayMs * 2 ** (attempt - 1);
    return Math.min(maxDelayMs, base * (1 + Math.random() * jitterRatio));
  }

  private backoff(
    attempt: number,
    baseDelayMs: number,
    maxDelayMs: number,
    jitterRatio: number,
  ): number {
    const base = baseDelayMs * 2 ** (attempt - 1);
    return Math.min(maxDelayMs, base * (1 + Math.random() * jitterRatio));
  }

  /**
   * Step 1: Pre-lock credits before a model call or agent step.
   * If the user's available credits are insufficient, forion-server throws 402/400.
   */
  async lockCredits(input: OrbitCreditLockInput): Promise<{
    lockedCredits: number;
    referenceId: string;
  }> {
    const userId = this.requireUserId(input.userId);
    const referenceId =
      input.referenceId || `orbit_bot_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    const path = "/api/credits/use";
    const url = `${this.baseUrl}${path}`;
    const body = {
      user_id: userId,
      model: input.model,
      input_tokens: Math.max(0, input.inputTokens),
      max_output_tokens: Math.max(1, input.maxOutputTokens),
      product: input.product || "orbit-bot",
      reference_id: referenceId,
    };

    // Fail closed: an unreachable control plane must not grant free usage. The
    // caller turns this into a refused model call, never a fabricated lock.
    const response = await this.fetchWithRetry(url, () => ({
      method: "POST",
      headers: this.headers("POST", path, userId, input.requestId, body),
      signal: AbortSignal.timeout(10_000),
      body: JSON.stringify(body),
    }));

    if (!response.ok) {
      const errorText = await response.text();
      if (response.status === 402 || response.status === 400) {
        throw new Error(
          `Insufficient Orbit credits for model ${input.model}. Please recharge your Orbit account (${response.status}: ${errorText})`,
        );
      }
      throw new Error(`Orbit Control Plane credit lock error [${response.status}]: ${errorText}`);
    }

    const json = (await response.json()) as {
      success?: boolean;
      data?: { cost?: number; locked?: boolean };
    };
    const lockedCredits = json.data?.cost;
    if (
      typeof lockedCredits !== "number" ||
      !Number.isFinite(lockedCredits) ||
      lockedCredits <= 0
    ) {
      throw new Error("Orbit Control Plane returned no locked amount");
    }
    return {
      lockedCredits,
      referenceId,
    };
  }

  /**
   * Step 2a: Commit credits consumed by the model call.
   */
  async commitCredits(input: OrbitCreditCommitInput): Promise<boolean> {
    const userId = this.requireUserId(input.userId);
    const path = "/api/credits/commit";
    const url = `${this.baseUrl}${path}`;
    const body = {
      user_id: userId,
      amount: Math.max(1, Math.round(input.amount)),
      reference_id: input.referenceId,
      product: input.product || "orbit-bot",
    };

    try {
      const response = await this.fetchWithRetry(url, () => ({
        method: "POST",
        headers: this.headers("POST", path, userId, input.requestId, body),
        body: JSON.stringify(body),
      }));

      if (!response.ok) {
        const errText = await response.text();
        getLogger().warn("orbit_billing.commit_failed", { status: response.status, errText });
        return false;
      }

      return true;
    } catch (err) {
      getLogger().warn("orbit_billing.commit_error", { error: (err as Error).message });
      return false;
    }
  }

  /**
   * Step 2b: Refund locked credits if model call failed or cancelled.
   */
  async refundCredits(input: OrbitCreditRefundInput): Promise<boolean> {
    const userId = this.requireUserId(input.userId);
    const path = "/api/credits/refund";
    const url = `${this.baseUrl}${path}`;
    const body = {
      user_id: userId,
      amount: Math.max(0, Math.round(input.amount)),
      from_locked: input.fromLocked ?? true,
      reference_id: input.referenceId,
      product: input.product || "orbit-bot",
    };

    try {
      const response = await this.fetchWithRetry(url, () => ({
        method: "POST",
        headers: this.headers("POST", path, userId, input.requestId, body),
        body: JSON.stringify(body),
      }));

      if (!response.ok) {
        const errText = await response.text();
        getLogger().warn("orbit_billing.refund_failed", { status: response.status, errText });
        return false;
      }

      return true;
    } catch (err) {
      getLogger().warn("orbit_billing.refund_error", { error: (err as Error).message });
      return false;
    }
  }

  /**
   * Settle credits atomically: commits actual spent credits and releases
   * any unused remaining locked capacity in one atomic server operation.
   */
  async settleCredits(input: OrbitCreditSettleInput): Promise<boolean> {
    const userId = this.requireUserId(input.userId);
    const path = "/api/credits/settle";
    const url = `${this.baseUrl}${path}`;
    const body = {
      user_id: userId,
      amount: Math.max(0, Math.round(input.amount)),
      reference_id: input.referenceId,
      model: input.model || "orbit-flash",
      product: input.product || "orbit-bot",
    };

    try {
      const response = await this.fetchWithRetry(url, () => ({
        method: "POST",
        headers: this.headers("POST", path, userId, input.requestId, body),
        body: JSON.stringify(body),
      }));

      if (!response.ok) {
        const errText = await response.text();
        getLogger().warn("orbit_billing.settle_failed", { status: response.status, errText });
        return false;
      }

      return true;
    } catch (err) {
      getLogger().warn("orbit_billing.settle_error", { error: (err as Error).message });
      return false;
    }
  }

  /**
   * Get balance and subscription snapshot for user.
   */
  async getBillingSnapshot(userId?: string): Promise<OrbitBillingSnapshot | null> {
    const targetUser = this.requireUserId(userId);
    const path = `/api/credits/balance/${encodeURIComponent(targetUser)}`;
    const url = `${this.baseUrl}${path}`;

    try {
      const response = await this.fetchWithRetry(url, () => ({
        method: "GET",
        headers: this.headers("GET", path, targetUser, undefined, null),
      }));

      if (!response.ok) {
        return null;
      }

      const json = (await response.json()) as {
        success?: boolean;
        data?: {
          available?: number;
          locked?: number;
          total?: number;
          balance?: number;
          executionTier?: "free" | "pro" | "unlimited";
        };
      };

      if (!json.data) return null;

      return {
        wallet: {
          userId: targetUser,
          balance: json.data.total ?? json.data.balance ?? 0,
          lockedBalance: json.data.locked ?? 0,
          availableBalance: json.data.available ?? json.data.balance ?? 0,
        },
        executionTier: json.data.executionTier ?? "pro",
      };
    } catch (err) {
      getLogger().warn("orbit_billing.snapshot_error", { error: (err as Error).message });
      return null;
    }
  }

  /**
   * Fetch available models registered in the Orbit Control Plane / Requesty catalog.
   */
  async listAvailableModels(): Promise<Array<{ id: string; provider: string; name?: string }>> {
    const path = "/api/ai/models";
    const url = `${this.baseUrl}${path}`;
    try {
      const response = await this.fetchWithRetry(url, () => ({
        method: "GET",
        headers: this.headers(
          "GET",
          path,
          this.defaultUserId || "orbit-internal",
          undefined,
          null,
        ),
      }));

      if (!response.ok) return [];
      const json = (await response.json()) as {
        success?: boolean;
        data?: Array<{ id: string; provider: string; name?: string }>;
      };
      return json.data || [];
    } catch (err) {
      getLogger().warn("orbit_billing.list_models_error", { error: (err as Error).message });
      return [];
    }
  }
}

let globalClient: OrbitControlPlaneClient | undefined;

export function getOrbitControlPlaneClient(): OrbitControlPlaneClient {
  if (!globalClient) {
    globalClient = new OrbitControlPlaneClient();
  }
  return globalClient;
}
