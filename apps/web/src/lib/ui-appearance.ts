import type { AppearancePreference, ResolvedAppearance } from "@forion/orbit-ui-tokens";
import {
  persistAppearancePreference,
  resolveAppearance,
  resolveAppearancePreference,
  webTokensForAppearance,
} from "@forion/orbit-ui-tokens";

export type { AppearancePreference, ResolvedAppearance };

const THEME_COLOR_META = 'meta[name="theme-color"]';
const APPEARANCE_KEY = "orbit.uiAppearance";
const LEGACY_APPEARANCE_KEY = "rakazo.uiAppearance";
const DARK_COSMIC_THEMES = new Set([
  "deep-space",
  "nebula",
  "solar",
  "phantom",
  "ocean",
  "blueprint",
]);

function storedAppearance(): string | null {
  try {
    return localStorage.getItem(APPEARANCE_KEY) ?? localStorage.getItem(LEGACY_APPEARANCE_KEY);
  } catch {
    return null;
  }
}

/** Keep a manual light/dark choice from fighting a stale cosmic-theme attribute. */
function reconcileCosmicTheme(root: HTMLElement, appearance: ResolvedAppearance): void {
  const current = root.dataset.orbitTheme;
  if (appearance === "light" && current && DARK_COSMIC_THEMES.has(current)) {
    root.dataset.orbitTheme = "cosmic-light";
  } else if (appearance === "dark" && current === "cosmic-light") {
    root.dataset.orbitTheme = "deep-space";
  }
}

export function readSystemAppearance(
  media: Pick<MediaQueryList, "matches"> | null = typeof window !== "undefined"
    ? window.matchMedia("(prefers-color-scheme: light)")
    : null,
): ResolvedAppearance {
  return media?.matches ? "light" : "dark";
}

export function applyResolvedAppearance(
  appearance: ResolvedAppearance,
  root: HTMLElement | null = typeof document !== "undefined" ? document.documentElement : null,
): void {
  if (!root) return;
  root.dataset.theme = appearance;
  root.style.colorScheme = appearance;
  reconcileCosmicTheme(root, appearance);
  if (typeof document === "undefined") return;
  const meta = document.querySelector(THEME_COLOR_META);
  if (meta) {
    // The applied background, so an instance theme's color reaches the browser chrome too.
    const applied = getComputedStyle(root).getPropertyValue("--background").trim();
    meta.setAttribute("content", applied || webTokensForAppearance(appearance).background);
  }
}

export function applyUiAppearance(
  preference: AppearancePreference = resolveAppearancePreference({ stored: storedAppearance() }),
  system: ResolvedAppearance = readSystemAppearance(),
): ResolvedAppearance {
  const resolved = resolveAppearance(preference, system);
  applyResolvedAppearance(resolved);
  return resolved;
}

export function setUiAppearance(preference: AppearancePreference): ResolvedAppearance {
  persistAppearancePreference(preference);
  try {
    localStorage.setItem(APPEARANCE_KEY, preference);
  } catch {
    // Storage may be unavailable; the in-memory appearance still applies below.
  }
  return applyUiAppearance(preference);
}

export function getUiAppearancePreference(): AppearancePreference {
  return resolveAppearancePreference({ stored: storedAppearance() });
}

/** Keep `data-theme` in sync when the OS scheme changes and preference is System. */
export function watchSystemAppearance(
  onChange: (system: ResolvedAppearance) => void = () => {
    if (resolveAppearancePreference({ stored: storedAppearance() }) === "system") {
      applyUiAppearance("system");
    }
  },
): () => void {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return () => undefined;
  }
  const media = window.matchMedia("(prefers-color-scheme: light)");
  const handler = () => onChange(media.matches ? "light" : "dark");
  media.addEventListener("change", handler);
  return () => media.removeEventListener("change", handler);
}
