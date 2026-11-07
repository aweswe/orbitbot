// @vitest-environment jsdom

import type { BillingStatus, Bot } from "@rakazo/contracts";
import { BOT_COLORS } from "@rakazo/contracts";
import type * as UiWeb from "@rakazo/ui-web";
import type { ComponentProps, ReactNode } from "react";
import { act } from "react";
import type { Root } from "react-dom/client";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

const billing = vi.hoisted(() => ({ status: null as Partial<BillingStatus> | null }));

vi.mock("@lingui/react/macro", () => ({
  useLingui: () => ({
    t: (strings: TemplateStringsArray, ...values: unknown[]) =>
      strings.reduce((text, part, index) => text + part + (values[index] ?? ""), ""),
  }),
  Trans: ({ children }: { children: ReactNode }) => children,
  Plural: ({ value, one, other }: { value: number; one: string; other: string }) =>
    (value === 1 ? one : other).replace("#", String(value)),
}));
vi.mock("@rakazo/ui-web", async (importOriginal) => {
  const { useCopyText } = await importOriginal<typeof UiWeb>();
  const Plain = ({ children }: { children?: ReactNode }) => <>{children}</>;
  return {
    useCopyText,
    AppMarkStack: () => null,
    BotAvatar: () => null,
    Input: (props: Record<string, unknown>) => <input {...props} />,
    GroupAvatar: () => null,
    Button: ({
      variant: _v,
      size: _s,
      ...props
    }: ComponentProps<"button"> & Record<string, unknown>) => <button type="button" {...props} />,
    Dialog: ({ open, children }: { open: boolean; children?: ReactNode }) =>
      open ? <div role="dialog">{children}</div> : null,
    DialogContent: Plain,
    DialogHeader: Plain,
    DialogTitle: Plain,
  };
});
vi.mock("../../components/IconTooltip", () => ({
  IconTooltip: ({ children }: { children: ReactNode }) => children,
}));
vi.mock("../../components/SubscriptionGate", () => ({
  useBilling: () => ({ status: billing.status, showPlans: () => undefined }),
}));

import { ChatHeader } from "./chat-header";

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  billing.status = null;
});

function renderHeader({
  inGroup = false,
  onOpenConnections,
}: { inGroup?: boolean; onOpenConnections?: () => void } = {}) {
  act(() =>
    root.render(
      <ChatHeader
        inGroup={inGroup}
        active={
          inGroup ? undefined : ({ id: "bot-1", name: "Helper", color: BOT_COLORS[0] } as Bot)
        }
        activeGroup={undefined}
        activeSnapshot={null}
        phoneCallsEnabled={false}
        voiceReady={false}
        inCall={false}
        panelOpen={false}
        onOpenNavigation={() => undefined}
        onTogglePanel={() => undefined}
        onCall={() => undefined}
        onOpenConnections={onOpenConnections}
      />,
    ),
  );
}


it("opens connected apps from the header", () => {
  const onOpenConnections = vi.fn();
  renderHeader({ onOpenConnections });
  const apps = container.querySelector<HTMLButtonElement>('[aria-label="Connected apps"]')!;
  act(() => apps.click());
  expect(onOpenConnections).toHaveBeenCalledOnce();
});
