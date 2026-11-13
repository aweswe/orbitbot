import { describe, expect, it } from "vitest";
import { getRequestyBaseUrl, requestyProvider } from "./requesty-provider.js";

describe("requestyProvider cutover to Central AI Gateway", () => {
  it("defaults baseUrl to Forion Server Central AI Gateway", () => {
    const origServer = process.env.FORION_SERVER_URL;
    try {
      process.env.FORION_SERVER_URL = "http://localhost:3001";
      expect(getRequestyBaseUrl()).toBe("http://localhost:3001/api/ai");
    } finally {
      process.env.FORION_SERVER_URL = origServer;
    }
  });

  it("creates provider targeting the central AI gateway", () => {
    const provider = requestyProvider("http://localhost:3001/api/ai");
    expect(provider).toBeDefined();
    expect(provider.id).toBe("requesty");
  });
});
