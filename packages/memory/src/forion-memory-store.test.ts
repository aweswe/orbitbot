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

  it("reads workspace-scoped memories and produces WORKSPACE_MEMORIES.md", async () => {
    const fetchMock = vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            results: [
              {
                id: "ws-mem-1",
                content: "All services must follow schema versioning rules",
                similarity: 0.91,
              },
            ],
          }),
          { status: 200 },
        ),
    );
    vi.stubGlobal("fetch", fetchMock);

    const prisma = {
      memoryDocument: {
        findMany: vi.fn(async () => []),
      },
    } as never;

    const store = new ForionMemoryStore(prisma);
    const snapshot = await store.read(
      {
        scope: "workspace",
        workspaceId: "ws_shared_456",
      },
      context,
    );

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://forion.example.test/memory/search-internal");
    expect(JSON.parse(init.body as string)).toMatchObject({
      userId: "user_123",
      scope: "workspace",
      workspaceId: "ws_shared_456",
    });

    expect(snapshot.documents).toHaveLength(1);
    expect(snapshot.documents[0]?.path).toBe("Orbit/WORKSPACE_MEMORIES.md");
    expect(snapshot.documents[0]?.content).toContain(
      "All services must follow schema versioning rules",
    );
  });

  it("reads project-scoped memories and produces PROJECT_MEMORIES.md", async () => {
    const fetchMock = vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            results: [
              {
                id: "proj-mem-1",
                content: "Project backend uses NestJS and Fastify",
                similarity: 0.95,
              },
            ],
          }),
          { status: 200 },
        ),
    );
    vi.stubGlobal("fetch", fetchMock);

    const prisma = {
      memoryDocument: {
        findMany: vi.fn(async () => []),
      },
    } as never;

    const store = new ForionMemoryStore(prisma);
    const snapshot = await store.read(
      {
        scope: "project",
        projectId: "proj_999",
      },
      context,
    );

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://forion.example.test/memory/search-internal");
    expect(JSON.parse(init.body as string)).toMatchObject({
      userId: "user_123",
      scope: "project",
      projectId: "proj_999",
    });

    expect(snapshot.documents).toHaveLength(1);
    expect(snapshot.documents[0]?.path).toBe("Orbit/PROJECT_MEMORIES.md");
    expect(snapshot.documents[0]?.content).toContain("Project backend uses NestJS and Fastify");
  });

  it("synchronizes workspace-scoped commits to Forion vector store", async () => {
    const fetchMock = vi.fn(
      async () => new Response(JSON.stringify({ id: "ws-mem-created" }), { status: 201 }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const prisma = {
      $transaction: vi.fn(async (cb: (tx: any) => Promise<any>) => {
        return cb({
          memoryDocument: {
            findFirst: vi.fn(async () => null),
            create: vi.fn(async () => ({
              id: "doc-ws",
              path: "TEAM_RULES.md",
              revision: 1,
              content: "Team agreed on Postgres migrations",
            })),
          },
          memoryRevision: {
            create: vi.fn(),
          },
        });
      }),
    } as never;

    const store = new ForionMemoryStore(prisma);
    await store.commit(
      {
        scope: "workspace",
        workspaceId: "ws_eng_team",
        path: "TEAM_RULES.md",
        content: "Team agreed on Postgres migrations",
      },
      context,
    );

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://forion.example.test/memory");
    expect(JSON.parse(init.body as string)).toMatchObject({
      userId: "user_123",
      scope: "workspace",
      workspaceId: "ws_eng_team",
      content: "Team agreed on Postgres migrations",
    });
  });

  it("extracts memories from conversation threads via extractMemories", async () => {
    const fetchMock = vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            extracted: [
              {
                content: "Decided to adopt Biome for linting",
                category: "decision",
                scope: "workspace",
              },
            ],
            stored: [
              {
                id: "mem-extracted-1",
                content: "Decided to adopt Biome for linting",
                category: "decision",
                scope: "workspace",
              },
            ],
            deduplicated: [],
          }),
          { status: 200 },
        ),
    );
    vi.stubGlobal("fetch", fetchMock);

    const store = new ForionMemoryStore({} as never);
    const result = await store.extractMemories(
      {
        threadId: "th-100",
        workspaceId: "ws-dev",
        scope: "workspace",
        messages: [
          { role: "user", content: "Should we use Biome?" },
          { role: "assistant", content: "Yes, we decided to adopt Biome for linting." },
        ],
      },
      context,
    );

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://forion.example.test/memory/extract");
    expect(JSON.parse(init.body as string)).toMatchObject({
      threadId: "th-100",
      workspaceId: "ws-dev",
      scope: "workspace",
      userId: "user_123",
    });

    expect(result.extracted).toHaveLength(1);
    expect(result.stored).toHaveLength(1);
    expect(result.stored[0]?.id).toBe("mem-extracted-1");
  });
});
