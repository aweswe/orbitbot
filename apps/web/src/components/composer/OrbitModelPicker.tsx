import { BrainCircuit, Check, ChevronDown, Gauge, Settings2, Sparkles } from "lucide-react";
import { useEffect, useRef, useState } from "react";

export type OrbitModelTier = "instant" | "thinking" | "custom";
export type ReasoningEffortLevel = "low" | "medium" | "high" | "max";

const REASONING_LEVELS: ReasoningEffortLevel[] = ["low", "medium", "high", "max"];
const REASONING_LABELS: Record<ReasoningEffortLevel, string> = {
  low: "Low",
  medium: "Med",
  high: "High",
  max: "Max",
};
const REASONING_COSTS: Record<ReasoningEffortLevel, string> = {
  low: "1×",
  medium: "2×",
  high: "4×",
  max: "8×",
};

interface OrbitModelPickerProps {
  disabled?: boolean;
}

export function OrbitModelPicker({ disabled }: OrbitModelPickerProps) {
  const [open, setOpen] = useState(false);
  const [modelTier, setModelTier] = useState<OrbitModelTier>(() => {
    return (localStorage.getItem("orbit_model_tier") as OrbitModelTier) || "instant";
  });
  const [reasoningEffort, setReasoningEffort] = useState<ReasoningEffortLevel>(() => {
    return (localStorage.getItem("orbit_reasoning_effort") as ReasoningEffortLevel) || "medium";
  });

  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    localStorage.setItem("orbit_model_tier", modelTier);
  }, [modelTier]);

  useEffect(() => {
    localStorage.setItem("orbit_reasoning_effort", reasoningEffort);
  }, [reasoningEffort]);

  // Click outside to close
  useEffect(() => {
    if (!open) return;
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    window.addEventListener("mousedown", handleClickOutside);
    return () => window.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  const activeLabel =
    modelTier === "instant" ? "Orbit Flash" : modelTier === "thinking" ? "Orbit Forge" : "Custom AI";

  return (
    <div className="relative inline-block" ref={menuRef}>
      {/* Trigger Button */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen(!open)}
        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-all duration-150 border ${
          modelTier === "thinking"
            ? "bg-violet-950/50 text-violet-300 border-violet-500/40 hover:border-violet-400"
            : modelTier === "custom"
              ? "bg-emerald-950/50 text-emerald-300 border-emerald-500/40 hover:border-emerald-400"
              : "bg-amber-950/40 text-amber-300 border-amber-500/30 hover:border-amber-400/50"
        } ${disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer active:scale-95"}`}
        title={`Selected Model: ${activeLabel}`}
      >
        {modelTier === "thinking" ? (
          <BrainCircuit size={12} className="text-violet-400 shrink-0" />
        ) : modelTier === "custom" ? (
          <Settings2 size={12} className="text-emerald-400 shrink-0" />
        ) : (
          <Gauge size={12} className="text-amber-400 shrink-0" />
        )}
        <span className="truncate max-w-[85px] sm:max-w-none">{activeLabel}</span>
        {modelTier === "thinking" && (
          <span className="text-[10px] px-1 py-px rounded bg-violet-500/20 text-violet-300 font-mono">
            {REASONING_LABELS[reasoningEffort]}
          </span>
        )}
        <ChevronDown size={11} className={`text-muted-foreground transition-transform duration-200 ${open ? "rotate-180" : ""}`} />
      </button>

      {/* Popover Card */}
      {open && (
        <div className="absolute bottom-full right-0 mb-2 w-72 rounded-xl border border-border/80 bg-popover/95 p-1.5 text-popover-foreground shadow-2xl backdrop-blur-xl z-50 animate-in fade-in-0 zoom-in-95">
          <div className="px-2.5 py-1.5 border-b border-border/40 mb-1">
            <span className="text-[11px] font-semibold tracking-wider uppercase text-muted-foreground">
              Intelligence Tier
            </span>
          </div>

          {/* Orbit Flash Option */}
          <div
            role="button"
            tabIndex={0}
            onClick={() => {
              setModelTier("instant");
              setOpen(false);
            }}
            className={`group relative w-full cursor-pointer rounded-lg border p-2 text-left transition-colors mb-1 ${
              modelTier === "instant"
                ? "border-amber-500/40 bg-amber-500/[0.08]"
                : "border-transparent hover:bg-muted/50"
            }`}
          >
            <div className="flex items-center gap-2">
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-amber-500/10 text-amber-400">
                <Gauge size={14} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-semibold text-foreground">Orbit Flash</span>
                  <span className="rounded px-1 py-px text-[10px] font-medium bg-amber-500/20 text-amber-300">
                    Default
                  </span>
                </div>
                <p className="text-[11px] text-muted-foreground truncate">Fast · Zero reasoning overhead</p>
              </div>
              {modelTier === "instant" && <Check size={14} className="text-amber-400 shrink-0" />}
            </div>
          </div>

          {/* Orbit Forge Option */}
          <div
            role="button"
            tabIndex={0}
            onClick={() => {
              setModelTier("thinking");
            }}
            className={`group relative w-full cursor-pointer rounded-lg border p-2 text-left transition-colors mb-1 ${
              modelTier === "thinking"
                ? "border-violet-500/40 bg-violet-500/[0.08]"
                : "border-transparent hover:bg-muted/50"
            }`}
          >
            <div className="flex items-center gap-2">
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-violet-500/10 text-violet-400">
                <BrainCircuit size={14} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-semibold text-foreground">Orbit Forge</span>
                  <span className="rounded px-1 py-px text-[10px] font-medium bg-violet-500/20 text-violet-300">
                    Thinking
                  </span>
                </div>
                <p className="text-[11px] text-muted-foreground truncate">Deep multi-pass reasoning</p>
              </div>
              {modelTier === "thinking" && <Check size={14} className="text-violet-400 shrink-0" />}
            </div>

            {/* Reasoning levels */}
            <div
              className={`mt-2 flex items-center gap-1 rounded-md border p-0.5 ${
                modelTier === "thinking" ? "border-violet-500/30 bg-violet-500/[0.05]" : "border-border/30 opacity-70"
              }`}
              onClick={(e) => e.stopPropagation()}
            >
              {REASONING_LEVELS.map((lvl) => {
                const isActive = reasoningEffort === lvl && modelTier === "thinking";
                return (
                  <button
                    key={lvl}
                    type="button"
                    onClick={() => {
                      setModelTier("thinking");
                      setReasoningEffort(lvl);
                    }}
                    className={`flex flex-1 items-center justify-center gap-0.5 rounded py-0.5 text-[10px] transition-colors ${
                      isActive
                        ? "bg-violet-500/25 font-semibold text-violet-200"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <span>{REASONING_LABELS[lvl]}</span>
                    <span className="opacity-60 text-[9px] font-mono">{REASONING_COSTS[lvl]}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Custom Option */}
          <div
            role="button"
            tabIndex={0}
            onClick={() => {
              setModelTier("custom");
              setOpen(false);
            }}
            className={`group relative w-full cursor-pointer rounded-lg border p-2 text-left transition-colors ${
              modelTier === "custom"
                ? "border-emerald-500/40 bg-emerald-500/[0.08]"
                : "border-transparent hover:bg-muted/50"
            }`}
          >
            <div className="flex items-center gap-2">
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-emerald-500/10 text-emerald-400">
                <Settings2 size={14} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-semibold text-foreground">Custom Model</span>
                  <span className="rounded px-1 py-px text-[10px] font-medium bg-emerald-500/20 text-emerald-300">
                    Requesty
                  </span>
                </div>
                <p className="text-[11px] text-muted-foreground truncate">Full model catalog router</p>
              </div>
              {modelTier === "custom" && <Check size={14} className="text-emerald-400 shrink-0" />}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

