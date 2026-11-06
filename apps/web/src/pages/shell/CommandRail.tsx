import { Trans, useLingui } from "@lingui/react/macro";
import type { NavLink } from "@rakazo/contracts";
import { accountDisplay } from "@rakazo/core";
import { Popover, PopoverContent, PopoverTrigger } from "@rakazo/ui-web";
import {
  Bot,
  Laptop,
  MessageSquare,
  Palette,
  SlidersHorizontal,
  Sparkles,
  UserRound,
  Zap,
} from "lucide-react";
import { useState } from "react";
import { IconTooltip } from "../../components/IconTooltip";
import { OrbitLogoMark } from "../../components/OrbitLogoMark";
import { OrbitThemeSwitcher } from "../../components/OrbitThemeSwitcher";
import { SidebarFooter } from "../../components/SidebarFooter";
import { useBilling } from "../../components/SubscriptionGate";
import type { Organization } from "../../lib/organizations";
import { switchOrganization, useOrganizations } from "../../lib/organizations";
import { useQueryUserId } from "../../lib/query";
import { useSignOut } from "../../lib/sign-out";
import type { SettingsSection } from "../shell-overlay";

export type CommandRailMode = "chats" | "agents" | "deck" | "skills";

export interface CommandRailProps {
  activeMode: CommandRailMode;
  onSelectMode: (mode: CommandRailMode) => void;
  drawerOpen: boolean;
  onToggleDrawer: () => void;
  openSettings: (section: SettingsSection) => void;
  openIntegrations: () => void;
  openSkills: () => void;
  onOpenComputer: () => void;
  unreadCount?: number;
  computerActive?: boolean;
  user?: { name?: string | null; email?: string; image?: string | null };
  footerLogos?: Array<{ name: string; logo?: string | null }>;
  ticketBoardEnabled?: boolean;
  navLinks?: NavLink[];
  navigate?: (path: string) => void;
  openSpaceChat?: (spaceId: string, path: string) => void;
  setCreateBotOpen?: (open: boolean) => void;
}

