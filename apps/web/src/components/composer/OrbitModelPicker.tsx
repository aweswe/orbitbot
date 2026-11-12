import {
  BrainCircuit,
  Check,
  ChevronDown,
  Gauge,
  Image as ImageIcon,
  Settings2,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";

export type OrbitModelTier = "instant" | "thinking" | "image" | "custom";
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
    modelTier === "instant"
      ? "Orbit Flash"
      : modelTier === "thinking"
        ? "Orbit Forge"
        : modelTier === "image"
          ? "Orbit Canvas"
          : "Custom AI";

  return (
    <div className="relative inline-block" ref={menuRef}>
      {/* Trigger Button */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen(!open)}
        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-caption font-medium transition-all duration-150 border ${
          modelTier === "thinking"
            ? "dark:bg-violet-950/50 bg-violet-50 dark:text-violet-300 text-violet-800 dark:border-violet-500/40 border-violet-300 hover:border-violet-400"
            : modelTier === "image"
              ? "dark:bg-sky-950/50 bg-sky-50 dark:text-sky-300 text-sky-800 dark:border-sky-500/40 border-sky-300 hover:border-sky-400"
              : modelTier === "custom"
                ? "dark:bg-emerald-950/50 bg-emerald-50 dark:text-emerald-300 text-emerald-800 dark:border-emerald-500/40 border-emerald-300 hover:border-emerald-400"
                : "dark:bg-amber-950/40 bg-amber-50 dark:text-amber-300 text-amber-800 dark:border-amber-500/30 border-amber-300 hover:border-amber-400/50"
        } ${disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer active:scale-95"}`}
        title={`Selected Model: ${activeLabel}`}
      >
        {modelTier === "thinking" ? (
          <BrainCircuit size={12} className="dark:text-violet-400 text-violet-600 shrink-0" />
        ) : modelTier === "image" ? (
          <ImageIcon size={12} className="dark:text-sky-400 text-sky-600 shrink-0" />
        ) : modelTier === "custom" ? (
          <Settings2 size={12} className="dark:text-emerald-400 text-emerald-600 shrink-0" />
        ) : (
          <Gauge size={12} className="dark:text-amber-400 text-amber-600 shrink-0" />
        )}
        <span className="truncate max-w-[85px] sm:max-w-none">{activeLabel}</span>
        {modelTier === "thinking" && (
          <span className="text-caption px-1 py-px rounded dark:bg-violet-500/20 bg-violet-100 dark:text-violet-300 text-violet-800 font-mono">
            {REASONING_LABELS[reasoningEffort]}
          </span>
        )}
        <ChevronDown
          size={11}
          className={`text-muted-foreground transition-transform duration-200 ${open ? "rotate-180" : ""}`}
        />
      </button>

      {/* Popover Card */}
      {open && (
        <div className="absolute bottom-full right-0 mb-2 w-72 rounded-xl border border-border/80 bg-popover/95 p-1.5 text-popover-foreground shadow-2xl backdrop-blur-xl z-50 animate-in fade-in-0 zoom-in-95">
          <div className="px-2.5 py-1.5 border-b border-border/40 mb-1">
            <span className="text-caption font-semibold tracking-wider uppercase text-muted-foreground">
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
                ? "dark:border-amber-500/40 border-amber-400/60 dark:bg-amber-500/[0.08] bg-amber-50/80"
                : "border-transparent hover:bg-muted/50"
            }`}
          >
            <div className="flex items-center gap-2">
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md dark:bg-amber-500/10 bg-amber-100 dark:text-amber-400 text-amber-700">
                <Gauge size={14} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <span className="text-caption font-semibold text-foreground">Orbit Flash</span>
                  <span className="rounded px-1 py-px text-caption font-medium dark:bg-amber-500/20 bg-amber-100 dark:text-amber-300 text-amber-800">
                    Default
                  </span>
                </div>
                <p className="text-caption text-muted-foreground truncate">
                  Fast · Zero reasoning overhead
                </p>
              </div>
              {modelTier === "instant" && <Check size={14} className="text-amber-500 shrink-0" />}
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
                ? "dark:border-violet-500/40 border-violet-400/60 dark:bg-violet-500/[0.08] bg-violet-50/80"
                : "border-transparent hover:bg-muted/50"
            }`}
          >
            <div className="flex items-center gap-2">
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md dark:bg-violet-500/10 bg-violet-100 dark:text-violet-400 text-violet-700">
                <BrainCircuit size={14} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <span className="text-caption font-semibold text-foreground">Orbit Forge</span>
                  <span className="rounded px-1 py-px text-caption font-medium dark:bg-violet-500/20 bg-violet-100 dark:text-violet-300 text-violet-800">
                    Thinking
                  </span>
                </div>
                <p className="text-caption text-muted-foreground truncate">
                  Deep multi-pass reasoning
                </p>
              </div>
              {modelTier === "thinking" && <Check size={14} className="text-violet-500 shrink-0" />}
            </div>

            {/* Reasoning levels */}
            <div
              className={`mt-2 flex items-center gap-1 rounded-md border p-0.5 ${
                modelTier === "thinking"
                  ? "dark:border-violet-500/30 border-violet-200 dark:bg-violet-500/[0.05] bg-violet-100/50"
                  : "border-border/30 opacity-70"
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
                    className={`flex flex-1 items-center justify-center gap-0.5 rounded py-0.5 text-caption transition-colors ${
                      isActive
                        ? "dark:bg-violet-500/25 bg-violet-200 font-semibold dark:text-violet-200 text-violet-900"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <span>{REASONING_LABELS[lvl]}</span>
                    <span className="opacity-60 text-caption font-mono">
                      {REASONING_COSTS[lvl]}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Orbit Canvas Option (Image Generation) */}
          <div
            role="button"
            tabIndex={0}
            onClick={() => {
              setModelTier("image");
              setOpen(false);
            }}
            className={`group relative w-full cursor-pointer rounded-lg border p-2 text-left transition-colors mb-1 ${
              modelTier === "image"
                ? "dark:border-sky-500/40 border-sky-400/60 dark:bg-sky-500/[0.08] bg-sky-50/80"
                : "border-transparent hover:bg-muted/50"
            }`}
          >
            <div className="flex items-center gap-2">
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md dark:bg-sky-500/10 bg-sky-100 dark:text-sky-400 text-sky-700">
                <ImageIcon size={14} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <span className="text-caption font-semibold text-foreground">Orbit Canvas</span>
                  <span className="rounded px-1 py-px text-caption font-medium dark:bg-sky-500/20 bg-sky-100 dark:text-sky-300 text-sky-800">
                    Image Gen
                  </span>
                </div>
                <p className="text-caption text-muted-foreground truncate">
                  Gemini 3.1 Flash Image · Requesty
                </p>
              </div>
              {modelTier === "image" && <Check size={14} className="text-sky-500 shrink-0" />}
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
                ? "dark:border-emerald-500/40 border-emerald-400/60 dark:bg-emerald-500/[0.08] bg-emerald-50/80"
                : "border-transparent hover:bg-muted/50"
            }`}
          >
            <div className="flex items-center gap-2">
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md dark:bg-emerald-500/10 bg-emerald-100 dark:text-emerald-400 text-emerald-700">
                <Settings2 size={14} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <span className="text-caption font-semibold text-foreground">Custom Model</span>
                  <span className="rounded px-1 py-px text-caption font-medium dark:bg-emerald-500/20 bg-emerald-100 dark:text-emerald-300 text-emerald-800">
                    Requesty
                  </span>
                </div>
                <p className="text-caption text-muted-foreground truncate">
                  Full model catalog router
                </p>
              </div>
              {modelTier === "custom" && <Check size={14} className="text-emerald-500 shrink-0" />}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
