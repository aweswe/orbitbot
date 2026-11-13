import type { PrismaClient } from "@forion/orbit-db";

/**
 * Provisions a signed-in Orbit user in the Forion control plane.
 *
 * Forion owns the wallet, so a user it has never seen cannot lock credits.
 * `POST /api/internal/orbit/sync-user` is idempotent, and it is the supported
 * hand-off for `provider: "google"` identities (see forion-server
 * `OrbitSyncUserDto`). Best-effort: a control-plane outage must not block
 * sign-in, and the credits call will surface the real error if it persists.
 */

export interface OrbitIdentity {
  id: string;
  name: string;
  email: string;
  image: string | null;
}

export interface OrbitSyncPayload {
  user_id: string;
  provider: "google";
  external_id: string;
  username: string;
  email: string;
  name: string;
  avatar_url: string | null;
}

/**
 * Canonical Principal Contract
 * Represents the resolved mapping between a local application user and the central
 * ecosystem principal in Forion / Control Plane.
 */
export interface CanonicalPrincipal {
  /** Local application user ID (Orbit `user.id`) */
  localUserId: string;
  /** Canonical ecosystem principal ID in Forion / control plane */
  canonicalPrincipalId: string;
  /** Tenant / organization ID if scoped */
  tenantId?: string | null;
  /** Verified provider (e.g. 'google') */
  provider?: string | null;
  /** Verified provider subject identifier (Google sub / external ID) */
  providerSubject?: string | null;
  /** Whether the identity mapping was established via verified provider subject */
  isLinked: boolean;
}

export interface RecordIdentityMappingParams {
  localUserId: string;
  canonicalPrincipalId: string;
  provider: string;
  providerSubject: string;
  metadata?: Record<string, unknown>;
}

export function orbitSyncPayload(user: OrbitIdentity, accountId: string | null): OrbitSyncPayload {
  const at = user.email.indexOf("@");
  return {
    user_id: user.id,
    provider: "google",
    // The OAuth subject is stable across email changes; the Orbit id is the fallback.
    external_id: accountId ?? user.id,
    username: at > 0 ? user.email.slice(0, at) : user.id,
    email: user.email,
    name: user.name,
    avatar_url: user.image ?? null,
  };
}

/**
 * Records an explicit, auditable mapping between a local application user and a canonical
 * ecosystem principal. Avoids uncontrolled mass FK rebinding.
 */
export async function recordIdentityMapping(
  prisma: PrismaClient,
  params: RecordIdentityMappingParams,
): Promise<void> {
  if (params.localUserId === params.canonicalPrincipalId) return;

  const client = prisma as unknown as {
    identityMapping?: {
      upsert: (args: unknown) => Promise<unknown>;
    };
  };

  if (client.identityMapping) {
    try {
      await client.identityMapping.upsert({
        where: {
          localUserId_provider: {
            localUserId: params.localUserId,
            provider: params.provider,
          },
        },
        create: {
          localUserId: params.localUserId,
          canonicalPrincipalId: params.canonicalPrincipalId,
          provider: params.provider,
          providerSubject: params.providerSubject,
          metadata: params.metadata ?? {},
        },
        update: {
          canonicalPrincipalId: params.canonicalPrincipalId,
          providerSubject: params.providerSubject,
          verifiedAt: new Date(),
          metadata: params.metadata ?? {},
        },
      });
    } catch {
      // Degrade gracefully if table is not yet migrated in an active run
    }
  }
}

/**
 * Resolves a local user to their canonical ecosystem principal.
 * Prioritizes verified provider subject mappings over local fallback.
 */
export async function resolveCanonicalPrincipal(
  prisma: PrismaClient,
  localUserId: string,
): Promise<CanonicalPrincipal> {
  const client = prisma as unknown as {
    identityMapping?: {
      findFirst: (args: unknown) => Promise<{
        canonicalPrincipalId: string;
        provider: string;
        providerSubject: string;
      } | null>;
    };
  };

  if (client.identityMapping) {
    try {
      const mapping = await client.identityMapping.findFirst({
        where: { localUserId },
      });
      if (mapping) {
        return {
          localUserId,
          canonicalPrincipalId: mapping.canonicalPrincipalId,
          provider: mapping.provider,
          providerSubject: mapping.providerSubject,
          isLinked: true,
        };
      }
    } catch {
      // Degrade gracefully
    }
  }

  return {
    localUserId,
    canonicalPrincipalId: localUserId,
    provider: null,
    providerSubject: null,
    isLinked: false,
  };
}