export function CommandRail({
  activeMode,
  onSelectMode,
  drawerOpen,
  onToggleDrawer,
  openSettings,
  openIntegrations,
  openSkills,
  onOpenComputer,
  unreadCount = 0,
  computerActive = false,
  user,
  footerLogos = [],
  ticketBoardEnabled = false,
  navLinks = [],
  navigate = () => {},
  openSpaceChat = () => {},
  setCreateBotOpen,
}: CommandRailProps) {
  const { t } = useLingui();
  const userId = useQueryUserId();
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const [logOutError, setLogOutError] = useState<string | null>(null);
  const { signingOut, logOut } = useSignOut("/sign-in", (message) => {
    setAccountMenuOpen(true);
    setLogOutError(message);
  });
  const { organizations, activeOrganizationId } = useOrganizations();
  const { label: userName, initial: initials } = accountDisplay(user ?? {}, t`You`);

  const navItems = [
    {
      mode: "chats" as const,
      label: t`Chats & Spaces`,
      icon: MessageSquare,
      badge: unreadCount > 0 ? unreadCount : undefined,
    },
    {
      mode: "agents" as const,
      label: t`Orbit Agent Studio`,
      icon: Bot,
    },
    {
      mode: "deck" as const,
      label: t`Computer Deck & Sandbox`,
      icon: Laptop,
      dot: computerActive,
    },
    {
      mode: "skills" as const,
      label: t`Skills & Automation`,
      icon: Zap,
    },
  ];

  return (
    <aside
      data-testid="orbit-command-rail"
      aria-label={t`Orbit Command Rail`}
      className="hidden md:flex h-full w-[56px] shrink-0 flex-col items-center justify-between border-e border-sidebar-border bg-sidebar/95 py-3 backdrop-blur-md select-none z-30 transition-colors"
    >
      {/* ─── Top: Brand Mark & Main Destinations ─── */}
      <div className="flex flex-col items-center gap-4 w-full">
        {/* Glowing Orbit Celestial Mark */}
        <IconTooltip label={drawerOpen ? t`Collapse Navigator (Cmd+B)` : t`Expand Navigator (Cmd+B)`} side="right">
          <button
            type="button"
            onClick={onToggleDrawer}
            aria-label={t`Toggle Navigator`}
            className="group relative flex size-10 items-center justify-center rounded-2xl bg-white/[0.04] border border-white/10 hover:border-primary/50 transition-all duration-200 active:scale-95 hover:shadow-[0_0_15px_rgba(34,211,238,0.25)]"
          >
            <OrbitLogoMark className="size-6 transition-transform group-hover:scale-105" />
            <span
              className={`absolute -end-1 -top-1 size-2 rounded-full transition-opacity ${
                drawerOpen ? "bg-primary opacity-90 shadow-[0_0_6px_var(--primary)]" : "opacity-0"
              }`}
            />
          </button>
        </IconTooltip>

        <div className="w-6 h-px bg-border/40 my-0.5" />

        {/* Primary Destination Icons */}
        <nav className="flex flex-col items-center gap-1.5 w-full px-1">
          {navItems.map((item) => {
            const isActive = activeMode === item.mode;
            const Icon = item.icon;
            return (
              <IconTooltip key={item.mode} label={item.label} side="right">
                <button
                  type="button"
                  onClick={() => {
                    if (item.mode === "deck") {
                      onOpenComputer();
                      onSelectMode("deck");
                    } else if (item.mode === "skills") {
                      openSkills();
                      onSelectMode("skills");
                    } else {
                      onSelectMode(item.mode);
                      if (!drawerOpen) onToggleDrawer();
                    }
                  }}
                  aria-label={item.label}
                  aria-current={isActive ? "page" : undefined}
                  className={`group relative flex size-10 items-center justify-center rounded-xl transition-all duration-150 active:scale-95 ${
                    isActive
                      ? "bg-primary/15 text-primary border border-primary/30 shadow-[0_0_12px_rgba(34,211,238,0.15)]"
                      : "text-muted-foreground hover:bg-white/[0.06] hover:text-foreground hover:border hover:border-white/10"
                  }`}
                >
                  {/* Left edge active indicator */}
                  {isActive ? (
                    <span className="absolute -left-1 top-2 bottom-2 w-1 rounded-r-full bg-primary shadow-[0_0_8px_var(--primary)]" />
                  ) : null}

                  <Icon size={19} strokeWidth={1.75} className="shrink-0 transition-transform group-hover:scale-105" />

                  {/* Badge or Dot */}
                  {item.badge ? (
                    <span className="absolute top-1 end-1 flex size-4 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground ring-2 ring-sidebar">
                      {item.badge > 9 ? "9+" : item.badge}
                    </span>
                  ) : item.dot ? (
                    <span className="absolute top-1.5 end-1.5 size-2 rounded-full bg-emerald-400 ring-2 ring-sidebar animate-pulse" />
                  ) : null}
                </button>
              </IconTooltip>
            );
          })}
        </nav>
      </div>

      {/* ─── Bottom: Theme Selector, Settings & User Profile ─── */}
      <div className="flex flex-col items-center gap-2 w-full px-1">
        {/* Quick Cosmic Theme Switcher */}
        <OrbitThemeSwitcher />

        {/* Global Settings */}
        <IconTooltip label={t`Preferences & Models`} side="right">
          <button
            type="button"
            onClick={() => openSettings("general")}
            aria-label={t`Preferences & Models`}
            className="flex size-10 items-center justify-center rounded-xl text-muted-foreground hover:bg-white/[0.06] hover:text-foreground hover:border hover:border-white/10 transition-all duration-150 active:scale-95"
          >
            <SlidersHorizontal size={18} strokeWidth={1.75} />
          </button>
        </IconTooltip>

        <div className="w-6 h-px bg-border/40 my-0.5" />

        {/* User Account Halo Avatar */}
        <Popover open={accountMenuOpen} onOpenChange={setAccountMenuOpen}>
          <IconTooltip label={t`Account (${userName})`} side="right">
            <PopoverTrigger
              data-testid="rail-user-trigger"
              aria-label={t`Account menu for ${userName}`}
              className="group relative flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-full border border-border bg-sidebar-accent text-body-sm font-semibold text-foreground outline-none transition-all hover:border-primary/50 hover:ring-2 hover:ring-primary/20 focus-visible:ring-2 focus-visible:ring-ring"
            >
              {user?.image ? (
                <img src={user.image} alt="" className="size-full object-cover" />
              ) : initials ? (
                initials
              ) : (
                <UserRound size={17} strokeWidth={1.8} aria-hidden="true" />
              )}
            </PopoverTrigger>
          </IconTooltip>

          {accountMenuOpen ? (
            <PopoverContent
              side="right"
              sideOffset={12}
              align="end"
              className="w-64 p-0 shadow-2xl border border-border/80 bg-popover/95 backdrop-blur-xl"
            >
              <SidebarFooter
                mini={false}
                name={userName}
                initials={initials}
                image={user?.image}
                email={user?.email}
                open={accountMenuOpen}
                onOpenChange={setAccountMenuOpen}
                onIntegrations={() => {
                  setAccountMenuOpen(false);
                  openIntegrations();
                }}
                onSkills={() => {
                  setAccountMenuOpen(false);
                  openSkills();
                }}
                onBoard={
                  ticketBoardEnabled
                    ? () => {
                        setAccountMenuOpen(false);
                        navigate("/app/board");
                      }
                    : undefined
                }
                links={navLinks}
                onLink={(link) => {
                  setAccountMenuOpen(false);
                  navigate(`/app/x/${link.id}`);
                }}
                onArtifacts={() => {
                  setAccountMenuOpen(false);
                  openSettings("general");
                }}
                onSettings={() => {
                  setAccountMenuOpen(false);
                  openSettings("general");
                }}
                onLogOut={logOut}
                signingOut={signingOut}
                logOutError={logOutError}
                organizations={organizations}
                activeOrganizationId={activeOrganizationId}
                onSwitchOrganization={(org) => void switchOrganization(userId, org, openSpaceChat)}
              />
            </PopoverContent>
          ) : null}
        </Popover>
      </div>
    </aside>
  );
}
