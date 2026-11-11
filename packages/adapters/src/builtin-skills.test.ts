import { describe, expect, it } from "vitest";
import { BUILTIN_AGENT_SKILLS, RAKAZO_DOCS_URLS } from "./builtin-skills.js";

describe("Orbit skill", () => {
  it("links only to the canonical docs pages", () => {
    const skill = BUILTIN_AGENT_SKILLS.find((s) => s.name === "Orbit")!;
    const urls = [...skill.content.matchAll(/https?:\/\/\S+/g)].map((match) => match[0]);
    expect(urls).toEqual(RAKAZO_DOCS_URLS);
    for (const url of urls) {
      expect(url).toMatch(/^https:\/\/docs\.orbit\.forion\.dev\/docs(?:\.md|\/[\w-]+\.md)$/);
    }
  });
});
