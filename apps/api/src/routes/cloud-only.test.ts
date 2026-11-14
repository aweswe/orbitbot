import { describe, expect, it } from "vitest";
import { refuseCloudOnly } from "./cloud-only.js";

describe("refuseCloudOnly", () => {
  it("rejects a self-managed connection in cloud mode", () => {
    expect(() => refuseCloudOnly(true, "model connections")).toThrow(
      /Orbit Cloud manages model connections/,
    );
  });

  it("allows the same connection in self-host mode", () => {
    expect(() => refuseCloudOnly(false, "model connections")).not.toThrow();
    expect(() => refuseCloudOnly(undefined, "model connections")).not.toThrow();
  });
});
