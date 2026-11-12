import { useState, useEffect } from "react";
import { Check, Type } from "lucide-react";

export interface OrbitFontOption {
  id: string;
  name: string;
  category: string;
  preview: string;
  fontFamily: string;
}

export const ORBIT_FONTS: OrbitFontOption[] = [
  {
    id: "google-sans",
    name: "Google Sans",
    category: "Modern Tech",
    preview: "Sphinx of black quartz, judge my vow",
    fontFamily: '"Product Sans", "Google Sans", sans-serif',
  },
  {
    id: "inter",
    name: "Inter",
    category: "Precision",
    preview: "Sphinx of black quartz, judge my vow",
    fontFamily: '"Inter", sans-serif',
  },
  {
    id: "bricolage-grotesque",
    name: "Bricolage Grotesque",
    category: "Editorial",
    preview: "Sphinx of black quartz, judge my vow",
    fontFamily: '"Bricolage Grotesque", sans-serif',
  },
  {
    id: "poppins",
    name: "Poppins",
    category: "Geometric",
    preview: "Sphinx of black quartz, judge my vow",
    fontFamily: '"Poppins", sans-serif',
  },
  {
    id: "geist-mono",
    name: "Geist Mono",
    category: "Code & Dev",
    preview: "const orbit = new Agent({ ai: true });",
    fontFamily: '"Geist Mono", monospace',
  },
  {
    id: "space-mono",
    name: "Space Mono",
    category: "Cosmic Terminal",
    preview: "TRANSMIT --channel=orbit-bot --live",
    fontFamily: '"Space Mono", monospace',
  },
  {
    id: "roboto",
    name: "Roboto",
    category: "Clean",
    preview: "Sphinx of black quartz, judge my vow",
    fontFamily: '"Roboto", sans-serif',
  },
];

export function OrbitFontPicker() {
  const [activeFont, setActiveFont] = useState<string>("poppins");

  useEffect(() => {
    try {
      const saved = localStorage.getItem("orbit_font");
      if (saved) {
        setActiveFont(saved);
      }
    } catch {}
  }, []);

  const selectFont = (fontId: string) => {
    setActiveFont(fontId);
    try {
      localStorage.setItem("orbit_font", fontId);
      document.documentElement.dataset.font = fontId;
    } catch {}
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-accent text-foreground border border-border">
          <Type className="size-4" />
        </div>
        <div>
          <h4 className="text-body-sm font-semibold text-foreground">Orbit Typography</h4>
          <p className="text-caption text-muted-foreground">
            Select your workspace font family across all chat, sidebars, and panels.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
        {ORBIT_FONTS.map((font) => {
          const isSelected = activeFont === font.id;
          return (
            <button
              key={font.id}
              type="button"
              onClick={() => selectFont(font.id)}
              className={`group relative flex flex-col items-start gap-1 rounded-xl p-3.5 text-left transition-all border ${
                isSelected
                  ? "bg-primary/10 border-primary/40 shadow-sm"
                  : "bg-card border-border hover:border-foreground/20 hover:bg-muted"
              }`}
            >
              <div className="flex w-full items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-body-sm font-medium text-foreground">{font.name}</span>
                  <span className="text-caption font-medium text-muted-foreground/80 px-1.5 py-0.5 rounded bg-muted border border-border">
                    {font.category}
                  </span>
                </div>
                {isSelected && (
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-foreground">
                    <Check className="size-3 stroke-[2.5]" />
                  </span>
                )}
              </div>
              <p
                className="mt-1 text-caption text-muted-foreground line-clamp-1 group-hover:text-foreground/90 transition-colors"
                style={{ fontFamily: font.fontFamily }}
              >
                {font.preview}
              </p>
            </button>
          );
        })}
      </div>
    </div>
  );
}
