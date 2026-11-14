// @vitest-environment jsdom

import { act } from "react";
import type { Root } from "react-dom/client";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { OrbitModelPicker } from "./OrbitModelPicker";

const models = vi.hoisted(() => ({
  list: vi.fn(),
  role: vi.fn(),
  setRole: vi.fn(),
}));
const bots = vi.hoisted(() => ({ get: vi.fn(), update: vi.fn() }));
vi.mock("../../lib/rpc", () => ({ rpc: { models, bots } }));

const catalog = [
  {
    provider: "orbit",
    providerName: "Orbit",
    id: "orbit-flash",
    label: "Orbit Flash",
    billing: "included",
    managed: true,
  },
  {
    provider: "orbit",
    providerName: "Orbit",
    id: "orbit-forge",
    label: "Orbit Forge",
    billing: "included",
    managed: true,
    reasoning: true,
    thinkingLevels: ["low", "medium", "high"],
  },
];

let root: Root | null = null;
let host: HTMLDivElement | null = null;

async function render() {
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  await act(async () => {
    root!.render(<OrbitModelPicker target={{ botId: "bot-1" }} />);
  });
}

function button(name: RegExp | string) {
  return [...document.querySelectorAll("button")].find((element) =>
    typeof name === "string"
      ? element.textContent?.includes(name)
      : name.test(element.textContent ?? ""),
  );
}

beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  models.list.mockResolvedValue(catalog);
  models.role.mockResolvedValue({
    primary: { provider: "orbit", modelId: "orbit-flash", thinkingLevel: null },
    backups: [],
  });
  models.setRole.mockResolvedValue({ primary: null, backups: [] });
  bots.get.mockResolvedValue({
    id: "bot-1",
    modelProvider: "orbit",
    modelId: "orbit-flash",
    thinkingLevel: null,
  });
  bots.update.mockResolvedValue({});
});

afterEach(async () => {
  await act(async () => root?.unmount());
  host?.remove();
  root = null;
  host = null;
  vi.clearAllMocks();
});

describe("OrbitModelPicker", () => {
  it("lists the server catalog and saves a picked model", async () => {
    await render();
    const trigger = button(/Orbit Flash/);
    expect(trigger).toBeDefined();
    await act(async () => trigger!.click());
    expect(button("Orbit Forge")).toBeDefined();
    // The picker adds no free-text Custom option of its own.
    expect(document.body.textContent).not.toContain("Custom AI");
    expect(document.body.textContent).not.toContain("Custom Model");

    await act(async () => button("Orbit Forge")!.click());
    expect(bots.update).toHaveBeenCalledWith({
      botId: "bot-1",
      modelProvider: "orbit",
      modelId: "orbit-forge",
      thinkingLevel: null,
    });
  });

  it("maps Deep to a high thinking level on a reasoning model", async () => {
    await render();
    await act(async () => button(/Orbit Flash/)!.click());
    await act(async () => button("Orbit Forge")!.click());
    await act(async () => button(/Orbit Forge/)!.click());
    await act(async () => button("Deep")!.click());
    expect(bots.update).toHaveBeenLastCalledWith({
      botId: "bot-1",
      modelProvider: "orbit",
      modelId: "orbit-forge",
      thinkingLevel: "high",
    });
  });
});
