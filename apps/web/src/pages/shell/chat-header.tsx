import { Trans, useLingui } from "@lingui/react/macro";
import type { Bot, Group, ThreadSnapshot } from "@rakazo/contracts";
import { BotAvatar, Button, GroupAvatar } from "@rakazo/ui-web";
import {
  ChevronRight,
  Gift,
  Laptop,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  Phone,
  Search,
  SlidersHorizontal,
  Sparkles,
} from "lucide-react";
import { useState } from "react";
import { IconTooltip } from "../../components/IconTooltip";
import { InviteDialog } from "../../components/InviteDialog";
import { useBilling } from "../../components/SubscriptionGate";

export interface ChatHeaderProps {
  inGroup: boolean;
  active: Bot | undefined;
  activeGroup: Group | undefined;
  activeSnapshot: ThreadSnapshot | null;
  phoneCallsEnabled: boolean;
  voiceReady: boolean;
  inCall: boolean;
  panelOpen: boolean;
  onOpenNavigation: () => void;
  onTogglePanel: () => void;
  onCall: (bot: Bot) => void;
  drawerOpen?: boolean;
  onToggleDrawer?: () => void;
  spaceName?: string;
  onOpenFind?: () => void;
  onOpenComputer?: () => void;
  onOpenModels?: () => void;
}

