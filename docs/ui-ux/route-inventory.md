# Orbit Route & Layout Inventory

**Project**: Orbit by Forion  
**Date**: November 2026  
**Auditor**: Principal Product Designer & UI/UX Architect  
**Branch**: `stabilize/orbit-ui-ux-reinvention`

---

## 1. Top-Level Route Map

| Path Pattern | Component / Controller | Layout & Wrappers | Purpose & Target State |
| :--- | :--- | :--- | :--- |
| `/` | `Navigate` | SessionApp Gate | Redirects authenticated users to `/app`, returning users to `/sign-in`, and new users to `/sign-up`. |
| `/sign-in` | `AuthPage(mode="in")` | Full-viewport Auth Layout | Clean high-contrast authentication with password and passkey/SSO support. |
| `/sign-up` | `AuthPage(mode="up")` | Full-viewport Auth Layout | Account onboarding and space workspace creation. |
| `/forgot-password` | `AuthPage(mode="forgot")` | Full-viewport Auth Layout | Password recovery requesting reset token. |
| `/reset-password` | `PasswordResetPage` | Full-viewport Auth Layout | Password update with verified reset token. |
| `/p/:slugToken` | `SharedPagePage` | Standalone Public Frame | Read-only public rendering of generated Orbit Pages / Dashboards. |
| `/app` | `ShellPage` | Main Orbit Workspace Shell | Primary application workspace; displays recent bot or welcome conversation. |
| `/app/:botId` | `ShellPage` | Main Orbit Workspace Shell | Direct conversation with a specific Orbit Bot (Chief, jj, custom bots). |
| `/app/g/:groupId` | `ShellPage` | Main Orbit Workspace Shell | Multi-bot collaborative group chat workspace. |
| `/onboarding/:step?`| `OnboardingPage` | CallLayout & Onboarding View | Interactive wizard connecting model providers and initial bot settings. |
| `/app/artifacts` | `ArtifactsPage` | CallLayout & Artifact Explorer| Grid/list gallery of all generated documents, code files, and charts. |
| `/app/artifacts/:id`| `ArtifactsPage` | CallLayout & Artifact Viewer | Full-screen deep inspection of an individual artifact with diff and code views. |
| `/app/board` | `BoardPage` | CallLayout & Kanban Board | Ticket board and task management (when enabled). |
| `/app/x/:linkId` | `NavLinkPage` | CallLayout & Embedded Frame | Pinned workspace iframe links or external team resources. |
| `/admin/plugins` | `AdminPluginsPage` | CallLayout & Admin Hub | Workspace-level plugin and integration management. |
| `/admin/access` | `AdminAccessPage` | CallLayout & Admin Access | RBAC, permissions, and member invitation management. |
| `*` | `NotFoundPage` | Standalone Cosmic Error Frame | 404 handler with return-to-orbit link and cosmic planet animation. |

---

## 2. Modal & Overlay Surface Map

The application shell orchestrates modal and side-panel overlays managed via `useShellDialogs()` and `useRightPanel()`:

| Overlay / Modal | Trigger Location | Target Consolidated Experience |
| :--- | :--- | :--- |
| **Settings Overlay** | Sidebar footer / Command palette | Unified **Orbit Preferences Hub** featuring dedicated **Theme & Appearance**, Models, Approvals, Vault, Memory, Voice, and Org tabs. |
| **Agent Studio / Creation** | `+ New Bot` buttons (Expanded & Mini) | Canonical **Orbit Agent Studio** unifying blank bot setup, template blueprints, and avatar customization. |
| **Create Group Panel** | `+ Group` button in sidebar | Slide-over drawer selecting bot participants and establishing collaborative group instructions. |
| **Plugins & Integrations** | `/integrations` or Slash Command | Interactive marketplace for official and partner plugins (MCP servers, Google Workspace, GitHub). |
| **Skills Catalog** | `/skills` or Composer trigger | Curated procedural recipes (Interrogate, Orbit Docs, Data Visualization) injected into agent context. |
| **Command Palette** | `Cmd+K` / `Ctrl+K` | Universal quick switcher for bots, themes, actions, spaces, and routines. |
| **Right Side Panel** | Transcript header / Deck button | Multi-tab container hosting Computer Desktop (noVNC), Pages Preview, and Bot Configuration. |

