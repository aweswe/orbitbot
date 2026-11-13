import type { ModelCallObserver } from "@forion/orbit-adapter-kit";
import { HOSTED_MODEL_CREDITS_REQUIRED_ERROR } from "@forion/orbit-core";
import type { PrismaClient } from "@forion/orbit-db";
import {
  creditAccount,
  organizationForMember,
  recordModelCreditReceipt,
  reserveModelCredits,
} from "@forion/orbit-db";
import { createOrbitModelCreditObserver } from "./orbit-control-plane/orbit-credit-observer.js";

export class HostedModelCreditsRequiredError extends Error {}

/** Only deployment credentials are metered; a personal connection never reaches this boundary. */
export async function hostedModelCreditObserver(
  prisma: PrismaClient,
  scope: { userId: string; spaceId: string },
): Promise<ModelCallObserver> {
  // Explicit opt-in only. A configured URL must not silently divert metering away
  // from the local credit ledger — and a test run must never reach a live control
  // plane just because `FORION_SERVER_URL` leaked into the environment.
  if (process.env.ORBIT_BILLING_ENABLED === "true") {
    return createOrbitModelCreditObserver(scope, prisma);
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
