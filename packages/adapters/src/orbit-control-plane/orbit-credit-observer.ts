import type { AgentUsage, ModelCallObserver, UsageOperationKind } from "@forion/orbit-adapter-kit";
import { getOrbitControlPlaneClient } from "./orbit-control-plane-client.js";

interface ActiveReservation {
  reservationId: string;
  userId: string;
  modelId: string;
  provider: string;
  lockedCredits: number;
  operationKind?: UsageOperationKind;
  startTime: number;
}

const activeReservations = new Map<string, ActiveReservation>();

/** Credits for a finished call: priced by cost when known, otherwise by tokens. */
export function creditCostFor(usage: AgentUsage | null): number {
  if (!usage) return 0;
  if (usage.costUsd && usage.costUsd > 0) return Math.max(1, Math.ceil(usage.costUsd / 0.002));
  const tokens = (usage.inputTokens ?? 0) + (usage.outputTokens ?? 0);
  return tokens > 0 ? Math.max(1, Math.ceil(tokens / 1000)) : 0;
}

/**
 * Orbit Credit Observer for Orbit.
 *
 * Plugs into the PiAgentRuntime's ModelCallObserver hook.
 * Awaited BEFORE models.streamSimple begins, enforcing strict fail-closed balance verification
 * against Orbit's Microservices Control Plane (`forion-server`).
 *
 * When the call completes, settles with actual token count / credit cost.
 * When the call errors or is aborted, refunds the pre-locked balance.
 */
export function createOrbitModelCreditObserver(scope: {
  userId: string;
  spaceId: string;
}): ModelCallObserver {
  const client = getOrbitControlPlaneClient();

  return {
    async beforeCall(call) {
      const callId =
        call.callId || `orbit_call_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
      const inputTokens = call.inputTokensEstimate || 120;
      const maxOutput = call.maxOutputTokens || 4096;

      // Deduce or lock credits in Orbit Control Plane
      const { lockedCredits, referenceId } = await client.lockCredits({
        userId: scope.userId,
        model: call.modelId,
        inputTokens,
        maxOutputTokens: maxOutput,
        product: "orbit-bot",
        referenceId: callId,
      });

      activeReservations.set(referenceId, {
        reservationId: referenceId,
        userId: scope.userId,
        modelId: call.modelId,
        provider: call.provider,
        lockedCredits,
        operationKind: call.operationKind,
        startTime: Date.now(),
      });

      return referenceId;
    },

    async afterCall(reservationId, usage: AgentUsage | null) {
      const active = activeReservations.get(reservationId);
      activeReservations.delete(reservationId);

      const userId = active?.userId ?? scope.userId;
      const locked = active?.lockedCredits ?? 0;
      // A reservation this process never recorded (restart, another replica) has no
      // lock we can safely settle. Forion releases stale reservations on its side.
      if (locked <= 0) return;

      const refund = () =>
        client.refundCredits({
          userId,
          amount: locked,
          fromLocked: true,
          referenceId: reservationId,
          product: "orbit-bot",
        });

      const actual = creditCostFor(usage);
      if (actual <= 0) {
        // Unstarted, cancelled, or failed call — release the whole lock.
        await refund();
        return;
      }

      // The lock is the ceiling. Committing more than Forion reserved fails the
      // whole settlement and leaves the lock stranded, so clamp to it.
      const committed = Math.min(actual, locked);
      const committedOk = await client.commitCredits({
        userId,
        amount: committed,
        referenceId: reservationId,
        product: "orbit-bot",
      });
      if (!committedOk) {
        await refund();
        return;
      }
      // Commit only removes what it charged; without this the unused part of the
      // lock stays held against the wallet forever.
      if (locked > committed) {
        await client.refundCredits({
          userId,
          amount: locked - committed,
          fromLocked: true,
          referenceId: reservationId,
          product: "orbit-bot",
        });
      }
    },

    async onRequestId(reservationId, providerRequestId) {
      // Correlation log for auditing
      console.log(
        `[OrbitBot Billing] Call ${reservationId} connected to providerRequestId: ${providerRequestId}`,
      );
    },
  };
}