/** Orbital Command Bar: breadcrumbs, companion telemetry HUD, voice, computer deck, and inspector. */
export function ChatHeader({
  inGroup,
  active,
  activeGroup,
  activeSnapshot,
  phoneCallsEnabled,
  voiceReady,
  inCall,
  panelOpen,
  onOpenNavigation,
  onTogglePanel,
  onCall,
  drawerOpen = true,
  onToggleDrawer,
  spaceName,
  onOpenFind,
  onOpenComputer,
  onOpenModels,
}: ChatHeaderProps) {
  const { t } = useLingui();
  const referral = useBilling().status?.referral;
  const [inviteOpen, setInviteOpen] = useState(false);

  const title = inGroup
    ? (activeGroup?.name ?? activeSnapshot?.groupName ?? t`Group Chat`)
    : (active?.name ?? t`Orbit Assistant`);

  const isWorking = active?.status === "working";
  const hasError = Boolean(active?.status === "error");

  return (
    <header
      data-testid="orbit-command-bar"
      aria-label={t`Orbital Command Bar`}
      className="relative z-20 flex h-14 w-full shrink-0 items-center justify-between border-b border-border/40 bg-background/80 px-3.5 backdrop-blur-xl select-none"
    >
      {/* ─── Left: Navigator Toggle & Context Breadcrumbs ─── */}
      <div className="flex min-w-0 items-center gap-2">
        {/* Mobile menu trigger */}
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={t`Open navigation`}
          onClick={onOpenNavigation}
          className="app-no-drag md:hidden rounded-xl text-muted-foreground hover:text-foreground"
        >
          <Menu strokeWidth={1.8} className="size-5" />
        </Button>

        {/* Desktop Drawer Toggle */}
        {onToggleDrawer ? (
          <IconTooltip label={drawerOpen ? t`Collapse Navigator (Cmd+B)` : t`Expand Navigator (Cmd+B)`}>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={drawerOpen ? t`Collapse Navigator` : t`Expand Navigator`}
              onClick={onToggleDrawer}
              className="app-no-drag hidden md:flex rounded-xl text-muted-foreground hover:text-foreground hover:bg-white/[0.05]"
            >
              {drawerOpen ? (
                <PanelLeftClose strokeWidth={1.8} className="size-4" />
              ) : (
                <PanelLeftOpen strokeWidth={1.8} className="size-4" />
              )}
            </Button>
          </IconTooltip>
        ) : null}

        {/* Breadcrumb hierarchy */}
        <nav aria-label={t`Breadcrumbs`} className="flex min-w-0 items-center gap-1.5 text-body-sm">
          <span className="truncate text-muted-foreground/80 hover:text-foreground transition-colors hidden sm:inline">
            {spaceName ?? t`Orbit Workspace`}
          </span>
          <ChevronRight size={13} className="shrink-0 text-muted-foreground/40 hidden sm:inline" />
          <span className="font-semibold text-foreground truncate">{title}</span>
        </nav>
      </div>

      {/* ─── Center: Active Companion Telemetry HUD ─── */}
      <div className="flex items-center justify-center">
        <button
          type="button"
          data-testid="bot-settings-trigger"
          aria-expanded={panelOpen}
          onClick={onTogglePanel}
          title={t`Inspect ${title}`}
          className="group app-no-drag flex items-center gap-2.5 rounded-full border border-border/70 bg-card/60 px-3 py-1 text-start backdrop-blur-md shadow-sm transition-all duration-200 hover:border-primary/50 hover:bg-card/90 active:scale-[0.98]"
        >
          {/* Avatar with live orbital status ring */}
          <div className="relative size-6 shrink-0 flex items-center justify-center">
            {inGroup ? (
              <GroupAvatar members={activeSnapshot?.members ?? activeGroup?.members ?? []} size={24} />
            ) : active ? (
              <BotAvatar
                avatarSet={active.avatarSet}
                color={active.color}
                identity={active.id}
                size={24}
                status={active.status}
              />
            ) : (
              <Sparkles className="size-4 text-primary" />
            )}
            {/* Telemetry pulse indicator */}
            <span
              className={`absolute -bottom-0.5 -right-0.5 size-2 rounded-full ring-2 ring-background ${
                hasError
                  ? "bg-rose-500 animate-pulse"
                  : isWorking
                    ? "bg-amber-400 animate-pulse shadow-[0_0_6px_#fbbf24]"
                    : "bg-emerald-400"
              }`}
            />
          </div>

          <div className="flex flex-col min-w-0">
            <span className="block truncate text-xs font-semibold leading-tight text-foreground tracking-tight" dir="auto">
              {title}
            </span>
            <span className="block text-[10px] leading-tight text-muted-foreground font-mono">
              {hasError
                ? t`Needs attention`
                : isWorking
                  ? t`Executing tools…`
                  : active?.modelId
                    ? active.modelId.replace(/^models\//, "")
                    : t`Ready`}
            </span>
          </div>
        </button>
      </div>

      {/* ─── Right: Quick Action Hub (Search, Call, Deck, Inspector) ─── */}
      <div className="flex items-center gap-1.5 justify-self-end">
        {/* Find in thread */}
        {onOpenFind ? (
          <IconTooltip label={t`Find in thread (Cmd+F)`}>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={t`Find in thread`}
              onClick={onOpenFind}
              className="app-no-drag rounded-xl text-muted-foreground hover:text-foreground hover:bg-white/[0.05]"
            >
              <Search strokeWidth={1.8} className="size-4" />
            </Button>
          </IconTooltip>
        ) : null}

        {/* Computer Deck toggle */}
        {onOpenComputer ? (
          <IconTooltip label={t`Computer Deck Sandbox`}>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={t`Computer Deck Sandbox`}
              onClick={onOpenComputer}
              className="app-no-drag rounded-xl text-muted-foreground hover:text-foreground hover:bg-white/[0.05]"
            >
              <Laptop strokeWidth={1.8} className="size-4" />
            </Button>
          </IconTooltip>
        ) : null}

        {/* Voice Call */}
        {phoneCallsEnabled && !inGroup && active ? (
          <IconTooltip label={inCall ? t`End call` : t`Voice Call`}>
            <Button
              variant={inCall ? "destructive" : "ghost"}
              size="icon-sm"
              data-testid="call-button"
              aria-label={inCall ? t`End call` : t`Voice Call`}
              onClick={() => onCall(active)}
              className={`app-no-drag rounded-xl transition-all ${
                inCall
                  ? "bg-rose-600 text-white shadow-[0_0_12px_rgba(244,63,94,0.4)]"
                  : "text-muted-foreground hover:text-foreground hover:bg-white/[0.05]"
              }`}
            >
              <Phone strokeWidth={1.8} className="size-4" />
            </Button>
          </IconTooltip>
        ) : null}

        {/* Bot Inspector / Settings */}
        <IconTooltip label={panelOpen ? t`Close Inspector` : t`Open Inspector`}>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={panelOpen ? t`Close Inspector` : t`Open Inspector`}
            onClick={onTogglePanel}
            aria-expanded={panelOpen}
            className={`app-no-drag rounded-xl transition-colors ${
              panelOpen
                ? "bg-primary/15 text-primary border border-primary/30"
                : "text-muted-foreground hover:text-foreground hover:bg-white/[0.05]"
            }`}
          >
            <SlidersHorizontal strokeWidth={1.8} className="size-4" />
          </Button>
        </IconTooltip>

        {/* Referral / Invite */}
        {referral && !inGroup && active ? (
          <IconTooltip label={t`Invite a teammate`}>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={t`Invite a teammate`}
              onClick={() => setInviteOpen(true)}
              className="app-no-drag rounded-xl text-muted-foreground hover:text-foreground hover:bg-white/[0.05]"
            >
              <Gift strokeWidth={1.8} className="size-4" />
            </Button>
          </IconTooltip>
        ) : null}
      </div>

      {referral ? (
        <InviteDialog referral={referral} open={inviteOpen} onOpenChange={setInviteOpen} />
      ) : null}
    </header>
  );
}
