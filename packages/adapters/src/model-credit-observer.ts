import type { ModelCallObserver } from "@rakazo/adapter-kit";
import { HOSTED_MODEL_CREDITS_REQUIRED_ERROR } from "@rakazo/core";
import type { PrismaClient } from "@rakazo/db";
import {
  creditAccount,
  organizationForMember,
  recordModelCreditReceipt,
  reserveModelCredits,
} from "@rakazo/db";
import { createOrbitModelCreditObserver } from "./orbit-control-plane/orbit-credit-observer.js";

export class HostedModelCreditsRequiredError extends Error {}

/** Only deployment credentials are metered; a personal connection never reaches this boundary. */
export async function hostedModelCreditObserver(
  prisma: PrismaClient,
  scope: { userId: string; spaceId: string },
): Promise<ModelCallObserver> {
  // If Orbit Control Plane microservices URL is configured (or by default in Orbit Bot environment),
  // route credit locking, settlement, and deduction directly through Orbit microservices.
  if (
    process.env.FORION_SERVER_URL ||
    process.env.ORBIT_CONTROL_PLANE_URL ||
    process.env.ORBIT_BILLING_ENABLED !== "false"
  ) {
    return createOrbitModelCreditObserver(scope);
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
