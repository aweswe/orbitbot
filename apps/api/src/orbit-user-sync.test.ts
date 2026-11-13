import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  orbitSyncPayload,
  recordIdentityMapping,
  resolveCanonicalPrincipal,
  resolveCanonicalPrincipalId,
  syncOrbitUser,
  syncOrbitUserDetailed,
} from "./orbit-user-sync.js";

const user = {
  id: "user_123",
  name: "Ada Lovelace",
  email: "ada@example.com",
  image: "https://example.com/ada.png",
};

function prismaMock(accountId: string | null = "google-sub-1") {
  return {
    user: { findUnique: vi.fn(async () => user) },
    account: { findFirst: vi.fn(async () => (accountId ? { accountId } : null)) },
    identityMapping: {
      findFirst: vi.fn(async () => null),
      upsert: vi.fn(async () => ({})),
    },
  } as never;
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("orbitSyncPayload", () => {
  it("maps the Google subject to external_id and derives a username from the email", () => {
    expect(orbitSyncPayload(user, "google-sub-1")).toEqual({
      user_id: "user_123",
      provider: "google",
      external_id: "google-sub-1",
      username: "ada",
      email: "ada@example.com",
      name: "Ada Lovelace",
      avatar_url: "https://example.com/ada.png",
    });
  });

  it("falls back to the Orbit user id when the account row is missing", () => {
    expect(orbitSyncPayload(user, null).external_id).toBe("user_123");
  });
});

describe("explicit identity mapping & canonical principal resolution", () => {
  it("records an explicit identity mapping in identity_mappings table", async () => {
    const upsert = vi.fn(async () => ({}));
    const prisma = {
      identityMapping: { upsert },
    } as never;

    await recordIdentityMapping(prisma, {
      localUserId: "local_user_a",
      canonicalPrincipalId: "canonical_principal_100",
      provider: "google",
      providerSubject: "google-sub-a",
      metadata: { reason: "test_link" },
    });

    expect(upsert).toHaveBeenCalledWith({
      where: {
        localUserId_provider: {
          localUserId: "local_user_a",
          provider: "google",
        },
      },
      create: {
        localUserId: "local_user_a",
        canonicalPrincipalId: "canonical_principal_100",
        provider: "google",
        providerSubject: "google-sub-a",
        metadata: { reason: "test_link" },
      },
      update: {
        canonicalPrincipalId: "canonical_principal_100",
        providerSubject: "google-sub-a",
        verifiedAt: expect.any(Date),
        metadata: { reason: "test_link" },
      },
    });
  });

  it("resolves canonical principal from identity_mappings when linked", async () => {
    const prisma = {
      identityMapping: {
        findFirst: vi.fn(async ({ where }: { where: { localUserId: string } }) => {
          if (where.localUserId === "local_user_linked") {
            return {
              localUserId: "local_user_linked",
              canonicalPrincipalId: "central_principal_777",
              provider: "google",
              providerSubject: "sub-777",
            };
          }
          return null;
        }),
      },
    } as never;

    const principal = await resolveCanonicalPrincipal(prisma, "local_user_linked");
    expect(principal).toEqual({
      localUserId: "local_user_linked",
      canonicalPrincipalId: "central_principal_777",
      provider: "google",
      providerSubject: "sub-777",
      isLinked: true,
    });

    const canonicalId = await resolveCanonicalPrincipalId(prisma, "local_user_linked");
    expect(canonicalId).toBe("central_principal_777");
  });

  it("resolves unlinked user to local user ID without linking flag", async () => {
    const prisma = {
      identityMapping: {
        findFirst: vi.fn(async () => null),
      },
    } as never;

    const principal = await resolveCanonicalPrincipal(prisma, "local_user_unlinked");
    expect(principal).toEqual({
      localUserId: "local_user_unlinked",
      canonicalPrincipalId: "local_user_unlinked",
      provider: null,
      providerSubject: null,
      isLinked: false,
    });

    const canonicalId = await resolveCanonicalPrincipalId(prisma, "local_user_unlinked");
    expect(canonicalId).toBe("local_user_unlinked");
  });
});

describe("syncOrbitUser", () => {
  beforeEach(() => {
    vi.stubEnv("FORION_SERVER_URL", "https://forion.example.test");
    vi.stubEnv("FORION_ORBIT_INTERNAL_SECRET", "internal-secret");
  });

  it("posts the identity to the Forion control plane with the internal secret", async () => {
    const fetchMock = vi.fn(async () => new Response("{}", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(syncOrbitUser(prismaMock(), "user_123")).resolves.toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://forion.example.test/api/internal/orbit/sync-user");
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer internal-secret");
    expect(JSON.parse(init.body as string)).toMatchObject({
      user_id: "user_123",
      provider: "google",
      external_id: "google-sub-1",
    });
  });

  it("reports a failed sync without throwing", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("nope", { status: 500 })),
    );
    await expect(syncOrbitUser(prismaMock(), "user_123")).resolves.toBe(false);
  });

  it("does nothing when the control plane is not configured", async () => {
    vi.stubEnv("FORION_SERVER_URL", "");
    vi.stubEnv("FORION_ORBIT_INTERNAL_SECRET", "");
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await expect(syncOrbitUser(prismaMock(), "user_123")).resolves.toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("does nothing for a user that no longer exists", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const prisma = {
      user: { findUnique: vi.fn(async () => null) },
      account: { findFirst: vi.fn() },
      identityMapping: { findFirst: vi.fn(async () => null) },
    } as never;

    await expect(syncOrbitUser(prisma, "gone")).resolves.toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("resolves OAuth 409 clash by recording explicit identity mapping and re-syncing without mass FK deletion", async () => {
    let callCount = 0;
    const fetchMock = vi.fn(async () => {
      callCount++;
      if (callCount === 1) {
        return new Response(
          JSON.stringify({
            statusCode: 409,
            message: "OAuth identity already bound to another user id in billing DB",
            canonicalUserId: "canonical_456",
          }),
          { status: 409, headers: { "Content-Type": "application/json" } },
        );
      }
      return new Response(JSON.stringify({ success: true }), { status: 200 });
    });
    vi.stubGlobal("fetch", fetchMock);

    const upsertMapping = vi.fn(async () => ({}));
    const userDelete = vi.fn();
    const userUpdateMany = vi.fn();

    const prisma = {
      user: {
        findUnique: vi.fn(async ({ where }: { where: { id: string } }) => {
          if (where.id === "user_123") return user;
          if (where.id === "canonical_456") return { ...user, id: "canonical_456" };
          return null;
        }),
        delete: userDelete,
        updateMany: userUpdateMany,
      },
      account: {
        findFirst: vi.fn(async () => ({ accountId: "google-sub-1" })),
      },
      identityMapping: {
        findFirst: vi.fn(async () => null),
        upsert: upsertMapping,
      },
    } as never;

    const result = await syncOrbitUserDetailed(prisma, "user_123");
    expect(result).toEqual({
      ok: true,
      canonicalUserId: "canonical_456",
      rebound: true,
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    const secondCall = fetchMock.mock.calls[1] as unknown as [string, RequestInit];
    expect(JSON.parse(secondCall[1].body as string)).toMatchObject({
      user_id: "canonical_456",
      provider: "google",
      external_id: "google-sub-1",
    });

    // Auditable mapping was stored in identity_mappings
    expect(upsertMapping).toHaveBeenCalledWith({
      where: {
        localUserId_provider: {
          localUserId: "user_123",
          provider: "google",
        },
      },
      create: expect.objectContaining({
        localUserId: "user_123",
        canonicalPrincipalId: "canonical_456",
        provider: "google",
        providerSubject: "google-sub-1",
      }),
      update: expect.objectContaining({
        canonicalPrincipalId: "canonical_456",
        providerSubject: "google-sub-1",
      }),
    });

    // Crucial: no uncontrolled mass FK destruction or local user deletion!
    expect(userDelete).not.toHaveBeenCalled();
    expect(userUpdateMany).not.toHaveBeenCalled();
  });

  it("maintains strict multi-account isolation between different users", async () => {
    const mappings = new Map<string, string>();
    const prisma = {
      identityMapping: {
        findFirst: vi.fn(async ({ where }: { where: { localUserId: string } }) => {
          const canonicalPrincipalId = mappings.get(where.localUserId);
          if (canonicalPrincipalId) {
            return {
              localUserId: where.localUserId,
              canonicalPrincipalId,
              provider: "google",
              providerSubject: `sub-${where.localUserId}`,
            };
          }
          return null;
        }),
        upsert: vi.fn(async ({ create }: any) => {
          mappings.set(create.localUserId, create.canonicalPrincipalId);
        }),
      },
    } as never;

    // User A and User B map to separate canonical principals
    await recordIdentityMapping(prisma, {
      localUserId: "user_a",
      canonicalPrincipalId: "canonical_a",
      provider: "google",
      providerSubject: "sub-a",
    });

    await recordIdentityMapping(prisma, {
      localUserId: "user_b",
      canonicalPrincipalId: "canonical_b",
      provider: "google",
      providerSubject: "sub-b",
    });

    const principalA = await resolveCanonicalPrincipal(prisma, "user_a");
    const principalB = await resolveCanonicalPrincipal(prisma, "user_b");

    expect(principalA.canonicalPrincipalId).toBe("canonical_a");
    expect(principalB.canonicalPrincipalId).toBe("canonical_b");
    expect(principalA.canonicalPrincipalId).not.toBe(principalB.canonicalPrincipalId);

    // Another unmapped user C remains isolated as user_c
    const principalC = await resolveCanonicalPrincipal(prisma, "user_c");
    expect(principalC.canonicalPrincipalId).toBe("user_c");
    expect(principalC.isLinked).toBe(false);
  });
});
