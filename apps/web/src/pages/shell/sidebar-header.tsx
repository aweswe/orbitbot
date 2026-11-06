import { useLingui } from "@lingui/react/macro";
import type { Bot } from "@rakazo/contracts";
import { Button, Popover, PopoverContent, PopoverTrigger } from "@rakazo/ui-web";
import { PanelLeftClose, PanelLeftOpen, Plus } from "lucide-react";
import { IconTooltip } from "../../components/IconTooltip";
import { OrbitLogoMark } from "../../components/OrbitLogoMark";
import { desktopBridge } from "../../lib/desktop";
import type { Panel } from "../../lib/right-panel-state";
import type { SettingsSection } from "../shell-overlay";
import { WindowChrome } from "../WindowChrome";
import { BotCreatePicker } from "./bot-picker";

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

      {/* ── Expanded: Brand Logo Mark ONLY (Clean, uncrowded) ── */}
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

          {/* Collapser Toggle */}
          <IconTooltip label={toggleLabel}>
            <Button
              variant="ghost"
              size="icon-sm"
              className="app-no-drag shrink-0 text-muted-foreground hover:text-foreground"
              aria-label={toggleLabel}
              data-testid="minimize-bots-sidebar"
              onClick={() => setBotsSidebarCollapsedPref(true)}
            >
              <PanelLeftClose size={16} strokeWidth={1.8} aria-hidden="true" />
            </Button>
          </IconTooltip>
        </>
      ) : (
        /* ── Compacted / Mini Mode: Restore Collapser + Add Bot Option ── */
        <div className="flex flex-col items-center gap-1.5 w-full">
          <IconTooltip label={toggleLabel}>
            <Button
              variant="ghost"
              size="icon-sm"
              className="app-no-drag text-muted-foreground hover:text-foreground"
              aria-label={toggleLabel}
              data-testid="restore-bots-sidebar"
              onClick={() => setBotsSidebarCollapsedPref(false)}
            >
              <PanelLeftOpen size={16} strokeWidth={1.8} aria-hidden="true" />
            </Button>
          </IconTooltip>

          {setCreateMenuOpen ? (
            <Popover open={createMenuOpen} onOpenChange={setCreateMenuOpen}>
              <IconTooltip label={t`New Bot or Group`}>
                <PopoverTrigger
                  render={
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      className="app-no-drag text-muted-foreground hover:text-foreground rounded-xl hover:bg-primary/10 hover:text-primary transition-colors"
                    />
                  }
                  aria-label={t`Create`}
                  data-testid="create-menu-trigger"
                >
                  <Plus size={16} strokeWidth={1.8} aria-hidden="true" />
                </PopoverTrigger>
              </IconTooltip>
              {createMenuOpen ? (
                <PopoverContent
                  align="start"
                  side="right"
                  sideOffset={10}
                  className="app-no-drag w-auto gap-0 overflow-hidden p-0 data-closed:animate-none z-[100] shadow-2xl rounded-2xl border border-border"
                >
                  <BotCreatePicker
                    bots={bots}
                    onCreateBot={() => {
                      setCreateMenuOpen?.(false);
                      setMobileSidebarOpen?.(false);
                      setCreateBotOpen?.(true);
                    }}
                    onOpenBot={(id) => {
                      setCreateMenuOpen?.(false);
                      setMobileSidebarOpen?.(false);
                      navigate?.(`/app/${id}`);
                    }}
                    onCreateGroup={() => {
                      setCreateMenuOpen?.(false);
                      setMobileSidebarOpen?.(false);
                      setPanel?.("create-group");
                    }}
                    onCreateSpace={() => {
                      setCreateMenuOpen?.(false);
                      setMobileSidebarOpen?.(false);
                      setNewSpaceOpen?.(true);
                    }}
                  />
                </PopoverContent>
              ) : null}
            </Popover>
          ) : (
            <IconTooltip label={t`New Bot`}>
              <Button
                variant="ghost"
                size="icon-sm"
                className="app-no-drag text-muted-foreground hover:text-foreground rounded-xl hover:bg-primary/10 hover:text-primary transition-colors"
                aria-label={t`New Bot`}
                onClick={() => {
                  setMobileSidebarOpen?.(false);
                  setCreateBotOpen?.(true);
                }}
              >
                <Plus size={16} strokeWidth={1.8} aria-hidden="true" />
              </Button>
            </IconTooltip>
          )}
        </div>
      )}
    </div>
  );
}
