import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { orbitSyncPayload, syncOrbitUser } from "./orbit-user-sync.js";

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
    vi.stubGlobal("fetch", vi.fn(async () => new Response("nope", { status: 500 })));
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
    } as never;

    await expect(syncOrbitUser(prisma, "gone")).resolves.toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
