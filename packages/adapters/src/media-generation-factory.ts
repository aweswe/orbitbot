import type { MediaGenerationProvider } from "@forion/orbit-adapter-kit";
import {
  FakeMediaGenerationProvider,
  FalMediaGenerationProvider,
  RequestyMediaGenerationProvider,
} from "./media-generation-provider.js";

export function createMediaGenerationProvider(
  env: NodeJS.ProcessEnv = process.env,
): MediaGenerationProvider | undefined {
  const kind = env.MEDIA_GENERATION_PROVIDER?.trim().toLowerCase();
  if (kind === "disabled") return undefined;
  if (kind === "fake") return new FakeMediaGenerationProvider();
  if (kind === "fal") {
    const apiKey = env.MEDIA_GENERATION_API_KEY?.trim();
    const imageModel = env.MEDIA_GENERATION_IMAGE_MODEL?.trim();
    const videoModel = env.MEDIA_GENERATION_VIDEO_MODEL?.trim();
    if (!apiKey || (!imageModel && !videoModel))
      throw new Error("Media generation requires credentials and at least one model");
    return new FalMediaGenerationProvider({
      apiKey,
      imageModel,
      videoModel,
      baseUrl: env.MEDIA_GENERATION_BASE_URL,
    });
  }
  if (kind === "requesty") {
    const apiKey = env.MEDIA_GENERATION_API_KEY?.trim() || env.REQUESTY_API_KEY?.trim();
    if (!apiKey) throw new Error("Requesty media generation requires an API key");
    return new RequestyMediaGenerationProvider({
      apiKey,
      baseUrl: env.MEDIA_GENERATION_BASE_URL || env.REQUESTY_BASE_URL,
      imageModel: env.MEDIA_GENERATION_IMAGE_MODEL,
    });
  }
  if (!kind) {
    if (env.REQUESTY_API_KEY?.trim()) {
      return new RequestyMediaGenerationProvider({
        apiKey: env.REQUESTY_API_KEY.trim(),
        baseUrl: env.REQUESTY_BASE_URL,
        imageModel: env.MEDIA_GENERATION_IMAGE_MODEL,
      });
    }
    return undefined;
  }
  throw new Error("Unknown media generation provider");
}
