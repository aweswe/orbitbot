import type { PrismaClient } from "@rakazo/db";

/**
 * Provisions a signed-in Orion user in the Forion control plane.
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
    return response.ok;
  } catch {
    return false;
  }
}
