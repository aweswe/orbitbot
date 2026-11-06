import { Trans, useLingui } from "@lingui/react/macro";
import { Popover, PopoverContent, PopoverTrigger } from "@rakazo/ui-web";
import { Check, Flame, Grid, Moon, Palette, Sparkles, SunMedium, Terminal, Waves } from "lucide-react";
import { useEffect, useState } from "react";

export type OrbitThemeId =
  | "deep-space"
  | "nebula"
  | "solar"
  | "phantom"
  | "ocean"
  | "blueprint"
  | "cosmic-light";

export interface OrbitThemeItem {
  id: OrbitThemeId;
  name: string;
  tagline: string;
  icon: typeof Moon;
  accent: string;
  bg: string;
}

export const ORBIT_THEMES: OrbitThemeItem[] = [
  {
    id: "deep-space",
    name: "Deep Space",
    tagline: "Cyan & Deep Space Black",
    icon: Moon,
    accent: "#22d3ee",
    bg: "#050508",
  },
  {
    id: "nebula",
    name: "Nebula",
    tagline: "Fuchsia & Cosmic Violet",
    icon: Sparkles,
    accent: "#e879f9",
    bg: "#0f0514",
  },
  {
    id: "solar",
    name: "Solar",
    tagline: "Solar Flare Amber & Orange",
    icon: Flame,
    accent: "#fb923c",
    bg: "#0c0402",
  },
  {
    id: "phantom",
    name: "Phantom",
    tagline: "Cyber Matrix Neon Green",
    icon: Terminal,
    accent: "#00FF41",
    bg: "#020b05",
  },
  {
    id: "ocean",
    name: "Ocean",
    tagline: "Sapphire Oceanic Navy",
    icon: Waves,
    accent: "#38bdf8",
    bg: "#020d18",
  },
  {
    id: "blueprint",
    name: "Blueprint",
    tagline: "Technical Cobalt & Grid",
    icon: Grid,
    accent: "#3b82f6",
    bg: "#050c1e",
  },
  {
    id: "cosmic-light",
    name: "Cosmic Light",
    tagline: "Crisp Pearl White",
    icon: SunMedium,
    accent: "#0284c7",
    bg: "#f8fafc",
  },
];

export function OrbitThemeSwitcher({ className }: { className?: string }) {
  const { t } = useLingui();
  const [currentTheme, setCurrentTheme] = useState<OrbitThemeId>("deep-space");
  const [open, setOpen] = useState(false);

  useEffect(() => {
    try {
      const saved = (localStorage.getItem("orbit-cosmic-theme") as OrbitThemeId) || "deep-space";
      setCurrentTheme(saved);
    } catch {}
  }, []);

  function applyTheme(themeId: OrbitThemeId) {
    setCurrentTheme(themeId);
    try {
      localStorage.setItem("orbit-cosmic-theme", themeId);
      localStorage.setItem("rakazo.uiAppearance", themeId === "cosmic-light" ? "light" : "dark");
    } catch {}

    document.documentElement.dataset.theme = themeId;
    document.documentElement.dataset.orbitTheme = themeId;

    if (themeId === "cosmic-light") {
      document.documentElement.style.colorScheme = "light";
      document.documentElement.classList.remove("dark");
    } else {
      document.documentElement.style.colorScheme = "dark";
      document.documentElement.classList.add("dark");
    }

    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) {
      const match = ORBIT_THEMES.find((item) => item.id === themeId);
      meta.setAttribute("content", match?.bg ?? "#050508");
    }
  }

  const activeTheme = ORBIT_THEMES.find((th) => th.id === currentTheme) ?? ORBIT_THEMES[0]!;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <button
            type="button"
            aria-label={t`Orbit Theme: ${activeTheme.name}`}
            title={t`Theme: ${activeTheme.name}`}
            className={`flex size-8 items-center justify-center rounded-lg border border-white/10 bg-white/[0.03] text-muted-foreground transition-all hover:border-cyan-500/40 hover:bg-white/[0.07] hover:text-foreground ${className ?? ""}`}
          >
            <Palette size={15} strokeWidth={1.8} style={{ color: activeTheme.accent }} />
          </button>
        }
      />
      <PopoverContent
        align="start"
        sideOffset={8}
        className="w-64 rounded-2xl border border-white/10 bg-[#0c0d14]/95 p-2 backdrop-blur-xl shadow-2xl shadow-black/70"
      >
        <div className="px-2 py-1.5 border-b border-white/5 mb-1 flex items-center justify-between">
          <span className="text-[11px] font-bold tracking-wider uppercase text-muted-foreground">
            <Trans>Orbit Themes</Trans>
          </span>
          <span className="text-[10px] font-medium text-cyan-400">
            {activeTheme.name}
          </span>
        </div>
        <div className="space-y-1">
          {ORBIT_THEMES.map((theme) => {
            const isSelected = theme.id === currentTheme;
            const Icon = theme.icon;
            return (
              <button
                key={theme.id}
                type="button"
                onClick={() => {
                  applyTheme(theme.id);
                  setOpen(false);
                }}
                className={`flex w-full items-center justify-between rounded-xl px-2.5 py-2 text-start transition-all ${
                  isSelected
                    ? "bg-white/[0.08] text-foreground border border-white/10"
                    : "text-muted-foreground hover:bg-white/[0.04] hover:text-foreground border border-transparent"
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div
                    className="flex size-6 shrink-0 items-center justify-center rounded-lg border border-white/10 shadow-sm"
                    style={{ backgroundColor: theme.bg }}
                  >
                    <Icon size={13} style={{ color: theme.accent }} />
                  </div>
                  <div className="min-w-0">
                    <div className="truncate text-[12px] font-semibold text-foreground">
                      {theme.name}
                    </div>
                    <div className="truncate text-[10px] text-muted-foreground">
                      {theme.tagline}
                    </div>
                  </div>
                </div>
                {isSelected && (
                  <Check size={14} className="shrink-0 text-cyan-400 ms-2" />
                )}
              </button>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}
