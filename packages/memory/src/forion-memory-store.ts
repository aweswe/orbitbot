import type {
  AdapterContext,
  MemoryCommitRequest,
  MemoryExportRequest,
  MemoryReadRequest,
  MemoryRemoveRequest,
  MemoryRevision,
  MemorySearchRequest,
  MemorySearchResult,
  MemorySnapshot,
  MemoryStore,
  PortableFile,
} from "@forion/orbit-adapter-kit";
import type { PrismaClient } from "@forion/orbit-db";
import { MarkdownMemoryStore } from "./index.js";

export interface ForionMemoryStoreOptions {
  baseUrl?: string;
  internalSecret?: string;
}

interface ForionMemorySearchResult {
  id?: string;
  content: string;
  category?: string;
  similarity?: number;
}

interface ForionSearchInternalResponse {
  results?: ForionMemorySearchResult[];
  identityDoc?: { content: string; version: number } | null;
}

/**
 * ForionMemoryStore — bridges Orbit Bot's local Markdown memory store with
 * Forion's central semantic vector memory (pgvector) and identity docs.
 *
 * Local documents (MEMORY.md, revisions) remain fast and durable in Postgres
 * schema `orbit_bot`, while commits are synchronized upstream to `public.user_memories`
 * and searches perform hybrid semantic retrieval across both products.
 */
export class ForionMemoryStore implements MemoryStore {
  private readonly local: MarkdownMemoryStore;
  private readonly baseUrl: string;
  private readonly internalSecret: string;

  constructor(prisma: PrismaClient, options: ForionMemoryStoreOptions = {}) {
    this.local = new MarkdownMemoryStore(prisma);
    this.baseUrl = (
      options.baseUrl ||
      process.env.FORION_SERVER_URL ||
      process.env.ORBIT_CONTROL_PLANE_URL ||
      ""
    ).replace(/\/+$/, "");
    this.internalSecret = options.internalSecret || process.env.FORION_ORBIT_INTERNAL_SECRET || "";
  }

  describe() {
    return {
      id: "forion-semantic",
      contractVersion: "1",
      adapterVersion: "0.1.0",
      capabilities: { search: true, revisions: true, markdownPortable: true },
    };
  }

