import { execFileSync } from "node:child_process";
import path from "node:path";
import { describe, expect, it } from "vitest";

const describeFast = process.env.VERIFY_PROVIDERS ? describe.skip : describe;
const repoRoot = path.resolve(import.meta.dirname, "../../..");

describeFast("compose installer smoke scripts", () => {
  // The suite spawns every Compose smoke script. It takes ~9s alone but over 35s
  // when the full unit suite runs beside it, so the default 30s is too tight.
  it("passes every infra/compose/*.smoke.sh", { timeout: 120_000 }, () => {
    const runner = path.resolve(repoRoot, "infra/compose/run-smokes.sh");
    let output: string;
    try {
      output = execFileSync("bash", [runner], {
        encoding: "utf8",
        stdio: ["ignore", "pipe", "pipe"],
        cwd: repoRoot,
      });
    } catch (error) {
      const failure = error as { stdout?: string; stderr?: string; message?: string };
      throw new Error(
        `smoke suite failed: ${failure.message ?? String(error)}\n${failure.stdout ?? ""}\n${failure.stderr ?? ""}`,
      );
    }
    expect(output).toMatch(/==>/);
  });
});
