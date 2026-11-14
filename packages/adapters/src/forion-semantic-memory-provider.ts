import { randomUUID } from "node:crypto";
import type {
  AdapterContext,
  SemanticMemoryCapabilities,
  SemanticMemoryProvider,
  SemanticMemoryRecallRequest,
  SemanticMemoryResponse,
  SemanticMemoryResult,
  SemanticMemorySaveRequest,
} from "@forion/orbit-adapter-kit";
import { signOrbitInternalRequest } from "./orbit-control-plane/orbit-control-plane-client.js";

export const FORION_MEMORY_PROVIDER_ID = "forion";

export class ForionSemanticMemoryProvider implements SemanticMemoryProvider {
  private readonly baseUrl: string;
  private readonly internalSecret: string;

  constructor(options?: { baseUrl?: string; internalSecret?: string }) {
    this.baseUrl = (
      options?.baseUrl ||
      process.env.FORION_SERVER_URL ||
      process.env.ORBIT_CONTROL_PLANE_URL ||
      "http://localhost:3001"
    ).replace(/\/+$/, "");
    this.internalSecret =
      options?.internalSecret ||
      process.env.FORION_ORBIT_INTERNAL_SECRET ||
      process.env.FORION_API_KEY ||
      "";
  }

  describe() {
    return {
      id: FORION_MEMORY_PROVIDER_ID,
      contractVersion: "1",
      adapterVersion: "0.1.0",
      capabilities: {
        recall: true,
        save: true,
        purgeHistory: true,
        forget: false,
        sharedScope: true,
      } as SemanticMemoryCapabilities,
    };
  }

  async recall(
    request: SemanticMemoryRecallRequest,
    context: AdapterContext,
  ): Promise<SemanticMemoryResponse<SemanticMemoryResult[]>> {
    const userId = context.userId;
    if (!userId) {
      return { ok: true, value: [] };
    }

    try {
      const path = "/memory/search-internal";
      const body = {
        userId,
        query: request.query,
        topK: request.limit || 5,
        minSimilarity: 0.25,
      };
      const response = await fetch(`${this.baseUrl}${path}`, {
        method: "POST",
        headers: signOrbitInternalRequest(
          this.internalSecret,
          "POST",
          path,
          userId,
          { "x-request-id": randomUUID() },
          body,
        ),
        body: JSON.stringify(body),
        signal: context.signal || AbortSignal.timeout(6_000),
      });

      if (!response.ok) {
        return { ok: true, value: [] };
      }

      const data = (await response.json()) as {
        results?: Array<{
          id?: string;
          content: string;
          similarity?: number;
          category?: string;
        }>;
      };

      const results: SemanticMemoryResult[] = (data.results ?? []).map((item) => ({
        id: item.id,
        memory: item.content,
        score: item.similarity ?? 0.8,
        provenance: "Orbit / Forion Central Memory",
        entity: item.category || "user",
      }));

      return { ok: true, value: results };
    } catch (_err: unknown) {
      return { ok: true, value: [] };
    }
  }

  async save(
    request: SemanticMemorySaveRequest,
    context: AdapterContext,
  ): Promise<SemanticMemoryResponse> {
    const userId = context.userId;
    if (!userId || !request.content.trim()) {
      return { ok: true, value: undefined };
    }

    try {
      const path = "/memory";
      const body = {
        userId,
        content: request.content.trim(),
        sourceType: "orbit-bot",
        category: "knowledge",
        importance: 0.85,
      };
      const response = await fetch(`${this.baseUrl}${path}`, {
        method: "POST",
        headers: signOrbitInternalRequest(
          this.internalSecret,
          "POST",
          path,
          userId,
          { "x-request-id": randomUUID() },
          body,
        ),
        body: JSON.stringify(body),
        signal: context.signal || AbortSignal.timeout(6_000),
      });

      if (!response.ok) {
        return { ok: false, error: `Failed to save memory: status ${response.status}` };
      }

      return { ok: true, value: undefined };
    } catch (err: unknown) {
      return { ok: false, error: (err as Error).message };
    }
  }

  async purgeHistory(): Promise<SemanticMemoryResponse> {
    return { ok: true, value: undefined };
  }
}
