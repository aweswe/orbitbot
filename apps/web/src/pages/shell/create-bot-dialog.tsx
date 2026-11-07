import { Trans, useLingui } from "@lingui/react/macro";
import type { BotAvatarSet } from "@rakazo/contracts";
import { BOT_NAME_MAX_LENGTH } from "@rakazo/contracts";
import {
  newClientId,
  ORGANIC_AVATAR_HEART_FAMILY,
  ORGANIC_AVATAR_LOOKS,
  organicAvatarFamily,
  organicAvatarSampleIdentity,
} from "@rakazo/core";
import {
  BOT_AVATAR_COLORS,
  BotAvatar,
  Button,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  parseBotAvatar,
} from "@rakazo/ui-web";
import { Code2, Compass, Sparkles, Sun, Terminal } from "lucide-react";
import { useRef, useState } from "react";
import { errorText } from "../../lib/user-error";
import { BotLookPicker } from "./avatar-studio-popover";

/** One preview identity per organic look, so the dialog can show a body before the bot has an id. */
const ORGANIC_IDENTITIES = ORGANIC_AVATAR_LOOKS.map(organicAvatarSampleIdentity);

function pick<T>(options: readonly T[]): T {
  return options[Math.floor(Math.random() * options.length)]!;
}

export interface CreateBotDialogInput {
  name: string;
  color: string;
  /** Reserve the logo preview's persistent seed through creation and retries. */
  id?: string;
  /** The organic family the preview drew; omitted when a studio shape is picked. */
  avatarFamily?: number;
}

const ORBIT_BLUEPRINTS = [
  {
    id: "code-architect",
    name: "Code Architect",
    color: "orbit-planet::#22d3ee",
    tagline: "Architecture review, code generation, refactoring, and bug fixes",
    icon: Code2,
    accent: "text-cyan-400 bg-cyan-500/10 border-cyan-500/20",
  },
  {
    id: "deep-researcher",
    name: "Deep Researcher",
    color: "orbit-planet::#e879f9",
    tagline: "Web investigations, paper synthesis, and documentation deep dives",
    icon: Sparkles,
    accent: "text-fuchsia-400 bg-fuchsia-500/10 border-fuchsia-500/20",
  },
  {
    id: "morning-briefing",
    name: "Morning Briefing",
    color: "orbit-planet::#fb923c",
    tagline: "Daily digests, scheduled reports, task tracking, and alerts",
    icon: Sun,
    accent: "text-amber-400 bg-amber-500/10 border-amber-500/20",
  },
  {
    id: "system-admin",
    name: "System Admin",
    color: "orbit-planet::#00ff41",
    tagline: "Terminal commands, workspace filesystem, scripts, and server tools",
    icon: Terminal,
    accent: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
  },
];

