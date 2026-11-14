import type { ModelCallObserver } from "@forion/orbit-adapter-kit";
import { HOSTED_MODEL_CREDITS_REQUIRED_ERROR } from "@forion/orbit-core";
import type { PrismaClient } from "@forion/orbit-db";
import {
  creditAccount,
  organizationForMember,
  recordModelCreditReceipt,
  reserveModelCredits,
} from "@forion/orbit-db";
import { getLogger } from "@forion/orbit-logging";

export class HostedModelCreditsRequiredError extends Error {}

/**
 * Hosted mode has one meter: the Forion AI gateway. The gateway locks and
 * settles every managed call itself. Orbit still observes usage for the UI,
 * but it must never lock or settle against the same wallet — that produced the
 * live "Cannot commit 19 credits — only 7 locked" failure.
 */
function gatewayTelemetryObserver(): ModelCallObserver {
  return {
    beforeCall: (call) =>
      `gateway:${call.runId ?? "run"}:${call.callId ?? call.modelId ?? "call"}`,
    afterCall: async (reservationId, usage) => {
      if (usage) {
        getLogger().info("orbit_billing.gateway_usage", {
          reservationId,
          inputTokens: usage.inputTokens,
          outputTokens: usage.outputTokens,
          costUsd: usage.costUsd,
        });
      }
    },
    onRequestId: async () => {},
  };
}

/** Only deployment credentials are metered; a personal connection never reaches this boundary. */
export async function hostedModelCreditObserver(
  prisma: PrismaClient,
  scope: { userId: string; spaceId: string },
): Promise<ModelCallObserver> {
  // Hosted mode: the Forion gateway is the sole billing authority.
  if (process.env.ORBIT_BILLING_ENABLED === "true") {
    return gatewayTelemetryObserver();
  }

  const membership = await organizationForMember(prisma, scope);
  if (!membership) throw new Error("Model credit account is unavailable");
  const account = await creditAccount(prisma, membership.organizationId);
  if (account.mode !== "credits" && account.balanceMicros <= 0n)
    throw new HostedModelCreditsRequiredError(HOSTED_MODEL_CREDITS_REQUIRED_ERROR);
  return {
    beforeCall: (call) =>
      reserveModelCredits(prisma, membership.organizationId, call.maxCostUsd ?? Number.NaN, {
        callId: call.callId,
        userId: scope.userId,
        spaceId: scope.spaceId,
        runId: call.runId,
        provider: call.provider,
        model: call.modelId,
      }),
    afterCall: (reservationId, usage) => recordModelCreditReceipt(prisma, reservationId, usage),
    onRequestId: async (id, providerRequestId) => {
      await prisma.modelCreditEntry.updateMany({
        where: { id, providerRequestId: null },
        data: { providerRequestId },
      });
    },
  };
}
