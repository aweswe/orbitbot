# Orbit Duplicate UI Register & Consolidation Plan

**Project**: Orbit by Forion  
**Date**: November 2026  
**Auditor**: Principal Product Designer & UI/UX Architect  
**Branch**: `stabilize/orbit-ui-ux-reinvention`

---

## 1. Inventory of Duplicated & Fragmented Interfaces

During the comprehensive audit, several fragmented and competing UI implementations were discovered across the codebase:

### Duplicate 1: Bot Creation & Templates
- **Competing Files**:
  1. `apps/web/src/pages/shell/create-bot-dialog.tsx`: Bare name input + avatar picker.
  2. `apps/web/src/pages/shell/bot-picker.tsx`: Popover menu listing options (New Bot, New Group, New Space).
  3. `apps/web/src/components/bot-templates/bot-templates-dialog.tsx`: Modal listing bot archetype cards.
- **Problem**:
  Users clicking `+ New Bot` from the sidebar only got a blank name input with no access to templates. If they wanted a specialized bot (e.g. Code Reviewer, Research Analyst), they had to discover `bot-templates-dialog` through a completely separate path.
- **Target Consolidation**:
  Consolidate into a single canonical **Orbit Agent Studio** (`OrbitAgentStudioDialog.tsx` / updated `create-bot-dialog.tsx`) with two clear tabs:
  - **Quick Create**: Custom name, instructions, and interactive Orbit avatar/ring picker.
  - **Blueprints & Templates**: Curated templates (Architect, Researcher, Data Synthesizer, Creative Writer) that prepopulate instructions and recommended models.

---

### Duplicate 2: Settings Overlays & Appearance Controls
- **Competing Files**:
  1. `apps/web/src/pages/SettingsOverlay.tsx`: Main settings dialog router.
  2. `apps/web/src/pages/AccountSettingsOverlay.tsx`: Contains `GeneralSettingsPanels` where `OrbitCosmicThemePicker` and `OrbitFontPicker` were placed under a general list.
  3. `apps/web/src/components/OrbitThemeSwitcher.tsx`: A separate floating popover used in some headers.
  4. Floating theme buttons in various toolbars.
- **Problem**:
  Users navigating to "Settings" saw a long sidebar list (General, Models, Approvals, Vault, Memory, Voice, Computer, Usage, Billing, Org) with **no entry for Appearance or Theme**. The theme selector was hidden halfway down the General page.
- **Target Consolidation**:
  - Add a dedicated **"Appearance"** (`appearance`) section directly into `useSettingsNavItems()` in `settings-nav.ts` with a `Palette` icon.
  - In `SettingsOverlay.tsx`, route `appearance` to a dedicated, high-impact **Orbit Appearance Hub** displaying:
    1. The 7 signature Cosmic Themes in visual preview cards with active selection rings.
    2. Font family selector with real-time preview.
    3. UI density controls (Spacious / Compact).
    4. Motion & effect controls.

---

### Duplicate 3: Sidebar Header Actions & Navigation
- **Competing Files**:
  1. `apps/web/src/pages/shell/sidebar-header.tsx`: Header holding brand, toggles, and utility icons.
  2. `apps/web/src/pages/shell/shell-sidebar.tsx`: Secondary button row with `+ New Bot` and `+ Group`.
- **Problem**:
  The sidebar header was burdened with redundant icons (Deck, Artifacts, Palette, Search, Gear, Bell), creating visual clutter. Furthermore, when compacted into mini mode, the `+ New Bot` action was hidden or poorly aligned.
- **Target Consolidation**:
  - **Expanded Mode**: Ultra-clean header featuring Orbit Logo mark, gradient brand title, and a single collapser toggle. The primary action row (`+ New Bot` and `+ Group`) is balanced and elevated directly below.
  - **Mini Mode**: Compact rail featuring the Orbit logo mark at the top, the restore toggle, and an unmistakable `+ New Bot` button with tooltip, allowing full bot creation in compact view.

---

### Duplicate 4: Command Palettes & Search Hotkeys
- **Competing Files**:
  1. `apps/web/src/pages/shell/command-palette.tsx`
  2. `apps/web/src/pages/SpaceSearch.tsx`
  3. `apps/web/src/pages/shell/chat-find-bar.tsx`
- **Problem**:
  Different search bars handle message searching, bot list filtering, and space navigation separately.
- **Target Consolidation**:
  Retain `chat-find-bar` for in-conversation message searching (`Ctrl+F`), while unifying global workspace search (`Cmd+K` / `Ctrl+K`) into the canonical Orbit Command Palette with categorized groups: Recent Bots, Actions, Spaces, and Themes.