/** Mounted only while open; the parent unmounts it from `onCancel` or after `onCreate`. */
export function CreateBotDialog({
  avatarSet,
  onCancel,
  onCreate,
}: {
  /** The account's set: the server gives it to the new bot, so the preview draws it too. */
  avatarSet: BotAvatarSet;
  onCancel: () => void;
  onCreate: (input: CreateBotDialogInput) => Promise<void>;
}) {
  const { t } = useLingui();
  const nameRef = useRef<HTMLInputElement>(null);
  const [tab, setTab] = useState<"custom" | "blueprints">("custom");
  const [name, setName] = useState("");
  const [previewId] = useState(() => {
    let id: string;
    do {
      id = `c${newClientId().replaceAll("-", "").slice(0, 24)}`;
    } while (organicAvatarFamily(id) === ORGANIC_AVATAR_HEART_FAMILY);
    return id;
  });
  const [look, setLook] = useState(() => ({
    value: "orbit-planet::#ff8a3d",
    identity: pick(ORGANIC_IDENTITIES),
  }));
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const trimmed = name.trim();

  async function create() {
    if (!trimmed || submitting) return;
    setError(null);
    setSubmitting(true);
    const organic = avatarSet === "organic" && parseBotAvatar(look.value).shapeIndex === undefined;
    try {
      await onCreate({
        name: trimmed,
        color: look.value,
        ...(avatarSet === "rakazo" ? { id: previewId } : {}),
        ...(organic ? { avatarFamily: organicAvatarFamily(look.identity) } : {}),
      });
    } catch (err) {
      setError(errorText(err, t`Could not create bot`));
      setSubmitting(false);
    }
  }

  function selectBlueprint(blueprint: (typeof ORBIT_BLUEPRINTS)[number]) {
    setName(blueprint.name);
    setLook((prev) => ({ ...prev, value: blueprint.color }));
    setTab("custom");
  }

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !submitting) onCancel();
      }}
    >
      <DialogContent
        showCloseButton={false}
        aria-describedby={undefined}
        initialFocus={nameRef}
        className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-md"
        data-testid="create-bot-dialog"
      >
        <form
          className="contents"
          onSubmit={(event) => {
            event.preventDefault();
            void create();
          }}
        >
          <DialogHeader>
            <DialogTitle className="text-center">
              <Trans>Orbit Agent Studio</Trans>
            </DialogTitle>
          </DialogHeader>

          {/* Tab Switcher */}
          <div className="flex items-center justify-center border-b border-border/50 pb-2.5">
            <div className="inline-flex rounded-xl bg-muted/40 p-0.5 border border-border">
              <button
                type="button"
                onClick={() => setTab("custom")}
                className={`px-3 py-1.5 rounded-lg text-caption font-semibold transition-all ${
                  tab === "custom"
                    ? "bg-card text-foreground shadow-xs border border-border/40"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Trans>Custom Agent</Trans>
              </button>
              <button
                type="button"
                onClick={() => setTab("blueprints")}
                className={`px-3 py-1.5 rounded-lg text-caption font-semibold transition-all ${
                  tab === "blueprints"
                    ? "bg-card text-foreground shadow-xs border border-border/40"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Trans>Orbit Blueprints</Trans>
              </button>
            </div>
          </div>

          {tab === "custom" ? (
            <>
              <div className="flex justify-center py-2">
                <BotAvatar
                  color={look.value}
                  identity={avatarSet === "rakazo" ? previewId : look.identity}
                  size={96}
                  avatarSet={avatarSet}
                />
              </div>
              <Input
                ref={nameRef}
                aria-label={t`Name`}
                placeholder={t`Name your Orion`}
                value={name}
                maxLength={BOT_NAME_MAX_LENGTH}
                onChange={(event) => setName(event.target.value)}
                className="text-center"
              />
              {error ? (
                <p
                  role="alert"
                  data-testid="create-bot-error"
                  className="text-body-sm text-destructive"
                >
                  {error}
                </p>
              ) : null}
              <BotLookPicker
                value={look.value}
                identity={avatarSet === "rakazo" ? previewId : look.identity}
                organicIdentities={ORGANIC_IDENTITIES}
                avatarSet={avatarSet}
                onChange={(value, identity) => {
                  setLook((current) => ({ value, identity: identity ?? current.identity }));
                }}
              />
            </>
          ) : (
            <div className="space-y-2.5 py-2">
              <p className="text-body-sm text-muted-foreground text-center">
                <Trans>Select a pre-configured Orbit Agent blueprint to get started:</Trans>
              </p>
              <div className="grid grid-cols-1 gap-2">
                {ORBIT_BLUEPRINTS.map((blueprint) => {
                  const Icon = blueprint.icon;
                  return (
                    <button
                      key={blueprint.id}
                      type="button"
                      onClick={() => selectBlueprint(blueprint)}
                      className="flex items-start gap-3 p-3 rounded-xl border border-border/60 bg-card/60 hover:bg-card hover:border-primary/40 transition-all text-start group active:scale-[0.99]"
                    >
                      <div className={`size-9 rounded-lg border flex items-center justify-center shrink-0 ${blueprint.accent}`}>
                        <Icon size={18} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-caption font-semibold text-foreground group-hover:text-primary transition-colors">
                          {blueprint.name}
                        </div>
                        <div className="text-caption text-muted-foreground line-clamp-2 mt-0.5">
                          {blueprint.tagline}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" disabled={submitting} onClick={onCancel}>
              <Trans>Cancel</Trans>
            </Button>
            <Button type="submit" disabled={!trimmed || submitting}>
              <Trans>Create</Trans>
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
