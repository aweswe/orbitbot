# Orbit Backend Experience Opportunities

**Project**: Orbit by Forion  
**Date**: November 2026  
**Auditor**: Principal Product Designer & UI/UX Architect  
**Branch**: `stabilize/orbit-ui-ux-reinvention`

---

## 1. Overview of Underutilized Backend Power

Orbit’s backend (`packages/adapters`, `packages/db`, and `apps/api`) provides an enterprise-grade agent harness that surpasses conventional chat interfaces. However, several high-value backend capabilities were previously obscured or under-represented in the user interface:

| Backend Capability | Existing Infrastructure in Codebase | Previous UI Experience | Elevated Target Experience |
| :--- | :--- | :--- | :--- |
| **Real-time Tool Execution Streams** | `ThreadEvents`, `RunLease`, `task.activity`, step-by-step tool inputs/outputs | Raw status strings or basic loading states | **Live Tool Execution Timeline**: Interactive collapsible cards displaying tool type, status pill (running/success/failed), runtime duration, and clean formatted payload previews. |
| **Artifact Generation & History** | `artifacts` table, `ArtifactFileCard`, markdown file extractions | Basic link in sidebar or chat bubble | **Integrated Artifact Deck**: Direct tab in the right panel showing generated SVGs, code files, and charts with one-click full-screen inspection, download, and copy actions. |
| **Scheduled Routines & Triggers** | `run-routines.ts`, cron expressions, background jobs | Dedicated sub-page requiring several clicks | **Routine Status & Quick Run Chips**: Direct routine triggers within bot chat headers and action suggestions. |
| **Model Thinking & Reasoning Traces** | `thinkingLevel` in `run-model.ts`, `ThinkingSignatures` | Raw thinking text or collapsed single block | **HUD Thinking Visualizer**: Dedicated collapsible reasoning accordion with elapsed time, token count estimation, and step breakdown. |
| **Persistent Cloud Computer (Sandbox)** | Docker/Wuying sandboxes, noVNC streaming, port forwarding | Buried in computer panel with raw connect status | **Live Sandbox Status Indicator**: Elevated status pill in chat header indicating sandbox health (Running, Memory, Active Port). |
| **Collaborative Multi-Agent Handoffs** | `run-tools-fleet.ts`, `child_bot` spawn events, `foldPeerReplies` | Indistinguishable peer replies | **Visual Handoff Badges**: Distinctive creature/avatar badges showing which agent handed off context and why. |

---

## 2. Immediate Implementation Opportunities in this Redesign

1. **Tool Execution Timeline Component**:
   Borrowing design patterns from original Orbit's `src/components/chat/ToolCallTimeline.tsx` and adapting them to Orbit Bot's real-time events.
2. **Inline Diagram Engine & Interactive Preview**:
   Leverage `SvgDiagram` and Mermaid rendering inside message cards so architectural flowcharts and entity diagrams render natively with zoom and code view toggles.
3. **Orbit Appearance Hub**:
   Expose all 7 cosmic themes, 11 font choices, and density parameters in a dedicated, first-class Settings panel with live hot-reloading.

