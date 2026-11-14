import { describe, expect, it } from "vitest";
import { createMediaGenerationProvider } from "./media-generation-factory.js";

describe("createMediaGenerationProvider cloud-only policy", () => {
  it("disables requesty media generation in cloud-only mode", () => {
    expect(
      createMediaGenerationProvider({
        ORBIT_CLOUD_ONLY: "true",
        MEDIA_GENERATION_PROVIDER: "requesty",
        MEDIA_GENERATION_API_KEY: "test-key",
      } as NodeJS.ProcessEnv),
    ).toBeUndefined();
  });

  it("disables fal media generation in cloud-only mode", () => {
    expect(
      createMediaGenerationProvider({
        ORBIT_CLOUD_ONLY: "true",
        MEDIA_GENERATION_PROVIDER: "fal",
        MEDIA_GENERATION_API_KEY: "test-key",
        MEDIA_GENERATION_IMAGE_MODEL: "test/model",
      } as NodeJS.ProcessEnv),
    ).toBeUndefined();
  });
});
