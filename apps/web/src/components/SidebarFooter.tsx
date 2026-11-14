import type { NavLink } from "@forion/orbit-contracts";
import {
  Button,
  buttonVariants,
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@forion/orbit-ui-web";
import { Trans, useLingui } from "@lingui/react/macro";
import {
  BookOpen,
  Check,
  Download,
  FolderOpen,
  Link2,
  LogOut,
  Plug,
  ScrollText,
  Settings,
  Smartphone,
  SquareKanban,
  UserPlus,
  UserRound,
} from "lucide-react";
import { useState } from "react";
import type { Organization } from "../lib/organizations";
import { useSidebarUpdate } from "./DesktopUpdates";
import { IconTooltip } from "./IconTooltip";
import { OrbitCreditBadge } from "./OrbitCreditBadge";

type Props = {
  mini?: boolean;
  name: string;
  initials: string | null;
  image?: string | null;
  email?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onIntegrations: () => void;
  onSkills: () => void;
  onBoard?: () => void;
  links?: NavLink[];
  onLink?: (link: NavLink) => void;
  onArtifacts: () => void;
  onSettings: () => void;
  onInvite?: () => void;
  onLogOut: () => void;
  signingOut: boolean;
  logOutError: string | null;
  organizations?: Organization[];
  activeOrganizationId?: string | null;
  onSwitchOrganization?: (organization: Organization) => void;
};

// Marks are 24px wide, overlap by 2px, and need 2px for the outer ring.
export function sidebarMarkCount(availableWidth: number) {
  return Math.max(0, Math.min(3, Math.floor((availableWidth - 26) / 22) + 1));
}

export function SidebarFooter({
  mini = false,
  name,
  initials,
  image,
  email,
  open,
  onOpenChange,
  onIntegrations,
  onSkills,
  onBoard,
  links = [],
  onLink,
  onArtifacts,
  onSettings,
  onInvite,
  onLogOut,
  signingOut,
  logOutError,
  organizations = [],
  activeOrganizationId,
  onSwitchOrganization,
}: Props) {
  const { t } = useLingui();
  // The platform is a separate deployment; never ship a localhost link to users.
  const platformUrl = import.meta.env.VITE_ORION_PLATFORM_URL;
  const update = useSidebarUpdate();
  const [failedImage, setFailedImage] = useState<string | null>(null);
  return (
    <div
      data-testid="sidebar-footer"
      className={`flex shrink-0 items-center justify-between gap-2 bg-transparent ${mini ? "flex-col px-1 py-2" : "px-2.5 py-3"}`}
    >
      <div className={`flex items-center gap-2 min-w-0 ${mini ? "flex-col" : ""}`}>
        <Popover open={open} onOpenChange={onOpenChange}>
          <PopoverTrigger
            data-testid="user-menu-trigger"
            aria-label={t`Account menu for ${name}`}
            className="grid size-9 shrink-0 place-items-center overflow-hidden rounded-full border border-border bg-sidebar-accent text-body font-medium text-foreground outline-none hover:border-foreground/30 focus-visible:ring-2 focus-visible:ring-ring"
          >
            {image && failedImage !== image ? (
              <img
                src={image}
                alt=""
                className="size-full object-cover"
                onError={() => setFailedImage(image)}
              />
            ) : initials ? (
              initials
            ) : (
              <UserRound size={18} aria-hidden="true" />
            )}
          </PopoverTrigger>
          {open ? (
            <PopoverContent
              side="top"
              sideOffset={8}
              align="start"
              className="max-h-(--available-height) w-[295px] max-w-[calc(100vw-69px)] gap-0 overflow-y-auto p-1 *:shrink-0 data-closed:animate-none"
            >
              <div
                data-testid="account-menu-header"
                className="mb-1 min-w-0 border-b border-border px-2.5 py-2.5"
              >
                <p className="truncate text-body font-medium">{name}</p>
                {email && email !== name ? (
                  <p className="truncate text-label text-muted-foreground">{email}</p>
                ) : null}
              </div>
              {organizations.length > 1 ? (
                <>
                  {organizations.map((organization) => {
                    const active = organization.id === activeOrganizationId;
                    return (
                      <Button
                        key={organization.id}
                        variant="ghost"
                        aria-current={active ? "true" : undefined}
                        className="h-9 w-full justify-between gap-2.5 font-normal"
                        onClick={() => onSwitchOrganization?.(organization)}
                      >
                        <span className="min-w-0 truncate">{organization.name}</span>
                        {active ? <Check aria-hidden="true" strokeWidth={1.75} /> : null}
                      </Button>
                    );
                  })}
                  <div className="my-1 border-t border-border" />
                </>
              ) : null}
              {mini ? (
                <Button
                  variant="ghost"
                  className="h-9 w-full justify-start gap-2.5 font-normal"
                  onClick={onIntegrations}
                >
                  <Plug className="text-muted-foreground" strokeWidth={1.75} />
                  <Trans>Connect apps</Trans>
                </Button>
              ) : null}
              <Button
                variant="ghost"
                className="h-9 w-full justify-start gap-2.5 font-normal"
                aria-label={t`Settings`}
                onClick={onSettings}
              >
                <Settings className="text-muted-foreground" strokeWidth={1.75} />
                <Trans>Settings</Trans>
              </Button>
              <Button
                variant="ghost"
                className="h-9 w-full justify-start gap-2.5 font-normal"
                onClick={onSkills}
              >
                <ScrollText className="text-muted-foreground" strokeWidth={1.75} />
                <Trans>Skills</Trans>
              </Button>
              <Button
                variant="ghost"
                className="h-9 w-full justify-start gap-2.5 font-normal"
                onClick={onArtifacts}
              >
                <FolderOpen className="text-muted-foreground" strokeWidth={1.75} />
                <Trans>Artifacts</Trans>
              </Button>
              {onBoard ? (
                <Button
                  variant="ghost"
                  className="h-9 w-full justify-start gap-2.5 font-normal"
                  onClick={onBoard}
                >
                  <SquareKanban className="text-muted-foreground" strokeWidth={1.75} />
                  <Trans>Board</Trans>
                </Button>
              ) : null}
              {links.map((link) => (
                <Button
                  key={link.id}
                  variant="ghost"
                  className="h-9 w-full justify-start gap-2.5 font-normal"
                  onClick={() => onLink?.(link)}
                >
                  <Link2 className="text-muted-foreground" strokeWidth={1.75} />
                  {link.label}
                </Button>
              ))}
              <div className="my-1 border-t border-border" />
              <a
                className={`${buttonVariants({ variant: "ghost" })} h-9 w-full justify-start gap-2.5 font-normal text-cyan-400 hover:text-cyan-300`}
                href="/download/orbit-bot.apk"
                download="orbit-bot.apk"
              >
                <Smartphone className="text-cyan-400" strokeWidth={1.75} />
                <Trans>Download Orbit for Android</Trans>
              </a>
              {onInvite ? (
                <Button
                  variant="ghost"
                  className="h-9 w-full justify-start gap-2.5 font-normal"
                  onClick={onInvite}
                >
                  <UserPlus className="text-muted-foreground" strokeWidth={1.75} />
                  <Trans>Invite friends</Trans>
                </Button>
              ) : null}
              {platformUrl ? (
                <a
                  className={`${buttonVariants({ variant: "ghost" })} h-9 w-full justify-start gap-2.5 font-normal`}
                  href={platformUrl}
                  target="_blank"
                  rel="noreferrer"
                >
                  <BookOpen className="text-muted-foreground" strokeWidth={1.75} />
                  <Trans>Orbit Platform</Trans>
                </a>
              ) : null}
              <div className="my-1 border-t border-border" />
              <Button
                variant="ghost"
                className="h-9 w-full justify-start gap-2.5 font-normal"
                disabled={signingOut}
                onClick={onLogOut}
              >
                <LogOut className="text-muted-foreground" strokeWidth={1.75} />
                <Trans>Log out</Trans>
              </Button>
              {logOutError ? (
                <p role="alert" className="px-2.5 pt-1 pb-2 text-body-sm text-destructive">
                  {logOutError}
                </p>
              ) : null}
            </PopoverContent>
          ) : null}
        </Popover>
        {!mini ? (
          <IconTooltip label={t`Connect apps`}>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={t`Connect apps`}
              className="size-9 shrink-0 rounded-full text-muted-foreground hover:text-foreground"
              onClick={onIntegrations}
            >
              <Plug size={16} strokeWidth={1.75} aria-hidden="true" />
            </Button>
          </IconTooltip>
        ) : null}
        <OrbitCreditBadge onClick={onSettings} collapsed={mini} />
      </div>
      {update.available ? (
        <IconTooltip label={t`Install update`}>
          <Button
            size="icon-lg"
            className="rounded-full"
            aria-label={t`Install update`}
            disabled={update.busy}
            onClick={update.install}
          >
            <Download aria-hidden="true" />
          </Button>
        </IconTooltip>
      ) : null}
    </div>
  );
}
