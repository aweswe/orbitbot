import { describe, expect, it } from "vitest";
import { schemaFromConnectionString } from "./client.js";

describe("schemaFromConnectionString", () => {
  it("reads Prisma's ?schema= parameter", () => {
    expect(
      schemaFromConnectionString(
        "postgresql://user:pass@host:6543/postgres?schema=orbit_bot&pgbouncer=true",
      ),
    ).toBe("orbit_bot");
  });

  it("returns undefined when the URL carries no schema", () => {
    expect(schemaFromConnectionString("postgresql://user:pass@host:5432/postgres")).toBeUndefined();
  });

  it("returns undefined for a non-identifier schema instead of letting it reach SQL", () => {
    expect(
      schemaFromConnectionString("postgresql://user:pass@host:5432/postgres?schema=orbit_bot%3BDROP"),
    ).toBeUndefined();
    expect(
      schemaFromConnectionString('postgresql://user:pass@host:5432/postgres?schema=orbit"bot'),
    ).toBeUndefined();
  });

  it("returns undefined for an unparseable URL", () => {
    expect(schemaFromConnectionString("not a url")).toBeUndefined();
  });
});
