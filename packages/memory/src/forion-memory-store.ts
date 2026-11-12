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
    return this.local.read(request, context);
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

    // 3. Query Forion's pgvector semantic search (search-internal)
    try {
      const response = await fetch(`${this.baseUrl}/memory/search-internal`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.internalSecret}`,
        },
        body: JSON.stringify({
          userId: context.userId,
          query: request.query,
          topK: 5,
          minSimilarity: 0.35,
        }),
        signal: AbortSignal.timeout(5_000),
      });

      if (!response.ok) {
        return localResults;
      }

      const data = (await response.json()) as ForionSearchInternalResponse;
      const remoteResults: MemorySearchResult[] = (data.results ?? []).map((res) => ({
        path: "forion://user_memories",
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
      try {
        await fetch(`${this.baseUrl}/memory`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${this.internalSecret}`,
          },
          body: JSON.stringify({
            userId: context.userId,
            content: request.content.trim(),
            sourceRunId: request.sourceRunId,
            sourceType: "orbit-bot",
            category: "knowledge",
            importance: 0.85,
            metadata: {
              path: request.path,
              scope: request.scope,
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
