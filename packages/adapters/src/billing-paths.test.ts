import { describe, expect, it } from "vitest";
import { BILLING_PATHS, billingPathTagFor, untaggedBillingPaths } from "./billing-paths.js";
import { CursorCloudAgentProvider } from "./cursor-cloud-agent.js";
import { HttpDecisionProvider } from "./http-decisions.js";

describe("billing path inventory", () => {
  it("tags every model, media, voice, and memory entry point", () => {
    expect(untaggedBillingPaths()).toEqual([]);
    expect(BILLING_PATHS.length).toBeGreaterThanOrEqual(12);
    expect(new Set(BILLING_PATHS.map((path) => path.id)).size).toBe(BILLING_PATHS.length);
  });

  it("exposes the tag for each known path", () => {
    expect(billingPathTagFor("chat.main")).toBe("metered-gateway");
    expect(billingPathTagFor("media.image")).toBe("disabled-cloud");
    expect(billingPathTagFor("memory.forion")).toBe("included");
    expect(billingPathTagFor("unknown.path")).toBeUndefined();
  });

  it("rejects direct decision and cloud-agent providers in cloud mode", () => {
    const previous = process.env.ORBIT_CLOUD_ONLY;
    process.env.ORBIT_CLOUD_ONLY = "true";
    try {
      expect(
        () =>
          new HttpDecisionProvider("openrouter", {
            apiKey: "test-key",
          } as never),
      ).toThrow();
      expect(() => new CursorCloudAgentProvider({ apiKey: "test-key" })).toThrow(
        /disabled in Orbit Cloud/,
      );
    } finally {
      if (previous === undefined) delete process.env.ORBIT_CLOUD_ONLY;
      else process.env.ORBIT_CLOUD_ONLY = previous;
    }
  });
});
