import type { Model, MutableModels, Provider } from "@earendil-works/pi-ai";
import { createProvider } from "@earendil-works/pi-ai";
import { openAICompletionsApi } from "@earendil-works/pi-ai/api/openai-completions.lazy";

export const REQUESTY_PROVIDER_ID = "requesty";
export const DEFAULT_REQUESTY_BASE_URL = "https://router.requesty.ai/v1";
export const DEFAULT_REQUESTY_MODEL_ID = "deepseek/deepseek-v4-flash";

export const POPULAR_REQUESTY_MODELS = [
  "deepseek/deepseek-v4-flash",
  "deepseek/deepseek-chat",
  "deepseek/deepseek-r1",
  "google/gemini-2.5-flash",
  "google/gemini-2.5-pro",
  "google/gemini-3.1-flash-lite-preview",
  "google/gemini-3.1-flash-image",
  "anthropic/claude-3-7-sonnet",
  "anthropic/claude-3-5-sonnet",
  "minimax/minimax-01",
  "meta-llama/llama-3.3-70b-instruct",
  "qwen/qwen-2.5-coder-32b-instruct",
] as const;

export function createRequestyModel(
  modelId: string,
  baseUrl: string = DEFAULT_REQUESTY_BASE_URL,
  contextWindow: number = 131_072,
  maxTokens: number = 16_384,
): Model<"openai-completions"> {
  const isReasoning =
    modelId.includes("r1") ||
    modelId.includes("reasoning") ||
    modelId.includes("thinking") ||
    modelId.includes("3.7");

  return {
    id: modelId,
    name: `Requesty: ${modelId}`,
    api: "openai-completions",
    provider: REQUESTY_PROVIDER_ID,
    baseUrl: baseUrl.replace(/\/$/, ""),
    reasoning: isReasoning,
    input: modelId.includes("image") ? ["text", "image"] : ["text"],
    cost: { input: 0.00000045, output: 0.000002, cacheRead: 0, cacheWrite: 0 },
    contextWindow,
    maxTokens,
  };
}

export function requestyProvider(
  baseUrl: string = DEFAULT_REQUESTY_BASE_URL,
): Provider {
  const models = POPULAR_REQUESTY_MODELS.map((id) =>
    createRequestyModel(id, baseUrl),
  );

  return createProvider({
    id: REQUESTY_PROVIDER_ID,
    name: "Requesty (Orbit Router)",
    baseUrl: baseUrl.replace(/\/$/, ""),
    auth: {
      apiKey: {
        name: "Requesty API Key",
        resolve: async () => ({
          auth: {
            apiKey: process.env.REQUESTY_API_KEY?.trim() || "local",
            baseUrl: baseUrl.replace(/\/$/, ""),
          },
          source: "REQUESTY_API_KEY",
        }),
      },
    },
    models,
    api: openAICompletionsApi(),
  });
}

export function registerRequestyCatalog(models: MutableModels): MutableModels {
  const baseUrl =
    process.env.REQUESTY_BASE_URL?.trim() || DEFAULT_REQUESTY_BASE_URL;
  models.setProvider(requestyProvider(baseUrl));
  return models;
}
