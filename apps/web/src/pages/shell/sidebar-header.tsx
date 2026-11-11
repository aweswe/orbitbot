import type { Bot } from "@forion/orbit-contracts";
import { Button } from "@forion/orbit-ui-web";
import { Trans, useLingui } from "@lingui/react/macro";
import { PanelLeftClose, PanelLeftOpen, Plus, Search } from "lucide-react";
import { IconTooltip } from "../../components/IconTooltip";
import { OrbitLogoMark } from "../../components/OrbitLogoMark";
import { OrbitThemeSwitcher } from "../../components/OrbitThemeSwitcher";
import { desktopBridge } from "../../lib/desktop";
import type { Panel } from "../../lib/right-panel-state";
import type { SettingsSection } from "../shell-overlay";
import { WindowChrome } from "../WindowChrome";

export function SidebarHeader({
  mini = false,
  isMobile = false,
  createMenuOpen = false,
  setCreateMenuOpen,
  activityMode,
  toggleActivityMode,
  searchOpen = false,
  onSearch,
  setBotsSidebarCollapsedPref,
  bots = [],
  setMobileSidebarOpen,
  setPanel,
  navigate,
  setNewSpaceOpen,
  setCreateBotOpen,
  openSettings,
}: {
  mini?: boolean;
  isMobile?: boolean;
  createMenuOpen?: boolean;
  setCreateMenuOpen?: (open: boolean) => void;
  activityMode?: boolean;
  toggleActivityMode?: () => void;
  searchOpen?: boolean;
  onSearch?: () => void;
  setBotsSidebarCollapsedPref: (collapsed: boolean) => void;
  bots?: Bot[];
  setMobileSidebarOpen?: (open: boolean) => void;
  setPanel?: (panel: Panel) => void;
  navigate?: (path: string) => void;
  setNewSpaceOpen?: (open: boolean) => void;
  setCreateBotOpen?: (open: boolean) => void;
  openSettings?: (section: SettingsSection) => void;
}) {
  const { t } = useLingui();
  const hasWindowChrome = Boolean(desktopBridge());
  const toggleLabel = mini ? t`Show bots` : t`Minimize bots`;

  return (
    <div
      className={`app-drag flex items-center h-[var(--header-h,56px)] border-b border-border/40 ${
        mini ? "justify-center px-2" : "justify-between px-4"
      }`}
    >
      <WindowChrome />

      {/* ── Expanded: Brand Lockup + Theme Switcher + Collapser ── */}
      {!mini ? (
        <>
          <div className="flex min-w-0 items-center gap-2.5 select-none">
            <div className="h-8 w-8 shrink-0 rounded-lg bg-card border border-border flex items-center justify-center overflow-hidden shadow-xs hover:border-foreground/20 transition-colors">
              <OrbitLogoMark className="h-4.5 w-4.5 text-foreground" />
            </div>
            <div className="flex items-center leading-none">
              <img
                src="/assets/imgs/logo/orbit-wordmark.svg"
                alt="Orbit"
                className="h-4 w-auto"
              />
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            {onSearch ? (
              <IconTooltip label={searchOpen ? t`Close search` : t`Search`}>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className="app-no-drag shrink-0 text-muted-foreground hover:text-foreground h-8 w-8 rounded-lg"
                  aria-label={t`Search`}
                  aria-pressed={searchOpen ? "true" : "false"}
                  data-testid="sidebar-search-trigger"
                  onClick={onSearch}
                >
                  <Search size={16} strokeWidth={1.5} aria-hidden="true" />
                </Button>
              </IconTooltip>
            ) : null}
            <OrbitThemeSwitcher />
            {/* Collapser Toggle */}
            <IconTooltip label={toggleLabel}>
              <Button
                variant="ghost"
                size="icon-sm"
                className="app-no-drag shrink-0 text-muted-foreground hover:text-foreground h-8 w-8 rounded-lg"
                aria-label={toggleLabel}
                data-testid="minimize-bots-sidebar"
                onClick={() => {
                  if (isMobile && setMobileSidebarOpen) {
                    setMobileSidebarOpen(false);
                  } else {
                    setBotsSidebarCollapsedPref(true);
                  }
                }}
              >
                <PanelLeftClose size={16} strokeWidth={1.5} aria-hidden="true" />
              </Button>
            </IconTooltip>
          </div>
        </>
      ) : (
        /* ── Compacted / Mini Mode: 64px rail header (Expand Toggle) ── */
        <div className="flex items-center justify-center w-full">
          <IconTooltip label={toggleLabel} side="right">
            <Button
              variant="ghost"
              size="icon-sm"
              className="app-no-drag text-muted-foreground hover:text-foreground h-8 w-8 rounded-lg"
              aria-label={toggleLabel}
              data-testid="restore-bots-sidebar"
              onClick={() => setBotsSidebarCollapsedPref(false)}
            >
              <PanelLeftOpen size={16} strokeWidth={1.5} aria-hidden="true" />
            </Button>
          </IconTooltip>
        </div>
      )}
    </div>
  );
}
