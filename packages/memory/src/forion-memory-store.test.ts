import type { AdapterContext } from "@forion/orbit-adapter-kit";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ForionMemoryStore } from "./forion-memory-store.js";

const context: AdapterContext = {
  userId: "user_123",
  spaceId: "space_abc",
  operationId: "op-1",
  traceId: "trace-1",
  signal: new AbortController().signal,
};

describe("ForionMemoryStore", () => {
  beforeEach(() => {
    vi.stubEnv("FORION_SERVER_URL", "https://forion.example.test");
    vi.stubEnv("FORION_ORBIT_INTERNAL_SECRET", "test-secret");
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("describes the forion-semantic adapter capabilities", () => {
    const store = new ForionMemoryStore({} as never);
    expect(store.describe()).toEqual({
      id: "forion-semantic",
      contractVersion: "1",
      adapterVersion: "0.1.0",
      capabilities: { search: true, revisions: true, markdownPortable: true },
    });
  });

  it("synchronizes commits to Forion vector store", async () => {
    const fetchMock = vi.fn(
      async () => new Response(JSON.stringify({ id: "mem-uuid-1" }), { status: 201 }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const prisma = {
      $transaction: vi.fn(async (cb: (tx: any) => Promise<any>) => {
        return cb({
          memoryDocument: {
            findFirst: vi.fn(async () => null),
            create: vi.fn(async () => ({
              id: "doc-1",
              path: "MEMORY.md",
              revision: 1,
              content: "User prefers Next.js and Tailwind",
            })),
          },
          memoryRevision: {
            create: vi.fn(),
          },
        });
      }),
    } as never;

    const store = new ForionMemoryStore(prisma);
    const revision = await store.commit(
      {
        scope: "user",
        path: "MEMORY.md",
        content: "User prefers Next.js and Tailwind",
        sourceRunId: "run-1",
      },
      context,
    );

    expect(revision.revision).toBe(1);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://forion.example.test/memory");
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer test-secret");
    expect(JSON.parse(init.body as string)).toMatchObject({
      userId: "user_123",
      content: "User prefers Next.js and Tailwind",
      sourceType: "orbit-bot",
      category: "knowledge",
    });
  });

  it("performs hybrid semantic retrieval by querying search-internal", async () => {
    const fetchMock = vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            results: [
              {
                id: "remote-1",
                content: "Production deployment is on Google Cloud Run",
                similarity: 0.89,
              },
            ],
          }),
          { status: 200 },
        ),
    );
    vi.stubGlobal("fetch", fetchMock);

    const prisma = {
      memoryDocument: {
        findMany: vi.fn(async () => [
          {
            path: "local.md",
            content: "Local note about deployment on Docker",
          },
        ]),
      },
    } as never;

    const store = new ForionMemoryStore(prisma);
    const results = await store.search(
      {
        query: "deployment",
        scope: "user",
      },
      context,
    );

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://forion.example.test/memory/search-internal");
    expect(JSON.parse(init.body as string)).toMatchObject({
      userId: "user_123",
      query: "deployment",
    });

    expect(results).toHaveLength(2);
    expect(results[0]?.snippet).toBe("Local note about deployment on Docker");
    expect(results[0]?.score).toBe(1);
    expect(results[1]?.snippet).toBe("Production deployment is on Google Cloud Run");
    expect(results[1]?.score).toBe(0.89);
  });
});
