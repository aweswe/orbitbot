/**
 * Every AI entry point must be classified. `metered-gateway` means the Forion
 * gateway locks and settles it; `included` is covered by the plan and emits no
 * per-call credit event; `disabled-cloud` is rejected by the cloud-only gate.
 * A new path without one of these tags must fail the inventory test.
 */
export type BillingPathTag = "metered-gateway" | "included" | "disabled-cloud";

export interface BillingPath {
  id: string;
  description: string;
  tag: BillingPathTag;
}

export const BILLING_PATHS: readonly BillingPath[] = [
  { id: "chat.main", description: "Main Orbit Bot chat completion", tag: "metered-gateway" },
  { id: "chat.stream", description: "Main Orbit Bot streaming chat", tag: "metered-gateway" },
  {
    id: "team-chat-judge",
    description: "Group engagement judge via the hosted provider",
    tag: "metered-gateway",
  },
  {
    id: "decision.openrouter",
    description: "OpenRouter decision models",
    tag: "disabled-cloud",
  },
  {
    id: "decision.typesafe",
    description: "TypeSafe decision models",
    tag: "disabled-cloud",
  },
  {
    id: "cloud-agent.cursor",
    description: "Direct Cursor cloud agents",
    tag: "disabled-cloud",
  },
  {
    id: "model.direct-provider",
    description: "Non-Forion direct model providers",
    tag: "disabled-cloud",
  },
  { id: "media.image", description: "Image generation", tag: "disabled-cloud" },
  { id: "media.video", description: "Video generation", tag: "disabled-cloud" },
  { id: "voice.tts", description: "Text to speech", tag: "disabled-cloud" },
  { id: "voice.stt", description: "Speech to text", tag: "disabled-cloud" },
  {
    id: "memory.forion",
    description: "Forion semantic memory recall/save",
    tag: "included",
  },
  {
    id: "memory.third-party",
    description: "Supermemory/Honcho/Serenity providers",
    tag: "disabled-cloud",
  },
  { id: "memory.embeddings", description: "Forion memory embeddings", tag: "included" },
  { id: "sandbox.tools", description: "Computer/browser tool execution", tag: "included" },
];

export function billingPathTagFor(id: string): BillingPathTag | undefined {
  return BILLING_PATHS.find((path) => path.id === id)?.tag;
}

export function untaggedBillingPaths(
  paths: readonly BillingPath[] = BILLING_PATHS,
): string[] {
  const valid: BillingPathTag[] = ["metered-gateway", "included", "disabled-cloud"];
  return paths
    .filter((path) => !valid.includes(path.tag))
    .map((path) => path.id);
}
