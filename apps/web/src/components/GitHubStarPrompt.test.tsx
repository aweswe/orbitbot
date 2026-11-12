// @vitest-environment jsdom
import { Toaster } from "@forion/orbit-ui-web";
import type { ReactNode } from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import {
  recordMessageSent,
  resetStarPromptSessionForTests,
  STAR_PROMPT_DISMISSED_KEY,
  STAR_PROMPT_SENT_KEY,
} from "./GitHubStarPrompt";

vi.mock("@lingui/react/macro", () => ({
  useLingui: () => ({
    t: (strings: TemplateStringsArray, ...values: unknown[]) =>
      strings.reduce((text, part, index) => text + part + (values[index] ?? ""), ""),
  }),
  Trans: ({ children }: { children: ReactNode }) => children,
}));

let host: HTMLDivElement;
let root: ReturnType<typeof createRoot>;
beforeEach(async () => {
  localStorage.clear();
  resetStarPromptSessionForTests();
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  await act(async () => root.render(<Toaster />));
});
afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
});

const prompt = () => document.querySelector('[aria-label="Star on GitHub"]');

async function send(times: number) {
  for (let i = 0; i < times; i++) await act(async () => recordMessageSent());
}

it("stays disabled for the closed-source Orbit product", async () => {
  // GitHubStarPrompt is intentionally disabled for Orbit. The old prompt behavior
  // was inherited from the upstream open-source product and is no longer shipped.
  await send(6);
  expect(prompt()).toBeNull();
  expect(localStorage.getItem(STAR_PROMPT_SENT_KEY)).toBeNull();
  expect(localStorage.getItem(STAR_PROMPT_DISMISSED_KEY)).toBeNull();

  resetStarPromptSessionForTests();
  await send(3);
  expect(prompt()).toBeNull();
  expect(localStorage.getItem(STAR_PROMPT_SENT_KEY)).toBeNull();
});

it("asks at most once per session", async () => {
  await send(6);
  const count = localStorage.getItem(STAR_PROMPT_SENT_KEY);
  await send(2);
  expect(localStorage.getItem(STAR_PROMPT_SENT_KEY)).toBe(count);
});