  async read(request: MemoryReadRequest, context: AdapterContext): Promise<MemorySnapshot> {
    const localSnapshot = await this.local.read(request, context);
    const scope = request.scope;
    const isSupportedScope = scope === "user" || scope === "workspace" || scope === "project";
    if (!isSupportedScope || !this.baseUrl || !this.internalSecret || !context.userId) {
      return localSnapshot;
    }

    try {
      const workspaceId = request.workspaceId || context.workspaceId || context.spaceId;
      const projectId = request.projectId || context.projectId;

      // 1. Fetch user's consolidated identity doc from Forion (only for personal/user scope)
      const idDocPromise =
        scope === "user"
          ? fetch(`${this.baseUrl}/memory/${encodeURIComponent(context.userId)}/identity-doc`, {
              method: "GET",
              headers: {
                Authorization: `Bearer ${this.internalSecret}`,
                "x-orbit-user-id": context.userId,
              },
              signal: AbortSignal.timeout(5_000),
            })
              .then(async (res) =>
                res.ok
                  ? ((await res.json()) as {
                      content?: string;
                      version?: number;
                      updatedAt?: string;
                    })
                  : null,
              )
              .catch(() => null)
          : Promise.resolve(null);

      // 2. Fetch contextually relevant semantic memories from Forion
      const defaultQuery =
        scope === "workspace"
          ? "workspace shared knowledge, architecture, team conventions, project decisions"
          : scope === "project"
            ? "project architecture, specifications, technical decisions, active tasks"
            : "user profile, background, preferences, active projects in Orbit";
      const queryText = request.query?.trim() || defaultQuery;

      const searchPromise = fetch(`${this.baseUrl}/memory/search-internal`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.internalSecret}`,
          "x-orbit-user-id": context.userId,
        },
        body: JSON.stringify({
          userId: context.userId,
          query: queryText,
          topK: 8,
          minSimilarity: 0.2,
          scope,
          workspaceId,
          projectId,
        }),
        signal: AbortSignal.timeout(5_000),
      })
        .then(async (res) => (res.ok ? ((await res.json()) as ForionSearchInternalResponse) : null))
        .catch(() => null);

      const [idDoc, searchData] = await Promise.all([idDocPromise, searchPromise]);

      const extraDocs: MemorySnapshot["documents"] = [];
      if (idDoc?.content?.trim()) {
        let content = idDoc.content.trim();
        // Bound identity doc to high-signal sections (max 8KB) to preserve prompt headroom
        if (content.length > 8192) {
          content = content
            .slice(0, 8192)
            .replace(/\n[^\n]*$/, "\n\n*(Identity document trimmed for prompt budget)*");
        }
        extraDocs.push({
          id: `forion-identity-${context.userId}`,
          path: "Orbit/IDENTITY.md",
          content,
          revision: idDoc.version ?? 1,
          updatedAt: idDoc.updatedAt ?? new Date().toISOString(),
        });
      }

      if (searchData?.results && searchData.results.length > 0) {
        const memoryBullets = searchData.results.map((r) => `- ${r.content.trim()}`).join("\n\n");
        let path = "Orbit/SHARED_MEMORIES.md";
        let title = "Shared Memory from Orbit Chat";
        let docId = `forion-shared-memories-${context.userId}`;

        if (scope === "workspace") {
          path = "Orbit/WORKSPACE_MEMORIES.md";
          title = "Shared Workspace Memory";
          docId = `forion-workspace-${workspaceId || context.userId}`;
        } else if (scope === "project") {
          path = "Orbit/PROJECT_MEMORIES.md";
          title = "Project Memory";
          docId = `forion-project-${projectId || context.userId}`;
        }

        extraDocs.push({
          id: docId,
          path,
          content: `# ${title}\n\n${memoryBullets}`,
          revision: 1,
          updatedAt: new Date().toISOString(),
        });
      }

      if (extraDocs.length > 0) {
        return {
          documents: [...localSnapshot.documents, ...extraDocs],
        };
      }
    } catch {
      // Best-effort: fall back to local snapshot
    }

    return localSnapshot;
  }

  async search(
    request: MemorySearchRequest,
    context: AdapterContext,
  ): Promise<MemorySearchResult[]> {
    // 1. Fetch local keyword matches from MarkdownMemoryStore
    const localResults = await this.local.search(request, context);

    // 2. If Forion is not configured or userId is absent, return local results
    if (!this.baseUrl || !this.internalSecret || !context.userId) {
      return localResults;
    }

    const workspaceId = request.workspaceId || context.workspaceId || context.spaceId;
    const projectId = request.projectId || context.projectId;

    // 3. Query Forion's pgvector semantic search (search-internal)
    try {
      const response = await fetch(`${this.baseUrl}/memory/search-internal`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.internalSecret}`,
          "x-orbit-user-id": context.userId,
        },
        body: JSON.stringify({
          userId: context.userId,
          query: request.query,
          topK: 5,
          minSimilarity: 0.35,
          scope: request.scope,
          workspaceId,
          projectId,
        }),
        signal: AbortSignal.timeout(5_000),
      });

      if (!response.ok) {
        return localResults;
      }

      const data = (await response.json()) as ForionSearchInternalResponse;
      const remoteResults: MemorySearchResult[] = (data.results ?? []).map((res) => ({
        path: `forion://${request.scope === "workspace" ? "workspace_memories" : request.scope === "project" ? "project_memories" : "user_memories"}`,
        snippet: res.content,
        score: res.similarity ?? 0.8,
      }));

      // Combine and deduplicate snippets
      const seen = new Set(localResults.map((r) => r.snippet.trim().toLowerCase()));
      const combined = [...localResults];
      for (const rem of remoteResults) {
        const key = rem.snippet.trim().toLowerCase();
        if (!seen.has(key)) {
          seen.add(key);
          combined.push(rem);
        }
      }

      return combined.sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
    } catch {
      // Best-effort: network or control-plane outage must not fail local memory search
      return localResults;
    }
  }

  async commit(request: MemoryCommitRequest, context: AdapterContext): Promise<MemoryRevision> {
    // 1. Commit locally first to preserve revision history and serializable transactions
    const revision = await this.local.commit(request, context);

    // 2. Synchronize to Forion vector store asynchronously in best-effort mode
    if (this.baseUrl && this.internalSecret && context.userId && request.content.trim()) {
      const workspaceId = request.workspaceId || context.workspaceId || context.spaceId;
      const projectId = request.projectId || context.projectId;
      try {
        await fetch(`${this.baseUrl}/memory`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${this.internalSecret}`,
            "x-orbit-user-id": context.userId,
          },
          body: JSON.stringify({
            userId: context.userId,
            content: request.content.trim(),
            sourceRunId: request.sourceRunId,
            sourceType: "orbit-bot",
            category: "knowledge",
            importance: 0.85,
            scope: request.scope === "bot" ? "personal" : request.scope,
            workspaceId,
            projectId,
            metadata: {
              path: request.path,
              scope: request.scope,
              workspaceId,
              projectId,
              revision: revision.revision,
            },
          }),
          signal: AbortSignal.timeout(5_000),
        });
      } catch {
        // Upstream sync is best-effort so local execution never fails on transient network drops
      }
    }

    return revision;
  }

  /**
   * Automatic background memory extraction: sends completed conversation turns
   * to Forion Server to extract key decisions, facts, and user preferences.
   */
  async extractMemories(
    request: {
      threadId?: string;
      runId?: string;
      messages: Array<{ role: string; content: string }>;
      scope?: "personal" | "workspace" | "project";
      workspaceId?: string;
      projectId?: string;
    },
    context: AdapterContext,
  ): Promise<{
    extracted: Array<{ content: string; category: string; scope: string }>;
    stored: Array<{ id: string; content: string; category: string; scope: string }>;
    deduplicated: Array<{ content: string; reason: string }>;
  }> {
    if (!this.baseUrl || !this.internalSecret || !context.userId) {
      return { extracted: [], stored: [], deduplicated: [] };
    }

    const workspaceId = request.workspaceId || context.workspaceId || context.spaceId;
    const projectId = request.projectId || context.projectId;

    try {
      const response = await fetch(`${this.baseUrl}/memory/extract`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.internalSecret}`,
          "x-orbit-user-id": context.userId,
        },
        body: JSON.stringify({
          threadId: request.threadId,
          runId: request.runId || context.runId,
          userId: context.userId,
          workspaceId,
          projectId,
          scope: request.scope,
          messages: request.messages,
        }),
        signal: context.signal || AbortSignal.timeout(10_000),
      });

      if (!response.ok) {
        return { extracted: [], stored: [], deduplicated: [] };
      }

      return (await response.json()) as {
        extracted: Array<{ content: string; category: string; scope: string }>;
        stored: Array<{ id: string; content: string; category: string; scope: string }>;
        deduplicated: Array<{ content: string; reason: string }>;
      };
    } catch {
      return { extracted: [], stored: [], deduplicated: [] };
    }
  }

  async remove(
    request: MemoryRemoveRequest,
    context: AdapterContext,
  ): Promise<{ removed: boolean }> {
    return this.local.remove(request, context);
  }

  async *exportMarkdown(
    request: MemoryExportRequest,
    context: AdapterContext,
  ): AsyncIterable<PortableFile> {
    yield* this.local.exportMarkdown(request, context);
  }

  async importMarkdown(
    files: AsyncIterable<PortableFile>,
    context: AdapterContext,
  ): Promise<MemoryRevision> {
    return this.local.importMarkdown(files, context);
  }
}
