# Orbit Design System

**Project**: Orbit by Forion  
**Version**: 2.0  
**Design Intelligence**: UI UX Pro Max Skill (`dark-mode-oled`, `hud-sci-fi-fui`, Density 8)

---

## 1. Design Philosophy & Foundations

Orbit is built for high-performance AI workspace interaction and autonomous agent orchestration. The design philosophy centers on:
1. **Calm Precision**: The interface recedes into the background, providing deep space contrast that puts user context, code, artifacts, and agent thinking front-and-center.
2. **Deterministic Feedback**: Every agent action, tool call, routine, and state transition provides immediate, legible visual feedback (150-200ms ease transitions).
3. **Cosmic Identity**: A distinct, sophisticated celestial aesthetic with subtle neon and orbital glows that set Orbit apart from generic enterprise dashboards.
4. **Universal Accessibility**: Text contrast ratios meet or exceed WCAG AA (4.5:1 minimum, targeting 7:1+ in OLED modes). All interactive elements support keyboard navigation with visible focus rings.

---

## 2. Cosmic Color Palettes & Semantic Tokens

All UI surfaces strictly derive their colors from semantic CSS custom properties defined in `tokens.css`:

```css
:root {
  --background: /* Canvas background */;
  --foreground: /* Primary text */;
  --card: /* Elevated container background */;
  --card-foreground: /* Text on elevated cards */;
  --popover: /* Dropdowns and dialog backgrounds */;
  --popover-foreground: /* Dropdown text */;
  --primary: /* Key CTA, accent icons, active borders */;
  --primary-foreground: /* Text on primary buttons */;
  --secondary: /* Supporting surface */;
  --secondary-foreground: /* Supporting text */;
  --muted: /* Receded elements, dividers */;
  --muted-foreground: /* Secondary captions, labels */;
  --accent: /* Hover states, subtle indicators */;
  --accent-foreground: /* Hover text */;
  --destructive: /* Destructive actions, errors */;
  --destructive-foreground: /* Text on destructive */;
  --border: /* 1px structural borders */;
  --input: /* Input field background */;
  --ring: /* Keyboard focus outline */;
  --accent-primary: /* Theme signature glow */;
}
```

### The Seven Cosmic Themes:
1. **Deep Space**: `#050508` deep black canvas, `#0a0a0c` card, `#22d3ee` cyan accent.
2. **Nebula**: `#0f0514` cosmic violet canvas, `#16081e` card, `#e879f9` fuchsia accent.
3. **Solar**: `#0e0802` dark bronze canvas, `#180e04` card, `#f59e0b` solar amber accent.
4. **Phantom**: `#000000` OLED pure black, `#050505` card, `#00ff41` terminal matrix green.
5. **Ocean**: `#020d18` deep abyss canvas, `#061526` card, `#0077b6` vibrant azure accent.
6. **Blueprint**: `#070e1b` engineering navy canvas, `#0c182e` card, `#2563eb` cobalt accent.
7. **Cosmic Light**: `#f8fafc` crisp daylight canvas, `#ffffff` card, `#0284c7` high-contrast daytime sky accent.

---

## 3. Typography & Scale

The system supports real-time dynamic typography switching via the `data-font` attribute on the `<html>` root:

| Family Token | Target Font | Mood & Best Use |
| :--- | :--- | :--- |
| `inter` (Default) | `Inter, sans-serif` | Technical precision, optimal for dense data and agent chat. |
| `poppins` | `Poppins, sans-serif` | Modern, friendly, geometric curves. |
| `google-sans` | `Product Sans, Google Sans, sans-serif` | Clean executive clarity, balanced readability. |
| `roboto` | `Roboto, sans-serif` | Classic enterprise standard, compact width. |
| `bricolage-grotesque` | `Bricolage Grotesque, sans-serif` | Expressive editorial flair, distinctive character. |
| `geist-mono` | `Geist Mono, monospace` | Terminal-grade coding layout, developer preference. |
| `space-mono` | `Space Mono, monospace` | Retro-futuristic aerospace aesthetic. |

### Type Hierarchy Scale:
- **Display**: `24px` to `28px` (`font-bold`, tracking `-0.02em`) — Hero headers, brand titles.
- **Title**: `18px` to `20px` (`font-semibold`, tracking `-0.01em`) — Panel titles, modal headings.
- **Section**: `14px` to `15px` (`font-medium`) — Group headers, message author labels.
- **Body**: `13px` to `14px` (`leading-relaxed`) — Message transcript text, dialog descriptions.
- **Caption / Meta**: `11px` to `12px` (`text-muted-foreground`) — Timestamps, token counters, status pills.
- **Micro**: `9px` to `10px` (`font-bold uppercase tracking-wider`) — Badges, HUD indicators.

---

## 4. Spacing & Density Tokens (Density Level 8)

Orbit adopts a high-density, high-utility spacing matrix suited for developer workflows:
- **Base Unit**: `4px`
- **Micro Gaps**: `4px` (`gap-1`), `6px` (`gap-1.5`), `8px` (`gap-2`)
- **Container Padding**: `12px` (`p-3`) to `16px` (`p-4`)
- **Touch & Click Targets**: Minimum `32px` desktop, `44px` mobile.

---

## 5. Component States & Elevation

1. **Rest**: `border border-border/60 bg-card/60 backdrop-blur-md`
2. **Hover**: `border-primary/40 bg-card/90 shadow-sm transition-all duration-150`
3. **Active / Selected**: `border-primary ring-1 ring-primary/30 bg-primary/10 text-primary`
4. **Focus-Visible**: `ring-2 ring-ring ring-offset-2 ring-offset-background outline-none`
5. **Disabled**: `opacity-40 cursor-not-allowed pointer-events-none`

