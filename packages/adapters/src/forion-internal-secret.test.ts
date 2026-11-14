import { describe, expect, it } from "vitest";
import { resolveForionInternalSecret } from "./forion-internal-secret.js";

describe("resolveForionInternalSecret", () => {
  it("uses FORION_ORBIT_INTERNAL_SECRET", () => {
    expect(
      resolveForionInternalSecret({
        FORION_ORBIT_INTERNAL_SECRET: "internal",
      } as NodeJS.ProcessEnv),
    ).toBe("internal");
  });

  it("falls back to FORION_API_KEY", () => {
    expect(resolveForionInternalSecret({ FORION_API_KEY: "api-key" } as NodeJS.ProcessEnv)).toBe(
      "api-key",
    );
  });

  it("prefers the internal secret over the API key", () => {
    expect(
      resolveForionInternalSecret({
        FORION_ORBIT_INTERNAL_SECRET: "internal",
        FORION_API_KEY: "api-key",
      } as NodeJS.ProcessEnv),
    ).toBe("internal");
  });

  it("trims surrounding whitespace", () => {
    expect(
      resolveForionInternalSecret({
        FORION_ORBIT_INTERNAL_SECRET: "  internal  ",
      } as NodeJS.ProcessEnv),
    ).toBe("internal");
  });

  it("throws when no secret is configured", () => {
    expect(() => resolveForionInternalSecret({} as NodeJS.ProcessEnv)).toThrow(
      "FORION_ORBIT_INTERNAL_SECRET",
    );
  });

  it("throws when the configured secret is blank", () => {
    expect(() =>
      resolveForionInternalSecret({ FORION_ORBIT_INTERNAL_SECRET: "   " } as NodeJS.ProcessEnv),
    ).toThrow("FORION_ORBIT_INTERNAL_SECRET");
  });
});
