import { ToggleGroup, ToggleGroupItem } from "@forion/orbit-ui-web";
import { Trans, useLingui } from "@lingui/react/macro";
import { Sliders, Sparkles, Type } from "lucide-react";
import { OrbitCosmicThemePicker } from "../components/OrbitCosmicThemePicker";
import { OrbitFontPicker } from "../components/OrbitFontPicker";
import { SettingsGroup, SettingsRow } from "../components/SettingsRows";
import type { BotsSidebarDensity } from "../lib/bots-sidebar-density-pref";
import { botsSidebarDensityPreference } from "../lib/bots-sidebar-density-pref";
import { setUiAppearance } from "../lib/ui-appearance";

export function AppearanceSettingsPanel() {
  const { t } = useLingui();
  const density = botsSidebarDensityPreference.use();

  function onDensityChange(groupValue: string[]) {
    const val = groupValue[0];
    if (val === "compact" || val === "spacious") {
      botsSidebarDensityPreference.set(val as BotsSidebarDensity);
    }
  }

  return (
    <div className="space-y-8" data-testid="appearance-settings-panel">
      {/* ── 1. Orbit Cosmic Themes ── */}
      <SettingsGroup
        title={
          <div className="flex items-center gap-2">
            <Sparkles className="size-4 text-primary" />
            <span>
              <Trans>Orbit Cosmic Themes</Trans>
            </span>
          </div>
        }
      >
        <div className="px-4 py-3 border-b border-border/40 bg-muted/20">
          <p className="text-body-sm text-muted-foreground">
            <Trans>
              Choose a signature celestial aesthetic. Your theme automatically synchronizes across
              the application shell, chat workspace, and deck computer.
            </Trans>
          </p>
        </div>
        <div className="p-4">
          <OrbitCosmicThemePicker
            onThemeSelected={(themeId) => {
              if (themeId === "cosmic-light") {
                setUiAppearance("light");
              } else {
                setUiAppearance("dark");
              }
            }}
          />
        </div>
      </SettingsGroup>

      {/* ── 2. Typography Engine ── */}
      <SettingsGroup
        title={
          <div className="flex items-center gap-2">
            <Type className="size-4 text-primary" />
            <span>
              <Trans>Typography Engine</Trans>
            </span>
          </div>
        }
      >
        <div className="px-4 py-3 border-b border-border/40 bg-muted/20">
          <p className="text-body-sm text-muted-foreground">
            <Trans>
              Select your preferred typeface family. Orbit hot-reloads fonts in real-time across all
              headings, code blocks, and chat transcripts.
            </Trans>
          </p>
        </div>
        <div className="p-4">
          <OrbitFontPicker />
        </div>
      </SettingsGroup>

      {/* ── 3. Workspace Density ── */}
      <SettingsGroup
        title={
          <div className="flex items-center gap-2">
            <Sliders className="size-4 text-primary" />
            <span>
              <Trans>Workspace Density</Trans>
            </span>
          </div>
        }
      >
        <SettingsRow
          label={
            <div>
              <div className="font-medium text-foreground">
                <Trans>Sidebar Density</Trans>
              </div>
              <div className="text-body-sm text-muted-foreground">
                <Trans>Adjust compact or spacious list density in the agent sidebar</Trans>
              </div>
            </div>
          }
          control={
            <ToggleGroup
              value={[density]}
              onValueChange={onDensityChange}
              spacing={1}
              className="rounded-lg bg-muted/40 p-0.5 border border-border"
            >
              <ToggleGroupItem value="spacious" className="px-3 py-1.5 text-caption font-medium">
                <span>
                  <Trans>Comfortable</Trans>
                </span>
              </ToggleGroupItem>
              <ToggleGroupItem value="compact" className="px-3 py-1.5 text-caption font-medium">
                <span>
                  <Trans>Compact</Trans>
                </span>
              </ToggleGroupItem>
            </ToggleGroup>
          }
        />
      </SettingsGroup>
    </div>
  );
}
