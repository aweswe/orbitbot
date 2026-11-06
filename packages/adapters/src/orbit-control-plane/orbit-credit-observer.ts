import type { AgentUsage, ModelCallObserver, UsageOperationKind } from "@rakazo/adapter-kit";
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

/**
 * Orbit Credit Observer for Orbit Bot.
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
      const callId = call.callId || `orbit_call_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
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

      const userId = active?.userId || scope.userId;

      // If call produced usage, commit actual credits
      if (usage && ((usage.inputTokens ?? 0) > 0 || (usage.outputTokens ?? 0) > 0 || (usage.costUsd ?? 0) > 0)) {
        // Calculate credits based on cost or tokens (1 credit ~= $0.005 or default ratio in pricing)
        let creditCost = 2; // base turn
        if (usage.costUsd && usage.costUsd > 0) {
          // 1 credit per $0.002
          creditCost = Math.max(1, Math.ceil(usage.costUsd / 0.002));
        } else if (usage.inputTokens || usage.outputTokens) {
          const totalTokens = (usage.inputTokens ?? 0) + (usage.outputTokens ?? 0);
          creditCost = Math.max(1, Math.ceil(totalTokens / 1000));
        }

        await client.commitCredits({
          userId,
          amount: creditCost,
          referenceId: reservationId,
          product: "orbit-bot",
        });
      } else {
        // Unstarted, cancelled, or failed call — refund locked credits
        await client.refundCredits({
          userId,
          amount: active?.lockedCredits ?? 0,
          fromLocked: true,
          referenceId: reservationId,
          product: "orbit-bot",
        });
      }
    },

    async onRequestId(reservationId, providerRequestId) {
      // Correlation log for auditing
      console.log(`[OrbitBot Billing] Call ${reservationId} connected to providerRequestId: ${providerRequestId}`);
    },
  };
}

