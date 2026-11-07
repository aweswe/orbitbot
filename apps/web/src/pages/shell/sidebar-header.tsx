import { Trans, useLingui } from "@lingui/react/macro";
import type { Bot } from "@rakazo/contracts";
import { Button } from "@rakazo/ui-web";
import { PanelLeftClose, PanelLeftOpen, Plus } from "lucide-react";
import { IconTooltip } from "../../components/IconTooltip";
import { OrbitLogoMark } from "../../components/OrbitLogoMark";
import { OrbitThemeSwitcher } from "../../components/OrbitThemeSwitcher";
import { desktopBridge } from "../../lib/desktop";
import type { Panel } from "../../lib/right-panel-state";
import type { SettingsSection } from "../shell-overlay";
import { WindowChrome } from "../WindowChrome";

export function SidebarHeader({
  mini = false,
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
      className={`app-drag flex items-center border-b border-sidebar-border/50 ${
        mini
          ? `flex-col gap-2 px-0 pb-2.5 ${hasWindowChrome ? "pt-4" : "pt-2.5"}`
          : "justify-between gap-2 px-3.5 pb-2.5 pt-3"
      }`}
    >
      <WindowChrome />

      {/* ── Expanded: Brand Lockup + Theme Switcher + Collapser ── */}
      {!mini ? (
        <>
          <div className="flex min-w-0 items-center gap-2.5 select-none">
            <div className="h-8 w-8 shrink-0 rounded-xl bg-white/[0.04] border border-white/10 flex items-center justify-center overflow-hidden shadow-sm hover:border-foreground/20 transition-colors">
              <OrbitLogoMark className="h-5 w-5" />
            </div>
            <div className="flex items-center gap-1.5 leading-none">
              <span className="orbit-brand-text animate-gradient-x text-[14.5px] font-bold tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-[var(--accent-primary,#22d3ee)] via-[var(--orbit-grad-via,#e879f9)] to-[var(--orbit-grad-to,#fb923c)]">
                ORBIT
              </span>
              <span className="text-[7.5px] font-bold tracking-wider uppercase text-[var(--accent-primary,#22d3ee)] px-1.5 py-0.5 rounded-full bg-[var(--accent-primary,#22d3ee)]/10 border border-[var(--accent-primary,#22d3ee)]/25 leading-none">
                Bot
              </span>
            </div>
          </div>

          <div className="flex items-center gap-1">
            <OrbitThemeSwitcher />
            {/* Collapser Toggle */}
            <IconTooltip label={toggleLabel}>
              <Button
                variant="ghost"
                size="icon-sm"
                className="app-no-drag shrink-0 text-muted-foreground hover:text-foreground h-8 w-8 rounded-xl"
                aria-label={toggleLabel}
                data-testid="minimize-bots-sidebar"
                onClick={() => setBotsSidebarCollapsedPref(true)}
              >
                <PanelLeftClose size={16} strokeWidth={1.8} aria-hidden="true" />
              </Button>
            </IconTooltip>
          </div>
        </>
      ) : (
        /* ── Compacted / Mini Mode: Logo + Restore Collapser + Add Bot Option + Theme Switcher ── */
        <div className="flex flex-col items-center gap-2 w-full px-1">
          {/* Mini Orbit Logo Mark */}
          <div className="h-8 w-8 shrink-0 rounded-xl bg-white/[0.04] border border-white/10 flex items-center justify-center overflow-hidden shadow-sm hover:border-foreground/20 transition-colors">
            <OrbitLogoMark className="h-5 w-5" />
          </div>

          {/* Collapser Restore Toggle */}
          <IconTooltip label={toggleLabel} side="right">
            <Button
              variant="ghost"
              size="icon-sm"
              className="app-no-drag text-muted-foreground hover:text-foreground h-8 w-8 rounded-xl"
              aria-label={toggleLabel}
              data-testid="restore-bots-sidebar"
              onClick={() => setBotsSidebarCollapsedPref(false)}
            >
              <PanelLeftOpen size={16} strokeWidth={1.8} aria-hidden="true" />
            </Button>
          </IconTooltip>

          {/* Compact New Bot Action */}
          <IconTooltip label={t`New Bot`} side="right">
            <button
              type="button"
              onClick={() => {
                setMobileSidebarOpen?.(false);
                setCreateBotOpen?.(true);
              }}
              aria-label={t`New Bot`}
              className="flex size-9 items-center justify-center rounded-xl bg-primary/15 text-primary border border-primary/30 hover:bg-primary/25 transition-all"
            >
              <Plus size={16} strokeWidth={2} />
            </button>
          </IconTooltip>

          {/* Quick Cosmic Theme Switcher in Mini Mode */}
          <OrbitThemeSwitcher />
        </div>
      )}
    </div>
  );
}
