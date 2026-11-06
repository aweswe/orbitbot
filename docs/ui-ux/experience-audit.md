# Orbit UI/UX Experience Audit

**Project**: Orbit by Forion  
**Date**: November 2026  
**Auditor**: Principal Product Designer & UI/UX Architect  
**Branch**: `stabilize/orbit-ui-ux-reinvention`  
**Reference**: UI UX Pro Max Skill (`dark-mode-oled`, `hud-sci-fi-fui`, Density 8, 150-200ms ease)

---

## 1. Executive Summary

This audit evaluates the entire user experience of Orbit by Forion. While the application possesses a powerful backend (persistent sandboxes, multi-agent execution, MCP server support, tool execution streams, voice calls, and custom routines), the interface suffered from:
1. **Visual Disconnection & Inconsistency**: Cluttered header layouts with mismatched icon densities, competing entry points, and inconsistent padding.
2. **Settings Navigation Friction**: Users could not find the Cosmic Theme selector because settings navigation lacked a dedicated "Appearance" or "Theme" tab (themes were buried within a sub-section of General preferences).
3. **Compacted Sidebar Regressions**: When the sidebar was collapsed into mini icon mode, the ability to create a new bot was hidden or inaccessible, stranding users in compact mode.
4. **Fragmented Agent Creation**: Multiple competing dialogs (`create-bot-dialog`, `bot-picker`, `bot-templates-dialog`) created disjointed user onboarding and bot management paths.
5. **Legacy Branding Leaks**: Legacy platform identity occasionally surfaced in agent introductions when uninstructed models defaulted to historical training templates.
6. **Underutilized Backend Capabilities**: Rich backend features such as granular tool execution events, artifact timelines, and run logs were partially buried behind raw JSON blocks rather than structured, interactive UI cards.

---

## 2. Component & Surface Audit Matrix

| Surface / Component | Current State | Friction & Usability Issues | Target Experience (Redesign) |
| :--- | :--- | :--- | :--- |
| **Sidebar Header (Expanded)** | Orbit logo with cluttered right-dock of mixed icons (Deck, Artifacts, Palette, Search, Gear, Bell) | Overcrowded header; competing icon styles; visual noise competing with active bot list | Clean, balanced brand lockup with Orbit logo mark, glowing gradient branding, and an ergonomic collapse toggle. |
| **Sidebar Header (Mini / Compact)** | Missing Orbit logo; missing direct `+ New Bot` action | Users cannot start a bot without expanding the sidebar first; loss of brand grounding | Dedicated mini brand icon, expand toggle, and prominent high-contrast `+ New Bot` action button with instant tooltip. |
| **Settings Overlay** | Fragmented modal without an "Appearance" tab in the nav list | Users cannot discover the 7 cosmic themes or typography options | Dedicated **"Theme & Appearance"** tab in Settings navigation, featuring visual theme tiles, font family previewer, and density dials. |
| **Bot Creation Flow** | Separate barebones name dialog vs separate templates dialog | Mental model split: users either pick a blank name or stumble into templates | Consolidated **Orbit Agent Studio** modal combining Quick Create, Curated Blueprints/Templates, and Avatar Look styling. |
| **AI Chat & Transcript** | Basic text bubbles with raw tool status strings | Long running tasks lack visual milestones; diagrams require manual toggling | Polished HUD-inspired message cards, live token streaming cursor, collapsible tool timeline cards, and inline SVG diagram viewers. |
| **Command Palette (`Cmd+K`)** | Simple bot list search | Lacks deep workspace commands, theme switching, and quick routine triggers | Universal command center for instant bot switching, cosmic theme changing, space navigation, and tool execution. |
| **Mobile Drawer Shell** | Standard CSS squish | Desktop sidebar cramped onto mobile screens without proper thumb zones | Dedicated mobile bottom drawer / slide-over with touch-first action targets (44px minimum). |

---

## 3. Visual & Aesthetic Architecture

Following the **UI UX Pro Max** design intelligence guidelines:
- **Style Archetype**: Dark Mode OLED meets Sci-Fi HUD / Technical Precision.
- **Surface Elevation**: High contrast deep background (`#050508`) with 1px semi-transparent borders (`rgba(255,255,255,0.08)` to `rgba(255,255,255,0.15)`) and subtle cosmic accent glows.
- **Typography**: Dual hierarchy—Inter / Google Sans for high-legibility UI text, coupled with monospaced code elements and clean geometric headers.
- **Color Palettes**: 100% tokenized adherence to the 7 Cosmic Themes:
  1. `Deep Space` (Deep black, cyan accent `#22d3ee`)
  2. `Nebula` (Midnight violet, fuchsia accent `#e879f9`)
  3. `Solar` (Warm obsidian, amber flare `#f59e0b`)
  4. `Phantom` (Terminal HUD pure black, matrix green `#00ff41`)
  5. `Ocean` (Luminous deep azure `#0077b6`)
  6. `Blueprint` (Crisp cobalt technical drafting `#2563eb`)
  7. `Cosmic Light` (High-contrast bright daylight mode `#09090b` on `#f8fafc`)

---

## 4. Priority Roadmap

1. **Phase 1**: Complete Discovery & Architectural Documentation (Route inventory, duplicate registers, backend opportunities).
2. **Phase 2**: Standardize Orbit Design System tokens and CSS variables.
3. **Phase 3**: Reconstruct the Application Shell (expanded & mini sidebar, clean header, mobile drawer).
4. **Phase 4**: Rebuild Settings with the dedicated "Theme & Appearance" hub, consolidate the Agent Studio dialogs, and enhance chat components.
5. **Phase 5**: Surface rich tool execution cards and artifact timelines into the transcript.
6. **Phase 6**: Conduct multi-viewport visual QA across all 7 cosmic themes and ensure zero test regressions.

