import type { ModelCatalogEntry, ModelRoleChoice } from "@forion/orbit-contracts";
import { BrainCircuit, Check, ChevronDown, Gauge } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { rpc } from "../../lib/rpc";
import { errorText } from "../../lib/user-error";

interface OrbitModelPickerProps {
  disabled?: boolean;
  /** The active chat. A bot keeps its own model; a group has no single override. */
  target?: { botId?: string; groupId?: string };
}

type ModelChoice = Pick<ModelRoleChoice, "provider" | "modelId" | "thinkingLevel">;

function sameModel(left: ModelChoice | null, right: ModelRoleChoice | null): boolean {
  return Boolean(
    left && right && left.provider === right.provider && left.modelId === right.modelId,
  );
}

/**
 * The composer picks the active bot's model from the Forion catalog. A group
 * has no single model override, so the control stays hidden there. There is no
 * free-text provider or model field: a hosted deployment only runs models the
 * catalog knows and the deployment can bill.
 */
export function OrbitModelPicker({ disabled, target }: OrbitModelPickerProps) {
  const botId = target?.botId;
  const [open, setOpen] = useState(false);
  const [catalog, setCatalog] = useState<ModelCatalogEntry[]>([]);
  const [current, setCurrent] = useState<ModelChoice | null>(null);
  const [deep, setDeep] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!botId) return;
    let cancelled = false;
    void Promise.allSettled([
      rpc.models.list(),
      rpc.models.role({ role: "main" }),
      rpc.bots.get({ botId }),
    ]).then(([list, role, bot]) => {
      if (cancelled) return;
      if (list.status === "fulfilled") {
        setCatalog(
          list.value.filter((entry) => entry.protocol !== "decisions" && !entry.placeholder),
        );
      }
      // The bot's own model wins over the Space's main role, so show that.
      if (bot.status === "fulfilled" && bot.value.modelProvider && bot.value.modelId) {
        setCurrent({
          provider: bot.value.modelProvider,
          modelId: bot.value.modelId,
          thinkingLevel: bot.value.thinkingLevel ?? null,
        });
        setDeep(Boolean(bot.value.thinkingLevel && bot.value.thinkingLevel !== "off"));
        return;
      }
      if (role.status === "fulfilled") {
        const primary = role.value.primary ?? role.value.deploymentPrimary ?? null;
        if (primary) {
          setCurrent({
            provider: primary.provider,
            modelId: primary.modelId,
            thinkingLevel: primary.thinkingLevel ?? null,
          });
          setDeep(Boolean(primary.thinkingLevel && primary.thinkingLevel !== "off"));
        }
      }
    });
    return () => {
      cancelled = true;
    };
  }, [botId]);

  useEffect(() => {
    if (!open) return;
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    window.addEventListener("mousedown", handleClickOutside);
    return () => window.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  const selectedEntry =
    catalog.find(
      (entry) => entry.provider === current?.provider && entry.id === current?.modelId,
    ) ?? null;
  const label = selectedEntry?.label ?? current?.modelId ?? "Model";
  const canReason = Boolean(selectedEntry?.reasoning || selectedEntry?.thinkingLevels?.length);

  async function choose(entry: ModelCatalogEntry, thinkingDeep = deep) {
    if (saving) return;
    const thinkingLevel =
      thinkingDeep && (entry.reasoning || entry.thinkingLevels?.length) ? "high" : null;
    const choice = {
      provider: entry.provider,
      modelId: entry.id,
      thinkingLevel,
    } satisfies ModelChoice;
    setSaving(true);
    setError(null);
    try {
      if (botId) {
        await rpc.bots.update({
          botId,
          modelProvider: choice.provider,
          modelId: choice.modelId,
          thinkingLevel: choice.thinkingLevel,
        });
      } else {
        await rpc.models.setRole({ role: "main", primary: choice });
      }
      setCurrent(choice);
      setDeep(Boolean(thinkingLevel));
      setOpen(false);
    } catch (cause) {
      setError(errorText(cause, "Could not change the model"));
    } finally {
      setSaving(false);
    }
  }

  async function setThinking(nextDeep: boolean) {
    if (!selectedEntry || saving) return;
    await choose(selectedEntry, nextDeep);
  }

  // A group runs each member on its own model; one picker would be a lie.
  if (!botId) return null;

  return (
    <div className="relative inline-block" ref={menuRef}>
      <button
        type="button"
        disabled={disabled || saving}
        onClick={() => setOpen((value) => !value)}
        className={`inline-flex items-center gap-1.5 rounded-full border border-border bg-background px-2.5 py-1 text-caption font-medium text-foreground transition-colors hover:bg-muted ${
          disabled || saving ? "cursor-not-allowed opacity-50" : "cursor-pointer"
        }`}
        aria-label={`Model: ${label}`}
        aria-expanded={open}
        title={`Selected model: ${label}`}
      >
        {deep ? <BrainCircuit size={12} /> : <Gauge size={12} />}
        <span className="truncate max-w-[85px] sm:max-w-[160px]">{label}</span>
        {deep ? (
          <span className="rounded bg-muted px-1 py-px font-mono text-caption">Deep</span>
        ) : null}
        <ChevronDown
          size={11}
          className={`text-muted-foreground transition-transform duration-200 ${
            open ? "rotate-180" : ""
          }`}
        />
      </button>

      {open ? (
        <div className="absolute bottom-full right-0 z-50 mb-2 w-80 rounded-xl border border-border bg-popover/95 p-1.5 text-popover-foreground shadow-2xl backdrop-blur-xl animate-in fade-in-0 zoom-in-95">
          <div className="mb-1 flex items-center justify-between border-b border-border/40 px-2.5 py-1.5">
            <span className="text-caption font-semibold uppercase tracking-wider text-muted-foreground">
              Model
            </span>
            {canReason ? (
              <div className="flex items-center gap-0.5 rounded-md border border-border p-0.5">
                {[false, true].map((value) => (
                  <button
                    key={String(value)}
                    type="button"
                    disabled={saving}
                    onClick={() => void setThinking(value)}
                    className={`rounded px-1.5 py-0.5 text-caption ${
                      deep === value
                        ? "bg-muted font-semibold text-foreground"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {value ? "Deep" : "Standard"}
                  </button>
                ))}
              </div>
            ) : null}
          </div>

          <div className="max-h-80 space-y-0.5 overflow-y-auto">
            {catalog.length === 0 ? (
              <p className="px-2.5 py-2 text-caption text-muted-foreground">No models available</p>
            ) : (
              catalog.map((entry) => {
                const active = sameModel(current, {
                  provider: entry.provider,
                  modelId: entry.id,
                  thinkingLevel: null,
                });
                return (
                  <button
                    key={`${entry.provider}:${entry.id}`}
                    type="button"
                    disabled={saving}
                    onClick={() => void choose(entry)}
                    className={`flex w-full items-center gap-2 rounded-lg border p-2 text-left transition-colors ${
                      active ? "border-border bg-muted" : "border-transparent hover:bg-muted/50"
                    }`}
                  >
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-muted">
                      {entry.reasoning || entry.thinkingLevels?.length ? (
                        <BrainCircuit size={14} />
                      ) : (
                        <Gauge size={14} />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="truncate text-caption font-semibold text-foreground">
                          {entry.label}
                        </span>
                        {entry.managed ? (
                          <span className="rounded bg-muted px-1 py-px text-caption text-muted-foreground">
                            Included
                          </span>
                        ) : null}
                      </div>
                      <p className="truncate text-caption text-muted-foreground">
                        {entry.providerName ?? entry.provider}
                      </p>
                    </div>
                    {active ? <Check size={14} className="shrink-0" /> : null}
                  </button>
                );
              })
            )}
          </div>
          {error ? <p className="px-2.5 py-1.5 text-caption text-destructive">{error}</p> : null}
        </div>
      ) : null}
    </div>
  );
}
