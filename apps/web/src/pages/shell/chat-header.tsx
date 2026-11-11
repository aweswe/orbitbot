import type { Bot, Group, ThreadSnapshot } from "@forion/orbit-contracts";
import { AppMarkStack, BotAvatar, Button, GroupAvatar } from "@forion/orbit-ui-web";
import { Trans, useLingui } from "@lingui/react/macro";
import { Menu, PanelLeftOpen, Phone, Puzzle, Search, SlidersHorizontal } from "lucide-react";
import { IconTooltip } from "../../components/IconTooltip";
import { OrbitLogoMark } from "../../components/OrbitLogoMark";

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
  /** Connected/familiar app marks; the strip lives here, not in the sidebar footer. */
  appMarks?: ReadonlyArray<{ name: string; logo?: string | null }>;
  onOpenConnections?: () => void;
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
  appMarks = [],
  onOpenConnections,
}: ChatHeaderProps) {
  const { t } = useLingui();

  const title = inGroup
    ? (activeGroup?.name ?? activeSnapshot?.groupName ?? t`Group Chat`)
    : (active?.name ?? t`Orbit Assistant`);

  const isWorking = active?.status === "working";
  const hasError = Boolean(active?.status === "error");

  return (
    <header
      data-testid="orbit-command-bar"
      aria-label={t`Orbital Command Bar`}
      className="pointer-events-none absolute inset-x-0 top-0 z-[var(--z-sticky,10)] grid grid-cols-[1fr_auto_1fr] h-[var(--header-h,56px)] w-full shrink-0 items-center border-b border-border/40 bg-background/80 px-4 backdrop-blur-xl select-none [&_button]:pointer-events-auto [&_a]:pointer-events-auto"
    >
      {/* ─── Left: Navigator Toggle & Space Indicator ─── */}
      <div className="flex min-w-0 items-center gap-2 justify-self-start pointer-events-auto">
        {/* Mobile menu trigger */}
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={t`Open navigation`}
          onClick={onOpenNavigation}
          className="app-no-drag md:hidden h-8 w-8 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent"
        >
          <Menu strokeWidth={1.5} className="size-5" />
        </Button>

        {/* Desktop Expand Toggle when collapsed */}
        {!drawerOpen && onToggleDrawer ? (
          <IconTooltip label={t`Expand Sidebar (Cmd+B)`}>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={t`Expand Sidebar`}
              onClick={onToggleDrawer}
              className="app-no-drag hidden md:flex h-8 w-8 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent"
            >
              <PanelLeftOpen strokeWidth={1.5} className="size-4.5" />
            </Button>
          </IconTooltip>
        ) : null}

        {/* Space indicator (hidden on mobile and tablet <1024px to prevent collision) */}
        <div className="hidden lg:flex min-w-0 items-center gap-1.5 text-label text-muted-foreground/80 font-medium">
          <span className="truncate max-w-[140px]">{spaceName ?? t`Workspace`}</span>
        </div>
      </div>

      {/* ─── Center: Active Companion Telemetry HUD (Single Bot Switcher / Status) ─── */}
      <div className="flex items-center justify-center justify-self-center min-w-0 max-w-[170px] sm:max-w-[280px] md:max-w-[340px] pointer-events-auto">
        <button
          type="button"
          data-testid="bot-settings-trigger"
          aria-expanded={panelOpen}
          onClick={onTogglePanel}
          title={t`Inspect ${title}`}
          className="group app-no-drag flex items-center gap-2.5 h-9 max-h-10 rounded-full border border-border/70 bg-card/70 px-3 text-start backdrop-blur-md shadow-xs transition-all duration-200 hover:border-primary/40 hover:bg-card active:scale-[0.98] min-w-0"
        >
          {/* Avatar with deterministic clean status ring */}
          <div className="relative size-5.5 shrink-0 flex items-center justify-center">
            {inGroup ? (
              <GroupAvatar
                members={activeSnapshot?.members ?? activeGroup?.members ?? []}
                size={22}
              />
            ) : active ? (
              <BotAvatar
                avatarSet={active.avatarSet}
                color={active.color}
                identity={active.id}
                size={22}
                status={active.status}
              />
            ) : (
              <OrbitLogoMark className="size-4 text-foreground/80" />
            )}

            {/* Status dot badge: bottom-right with 2px ring in surface color, never overlapping glyph */}
            <span
              className={`absolute -bottom-0.5 -right-0.5 size-2 rounded-full ring-2 ring-card ${
                hasError
                  ? "bg-rose-500"
                  : isWorking
                    ? "bg-amber-400 animate-pulse"
                    : "bg-emerald-500"
              }`}
            />
          </div>

          <div className="flex flex-col min-w-0 overflow-hidden">
            <span
              className="block truncate text-label font-semibold leading-tight text-foreground tracking-tight"
              dir="auto"
            >
              {title}
            </span>
            <span className="hidden sm:block truncate text-caption leading-tight text-muted-foreground font-mono">
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

      {/* ─── Right: Header Actions (Max 3: Search, Voice, Inspector) ─── */}
      <div className="flex items-center gap-1 justify-self-end pointer-events-auto">
        {/* Connected apps: the marks live here now, in reach of the conversation */}
        {onOpenConnections ? (
          <IconTooltip label={t`Connected apps`}>
            <Button
              variant="ghost"
              aria-label={t`Connected apps`}
              onClick={onOpenConnections}
              className="app-no-drag h-8 rounded-lg gap-1 px-2 text-muted-foreground hover:text-foreground hover:bg-accent"
            >
              {appMarks.length ? (
                <AppMarkStack
                  marks={appMarks.slice(0, 3)}
                  size={18}
                  ringClassName="ring-background"
                />
              ) : (
                <Puzzle strokeWidth={1.5} className="size-4" />
              )}
            </Button>
          </IconTooltip>
        ) : null}

        {/* Find in thread */}
        {onOpenFind ? (
          <IconTooltip label={t`Find in thread (Cmd+F)`}>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={t`Find in thread`}
              onClick={onOpenFind}
              className="app-no-drag h-8 w-8 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent"
            >
              <Search strokeWidth={1.5} className="size-4" />
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
              className={`app-no-drag h-8 w-8 rounded-lg transition-all ${
                inCall
                  ? "bg-rose-600 text-white shadow-sm"
                  : "text-muted-foreground hover:text-foreground hover:bg-accent"
              }`}
            >
              <Phone strokeWidth={1.5} className="size-4" />
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
            className={`app-no-drag h-8 w-8 rounded-lg transition-colors ${
              panelOpen
                ? "bg-primary/10 text-primary border border-primary/25"
                : "text-muted-foreground hover:text-foreground hover:bg-accent"
            }`}
          >
            <SlidersHorizontal strokeWidth={1.5} className="size-4" />
          </Button>
        </IconTooltip>
      </div>
    </header>
  );
}