/**
 * Resolves the canonical principal ID for a local user.
 */
export async function resolveCanonicalPrincipalId(
  prisma: PrismaClient,
  localUserId: string,
): Promise<string> {
  const principal = await resolveCanonicalPrincipal(prisma, localUserId);
  return principal.canonicalPrincipalId;
}

/**
 * Controlled identity mapping: records an auditable identity link from
 * oldUserId to canonicalUserId instead of destructive mass FK mutation.
 */
export async function rebindUserIdentity(
  prisma: PrismaClient,
  oldUserId: string,
  canonicalUserId: string,
  providerSubject?: string,
): Promise<void> {
  if (oldUserId === canonicalUserId) return;

  await recordIdentityMapping(prisma, {
    localUserId: oldUserId,
    canonicalPrincipalId: canonicalUserId,
    provider: "google",
    providerSubject: providerSubject ?? canonicalUserId,
    metadata: {
      reason: "controlled_canonical_link",
      linkedAt: new Date().toISOString(),
    },
  });
}

export async function syncOrbitUserDetailed(
  prisma: PrismaClient,
  userId: string,
): Promise<{ ok: boolean; canonicalUserId: string; rebound: boolean }> {
  const baseUrl = (
    process.env.FORION_SERVER_URL ||
    process.env.ORBIT_CONTROL_PLANE_URL ||
    ""
  ).replace(/\/+$/, "");
  const secret = process.env.FORION_ORBIT_INTERNAL_SECRET;
  if (!baseUrl || !secret) return { ok: false, canonicalUserId: userId, rebound: false };

  // Check if an explicit mapping has already mapped this user
  const knownCanonicalId = await resolveCanonicalPrincipalId(prisma, userId);

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, name: true, email: true, image: true },
  });
  if (!user) return { ok: false, canonicalUserId: userId, rebound: false };

  const account = await prisma.account.findFirst({
    where: { userId, providerId: "google" },
    select: { accountId: true },
  });

  const providerSubject = account?.accountId ?? null;

  try {
    const response = await fetch(`${baseUrl}/api/internal/orbit/sync-user`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${secret}`,
      },
      body: JSON.stringify(orbitSyncPayload(user, providerSubject)),
      signal: AbortSignal.timeout(10_000),
    });
    if (response.ok) {
      return { ok: true, canonicalUserId: knownCanonicalId, rebound: knownCanonicalId !== userId };
    }

    // Handle OAuth verified subject clash (409):
    // Central Forion billing DB already owns this (provider, external_id) under a canonical user ID.
    if (response.status === 409) {
      const data = (await response.json().catch(() => null)) as {
        canonicalUserId?: string;
      } | null;
      const canonicalUserId = data?.canonicalUserId;

      if (canonicalUserId && canonicalUserId !== userId) {
        // Establish explicit, auditable identity mapping instead of uncontrolled mass FK rebinding
        await recordIdentityMapping(prisma, {
          localUserId: userId,
          canonicalPrincipalId: canonicalUserId,
          provider: "google",
          providerSubject: providerSubject ?? canonicalUserId,
          metadata: {
            reason: "oauth_subject_clash",
            linkedAt: new Date().toISOString(),
          },
        });

        // Re-sync with Forion using canonical ID
        const canonicalUser =
          (await prisma.user.findUnique({
            where: { id: canonicalUserId },
            select: { id: true, name: true, email: true, image: true },
          })) ?? user;

        const retryResponse = await fetch(`${baseUrl}/api/internal/orbit/sync-user`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${secret}`,
          },
          body: JSON.stringify(
            orbitSyncPayload({ ...canonicalUser, id: canonicalUserId }, providerSubject),
          ),
          signal: AbortSignal.timeout(10_000),
        });
        return {
          ok: retryResponse.ok,
          canonicalUserId,
          rebound: true,
        };
      }
    }

    return { ok: false, canonicalUserId: userId, rebound: false };
  } catch {
    return { ok: false, canonicalUserId: userId, rebound: false };
  }
}

export async function syncOrbitUser(prisma: PrismaClient, userId: string): Promise<boolean> {
  const result = await syncOrbitUserDetailed(prisma, userId);
  return result.ok;
}

export async function syncOrbitUserWithRebind(
  prisma: PrismaClient,
  userId: string,
): Promise<{ ok: boolean; canonicalUserId: string; rebound: boolean }> {
  return syncOrbitUserDetailed(prisma, userId);
}
