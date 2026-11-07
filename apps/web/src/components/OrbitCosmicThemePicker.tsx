import { useLingui } from "@lingui/react/macro";
import { Check, Flame, Grid, Moon, Sparkles, SunMedium, Terminal, Waves } from "lucide-react";
import { useEffect, useState } from "react";
import type { OrbitThemeId } from "./OrbitThemeSwitcher";
import { ORBIT_THEMES } from "./OrbitThemeSwitcher";

export interface CosmicThemeCardSpec {
  id: OrbitThemeId;
  name: string;
  tagline: string;
  icon: typeof Moon;
  accent: string;
  bg: string;
  previewBorder: string;
  isLight?: boolean;
}

export const COSMIC_THEME_SPECS: CosmicThemeCardSpec[] = [
  {
    id: "deep-space",
    name: "Deep Space",
    tagline: "Cool cyan accents on deep space black",
    icon: Moon,
    accent: "#22d3ee",
    bg: "#050508",
    previewBorder: "border-cyan-500/25",
  },
  {
    id: "nebula",
    name: "Nebula",
    tagline: "Purple nebula glow with vivid highlights",
    icon: Sparkles,
    accent: "#e879f9",
    bg: "#0f0514",
    previewBorder: "border-fuchsia-500/25",
  },
  {
    id: "solar",
    name: "Solar",
    tagline: "Warm amber tones inspired by solar flares",
    icon: Flame,
    accent: "#fb923c",
    bg: "#0c0402",
    previewBorder: "border-amber-500/25",
  },
  {
    id: "phantom",
    name: "Phantom",
    tagline: "Cyber terminal neon green on dark matrix",
    icon: Terminal,
    accent: "#00FF41",
    bg: "#020b05",
    previewBorder: "border-emerald-500/25",
  },
  {
    id: "ocean",
    name: "Ocean",
    tagline: "Calm sapphire oceanic depth aesthetic",
    icon: Waves,
    accent: "#38bdf8",
    bg: "#020d18",
    previewBorder: "border-sky-500/25",
  },
  {
    id: "blueprint",
    name: "Blueprint",
    tagline: "Technical cobalt grid & engineering blueprint",
    icon: Grid,
    accent: "#3b82f6",
    bg: "#050c1e",
    previewBorder: "border-blue-500/25",
  },
  {
    id: "cosmic-light",
    name: "Cosmic Light",
    tagline: "Crisp pearl white interface for daylight",
    icon: SunMedium,
    accent: "#0284c7",
    bg: "#f8fafc",
    previewBorder: "border-zinc-300",
    isLight: true,
  },
];

export function OrbitCosmicThemePicker({
  onThemeSelected,
}: {
  onThemeSelected?: (themeId: OrbitThemeId) => void;
}) {
  const { t } = useLingui();
  const [activeTheme, setActiveTheme] = useState<OrbitThemeId>(() => {
    try {
      return (localStorage.getItem("orbit-cosmic-theme") as OrbitThemeId) || "deep-space";
    } catch {
      return "deep-space";
    }
  });

  useEffect(() => {
    try {
      const saved = (localStorage.getItem("orbit-cosmic-theme") as OrbitThemeId) || "deep-space";
      setActiveTheme(saved);
    } catch {}
  }, []);

  function applyTheme(themeId: OrbitThemeId) {
    setActiveTheme(themeId);
    try {
      localStorage.setItem("orbit-cosmic-theme", themeId);
      localStorage.setItem("rakazo.uiAppearance", themeId === "cosmic-light" ? "light" : "dark");
    } catch {}

    const mode = themeId === "cosmic-light" ? "light" : "dark";
    document.documentElement.dataset.theme = mode;
    document.documentElement.dataset.orbitTheme = themeId;

    if (mode === "light") {
      document.documentElement.style.colorScheme = "light";
      document.documentElement.classList.remove("dark");
    } else {
      document.documentElement.style.colorScheme = "dark";
      document.documentElement.classList.add("dark");
    }

    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) {
      const match = COSMIC_THEME_SPECS.find((s) => s.id === themeId);
      meta.setAttribute("content", match?.bg ?? "#050508");
    }

    onThemeSelected?.(themeId);
  }

  return (
    <div className="w-full space-y-2">
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 xl:grid-cols-4">
        {COSMIC_THEME_SPECS.map((theme) => {
          const isSelected = theme.id === activeTheme;
          const Icon = theme.icon;

          return (
            <button
              key={theme.id}
              type="button"
              onClick={() => applyTheme(theme.id)}
              aria-pressed={isSelected}
              className={`group flex flex-col overflow-hidden rounded-xl border text-left transition-all duration-200 outline-none ${
                isSelected
                  ? "border-[var(--accent-primary,#22d3ee)] bg-muted/20 shadow-sm ring-1 ring-[var(--accent-primary,#22d3ee)]/40"
                  : "border-border/60 bg-card/20 hover:border-border hover:bg-muted/15"
              }`}
            >
              {/* Preview Window */}
              <div className="p-2 pb-0">
                <div
                  className={`relative h-14 overflow-hidden rounded-lg border transition-all ${theme.previewBorder}`}
                  style={{ backgroundColor: theme.bg }}
                >
                  <div className="absolute inset-0 bg-gradient-to-br from-white/10 via-transparent to-black/25 pointer-events-none" />
                  <div className="relative flex h-full flex-col justify-between p-2">
                    <div className="flex items-center justify-between">
                      {/* Mini Accent Pill */}
                      <div
                        className="h-1.5 w-7 rounded-full shadow-sm"
                        style={{ backgroundColor: theme.accent }}
                      />
                      {/* Checkmark or Theme Icon */}
                      {isSelected ? (
                        <div className="flex h-4 w-4 items-center justify-center rounded-full bg-white/20 backdrop-blur-sm shadow-sm">
                          <Check
                            size={10}
                            strokeWidth={3}
                            style={{ color: theme.isLight ? "#0f172a" : theme.accent }}
                          />
                        </div>
                      ) : (
                        <Icon
                          size={12}
                          className="opacity-60 group-hover:opacity-100 transition-opacity"
                          style={{ color: theme.accent }}
                        />
                      )}
                    </div>
                    {/* Mock Chat / Document Lines */}
                    <div className="space-y-1">
                      <div
                        className={`h-1 w-full rounded-full ${
                          theme.isLight ? "bg-black/15" : "bg-white/15"
                        }`}
                      />
                      <div
                        className={`h-1 w-2/3 rounded-full ${
                          theme.isLight ? "bg-black/10" : "bg-white/10"
                        }`}
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Theme Name & Tagline */}
              <div className="space-y-0.5 px-2.5 py-2">
                <div className="flex items-center justify-between">
                  <p className="text-label font-semibold text-foreground tracking-tight">
                    {theme.name}
                  </p>
                  {isSelected && (
                    <span className="text-caption font-bold uppercase tracking-wider text-primary">
                      {t`Active`}
                    </span>
                  )}
                </div>
                <p className="line-clamp-1 text-caption leading-tight text-muted-foreground">
                  {theme.tagline}
                </p>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

