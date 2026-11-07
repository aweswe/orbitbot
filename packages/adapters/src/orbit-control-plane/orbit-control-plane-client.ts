import { createHmac } from 'node:crypto';

/**
 * Orbit Control Plane Client for Orion
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
}

export interface OrbitCreditCommitInput {
  userId: string;
  amount: number;
  referenceId?: string;
  product?: string;
}

export interface OrbitCreditRefundInput {
  userId: string;
  amount: number;
  fromLocked?: boolean;
  referenceId?: string;
  product?: string;
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
  executionTier?: 'free' | 'pro' | 'unlimited';
}

export class OrbitControlPlaneClient {
  private readonly baseUrl: string;
  private readonly internalSecret: string;
  private readonly defaultUserId: string;

  constructor(options?: {
    baseUrl?: string;
    apiKey?: string;
    defaultUserId?: string;
  }) {
    this.baseUrl = (
      options?.baseUrl ||
      process.env.FORION_SERVER_URL ||
      process.env.ORBIT_CONTROL_PLANE_URL ||
      'http://localhost:3001'
    ).replace(/\/$/, '');
    const secret =
      options?.apiKey ||
      process.env.FORION_ORBIT_INTERNAL_SECRET ||
      process.env.FORION_API_KEY;
    // No shipped fallback: a missing secret must stop billing, not fall back to
    // a value every Orion checkout knows.
    if (!secret) {
      throw new Error('FORION_ORBIT_INTERNAL_SECRET is required for Orbit billing');
    }
    this.internalSecret = secret;
    this.defaultUserId = options?.defaultUserId || process.env.DEV_API_USER_ID || '';
  }

  /** Billing is always user-scoped; an empty id is a bug, never "the default user". */
  private requireUserId(userId: string | undefined): string {
    if (!userId) throw new Error('Orbit billing requires an authenticated user id');
    return userId;
  }

  private headers(method: string, pathAndQuery: string, userId: string): Record<string, string> {
    const ts = Math.floor(Date.now() / 1000).toString();
    const payload = `v2|${method.toUpperCase()}|${userId}|${pathAndQuery}|${ts}`;
    const sig = createHmac('sha256', this.internalSecret).update(payload).digest('base64');

    return {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${this.internalSecret}`,
      'x-orbit-user-id': userId,
      'x-orbit-req-ts': ts,
      'x-orbit-sig-version': '2',
      'x-orbit-req-sig': sig,
      'X-Orbit-Client': 'orbit-bot',
    };
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
    const referenceId = input.referenceId || `orbit_bot_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    const path = '/api/credits/use';
    const url = `${this.baseUrl}${path}`;

    // Fail closed: an unreachable control plane must not grant free usage. The
    // caller turns this into a refused model call, never a fabricated lock.
    const response = await fetch(url, {
      method: 'POST',
      headers: this.headers('POST', path, userId),
      signal: AbortSignal.timeout(10_000),
      body: JSON.stringify({
        user_id: userId,
        model: input.model,
        input_tokens: Math.max(0, input.inputTokens),
        max_output_tokens: Math.max(1, input.maxOutputTokens),
        product: input.product || 'orbit-bot',
        reference_id: referenceId,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      if (response.status === 402 || response.status === 400) {
        throw new Error(
          `Insufficient Orbit credits for model ${input.model}. Please recharge your Orbit account (${response.status}: ${errorText})`,
        );
      }
      throw new Error(`Orbit Control Plane credit lock error [${response.status}]: ${errorText}`);
    }

    const json = await response.json() as { success?: boolean; data?: { cost?: number; locked?: boolean } };
    const lockedCredits = json.data?.cost;
    if (typeof lockedCredits !== 'number' || !Number.isFinite(lockedCredits) || lockedCredits <= 0) {
      throw new Error('Orbit Control Plane returned no locked amount');
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
    const path = '/api/credits/commit';
    const url = `${this.baseUrl}${path}`;

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: this.headers('POST', path, userId),
        body: JSON.stringify({
          user_id: userId,
          amount: Math.max(1, Math.round(input.amount)),
          reference_id: input.referenceId,
          product: input.product || 'orbit-bot',
        }),
      });

      if (!response.ok) {
        const errText = await response.text();
        console.warn(`[OrbitControlPlane] Commit credits returned ${response.status}: ${errText}`);
        return false;
      }

      return true;
    } catch (err) {
      console.warn(`[OrbitControlPlane] Error committing credits: ${(err as Error).message}`);
      return false;
    }
  }

  /**
   * Step 2b: Refund locked credits if model call failed or cancelled.
   */
  async refundCredits(input: OrbitCreditRefundInput): Promise<boolean> {
    const userId = this.requireUserId(input.userId);
    const path = '/api/credits/refund';
    const url = `${this.baseUrl}${path}`;

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: this.headers('POST', path, userId),
        body: JSON.stringify({
          user_id: userId,
          amount: Math.max(0, Math.round(input.amount)),
          from_locked: input.fromLocked ?? true,
          reference_id: input.referenceId,
          product: input.product || 'orbit-bot',
        }),
      });

      if (!response.ok) {
        const errText = await response.text();
        console.warn(`[OrbitControlPlane] Refund credits returned ${response.status}: ${errText}`);
        return false;
      }

      return true;
    } catch (err) {
      console.warn(`[OrbitControlPlane] Error refunding credits: ${(err as Error).message}`);
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
      const response = await fetch(url, {
        method: 'GET',
        headers: this.headers('GET', path, targetUser),
      });

      if (!response.ok) {
        return null;
      }

      const json = await response.json() as {
        success?: boolean;
        data?: {
          available?: number;
          locked?: number;
          total?: number;
          balance?: number;
          executionTier?: 'free' | 'pro' | 'unlimited';
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
        executionTier: json.data.executionTier ?? 'pro',
      };
    } catch (err) {
      console.warn(`[OrbitControlPlane] Failed to fetch billing snapshot: ${(err as Error).message}`);
      return null;
    }
  }

  /**
   * Fetch available models registered in the Orbit Control Plane / Requesty catalog.
   */
  async listAvailableModels(): Promise<Array<{ id: string; provider: string; name?: string }>> {
    const path = '/api/ai/models';
    const url = `${this.baseUrl}${path}`;
    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: this.headers('GET', path, this.defaultUserId || 'orbit-internal'),
      });

      if (!response.ok) return [];
      const json = await response.json() as { success?: boolean; data?: Array<{ id: string; provider: string; name?: string }> };
      return json.data || [];
    } catch (err) {
      console.warn(`[OrbitControlPlane] Failed to fetch AI models: ${(err as Error).message}`);
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
