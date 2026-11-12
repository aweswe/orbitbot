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
 * Rebinds a local Better-Auth user to the canonical Forion user ID when an
 * OAuth identity clash (409) is detected.
 */
export async function rebindUserIdentity(
  prisma: PrismaClient,
  oldUserId: string,
  canonicalUserId: string,
): Promise<void> {
  if (oldUserId === canonicalUserId) return;

  const oldUser = await prisma.user.findUnique({
    where: { id: oldUserId },
  });
  if (!oldUser) return;

  const canonicalUser = await prisma.user.findUnique({
    where: { id: canonicalUserId },
  });

  await prisma.$transaction(async (tx) => {
    if (!canonicalUser) {
      await tx.user.create({
        data: {
          id: canonicalUserId,
          name: oldUser.name,
          email: oldUser.email,
          emailVerified: oldUser.emailVerified,
          image: oldUser.image,
          avatarStyle: oldUser.avatarStyle,
          botAvatarSet: oldUser.botAvatarSet,
          timezone: oldUser.timezone,
          locale: oldUser.locale,
          createdAt: oldUser.createdAt,
          updatedAt: oldUser.updatedAt,
        },
      });
    }

    // Transfer auth accounts and sessions to canonical user
    await tx.account.updateMany({
      where: { userId: oldUserId },
      data: { userId: canonicalUserId },
    });
    await tx.session.updateMany({
      where: { userId: oldUserId },
      data: { userId: canonicalUserId },
    });

    // Transfer organization members, avoiding unique constraint violations on (organizationId, userId)
    const existingMembers = await tx.member.findMany({
      where: { userId: canonicalUserId },
      select: { organizationId: true },
    });
    const existingOrgIds = new Set(
      existingMembers.map((m: { organizationId: string }) => m.organizationId),
    );
    if (existingOrgIds.size > 0) {
      await tx.member.deleteMany({
        where: { userId: oldUserId, organizationId: { in: Array.from(existingOrgIds) } },
      });
    }
    await tx.member.updateMany({
      where: { userId: oldUserId },
      data: { userId: canonicalUserId },
    });

    // Transfer space members, avoiding unique constraint violations on (spaceId, userId)
    const existingSpaceMembers = await tx.spaceMember.findMany({
      where: { userId: canonicalUserId },
      select: { spaceId: true },
    });
    const existingSpaceIds = new Set(
      existingSpaceMembers.map((m: { spaceId: string }) => m.spaceId),
    );
    if (existingSpaceIds.size > 0) {
      await tx.spaceMember.deleteMany({
        where: { userId: oldUserId, spaceId: { in: Array.from(existingSpaceIds) } },
      });
    }
    await tx.spaceMember.updateMany({
      where: { userId: oldUserId },
      data: { userId: canonicalUserId },
    });

    // Delete old user row (other non-migrated cascading records cascade safely)
    await tx.user.delete({
      where: { id: oldUserId },
    });
  });
}

export async function syncOrbitUser(prisma: PrismaClient, userId: string): Promise<boolean> {
  const baseUrl = (
    process.env.FORION_SERVER_URL ||
    process.env.ORBIT_CONTROL_PLANE_URL ||
    ""
  ).replace(/\/+$/, "");
  const secret = process.env.FORION_ORBIT_INTERNAL_SECRET;
  if (!baseUrl || !secret) return false;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, name: true, email: true, image: true },
  });
  if (!user) return false;

  const account = await prisma.account.findFirst({
    where: { userId, providerId: "google" },
    select: { accountId: true },
  });

  try {
    const response = await fetch(`${baseUrl}/api/internal/orbit/sync-user`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${secret}`,
      },
      body: JSON.stringify(orbitSyncPayload(user, account?.accountId ?? null)),
      signal: AbortSignal.timeout(10_000),
    });
    if (response.ok) {
      return true;
    }

    // Handle OAuth identity clash: an existing account in Forion billing DB already owns this (provider, external_id)
    if (response.status === 409) {
      const data = (await response.json().catch(() => null)) as {
        canonicalUserId?: string;
      } | null;
      const canonicalUserId = data?.canonicalUserId;

      if (canonicalUserId && canonicalUserId !== userId) {
        await rebindUserIdentity(prisma, userId, canonicalUserId);

        // Re-sync with Forion using canonical ID
        const canonicalUser = await prisma.user.findUnique({
          where: { id: canonicalUserId },
          select: { id: true, name: true, email: true, image: true },
        });
        if (canonicalUser) {
          const retryResponse = await fetch(`${baseUrl}/api/internal/orbit/sync-user`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${secret}`,
            },
            body: JSON.stringify(orbitSyncPayload(canonicalUser, account?.accountId ?? null)),
            signal: AbortSignal.timeout(10_000),
          });
          return retryResponse.ok;
        }
      }
    }

    return false;
  } catch {
    return false;
  }
}
