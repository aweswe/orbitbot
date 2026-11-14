import { describe, expect, it } from "vitest";
import { hasHostedModelCredits, validateBotModelChange } from "./model-selection.js";

const scope = { userId: "user-1", spaceId: "space-1" };

async function inCloudOnly<T>(run: () => Promise<T>): Promise<T> {
  const previous = process.env.ORBIT_CLOUD_ONLY;
  process.env.ORBIT_CLOUD_ONLY = "true";
  try {
    return await run();
  } finally {
    if (previous === undefined) delete process.env.ORBIT_CLOUD_ONLY;
    else process.env.ORBIT_CLOUD_ONLY = previous;
  }
}

describe("cloud-only model policy", () => {
  it("treats only the hosted providers as hosted", async () => {
    await inCloudOnly(async () => {
      expect(await hasHostedModelCredits({} as never, scope, "requesty")).toBe(true);
      expect(await hasHostedModelCredits({} as never, scope, "orbit")).toBe(true);
      expect(await hasHostedModelCredits({} as never, scope, "openai")).toBe(false);
      expect(await hasHostedModelCredits({} as never, scope, "openai-compatible")).toBe(false);
    });
  });

  it("rejects a non-hosted provider when a bot model changes", async () => {
    await inCloudOnly(async () => {
      const result = await validateBotModelChange({} as never, {
        ...scope,
        provider: "openai",
        model: "gpt-4",
        current: undefined,
      });
      expect(result).toEqual({
        ok: false,
        error: "Orbit Cloud supports hosted models only",
      });
    });
  });

  it("allows the hosted provider when a bot model changes", async () => {
    await inCloudOnly(async () => {
      const result = await validateBotModelChange({} as never, {
        ...scope,
        provider: "requesty",
        model: "deepseek/deepseek-v4-flash",
        current: undefined,
      });
      expect(result).toEqual({
        ok: true,
        provider: "requesty",
        model: "deepseek/deepseek-v4-flash",
        thinkingLevel: null,
      });
    });
  });
});
