# Orbit brand system

Orbit is the customer-facing product identity; Forion is the company and underlying platform. Orbit Bot is an Orbit product powered by Forion. The separate main Orbit application is the source of truth for this identity. Orbit Bot reuses
its logo assets, app-icon treatment, colour language, and wordmark instead of inventing a second
brand. Do not copy application architecture from the main app; only the brand primitives are
shared where Orbit Bot's component model allows it.

## Logo

The canonical mark is the planet-and-orbit PNG pair already used by the main Orbit app:

- `apps/web/public/assets/imgs/logo/dark-logo.png` — dark mark for light surfaces
- `apps/web/public/assets/imgs/logo/white-logo.png` — white mark for dark surfaces
- `apps/web/src/components/OrbitLogoMark.tsx` — theme-aware shared mark component

Use `OrbitLogoMark` for the header, auth, loading and public-page surfaces. Use
`OrbitVectorMark` only where a `currentColor` SVG is required. Do not substitute the Orion
constellation, the Rakazo mascot, or a generated glyph.

The wordmark is `ORBIT` in the shared brand gradient: accent → pink → orange. The
`.orbit-gradient-text` utility lives in `packages/ui-web/src/styles.css`; the gradient stops are
provided by the theme (`--accent-primary`, `--orbit-grad-via`, `--orbit-grad-to`).

## App icon

The app icon follows the main Orbit platform icon: a cyan-to-violet gradient rounded square with
a dark inset and a white “O”. The same artwork is used for:

- web favicons, PWA icons and the Apple touch icon
- Electron/Windows/Linux icons
- the Apple Icon Composer source (`packages/ui-tokens/assets/Orbit.icon`)
- Expo app, adaptive, monochrome and notification icons

The vector favicon is copied from the main Orbit app. The legacy `orange-bot.png` remains only as
the source artwork for the logo-derived bot avatar tests; it is not an app icon.

## Colour

Orbit Bot uses the shared neutral shadcn-style surface system, not arbitrary per-component
colours. The default themes mirror the main Orbit themes:

| Token | Light | Dark |
|---|---|---|
| background | `#ffffff` | `#050508` |
| surface/card | `#f4f4f5` | `#0a0a0c` |
| foreground | `#18181b` | `#fafafa` |
| muted foreground | `#52525b` | `#a1a1aa` |
| accent / primary | `#0891b2` | `#22d3ee` |
| border | `rgba(0,0,0,0.08)` | `rgba(255,255,255,0.08)` |
| focus ring | `rgba(24,24,27,0.22)` | `rgba(255,255,255,0.32)` |

Status colours remain semantic (`success`, `warning`, `destructive`). Bot identity colours live
on the bot avatar, not in app chrome. The optional cosmic themes (Nebula, Solar, Phantom, Ocean,
Blueprint) retain their existing product-specific values; Deep Space and Cosmic Light are the
brand-aligned defaults.

Tokens are defined in `packages/ui-tokens/src/index.ts` and generated into
`packages/ui-tokens/src/tokens.css`. The web shell's legacy theme bridge lives in
`apps/web/src/styles.css`; change the shared token source first, then the bridge only where it
maps a legacy variable.

## Typography

- **Default UI:** Poppins, matching the main Orbit web app. The web bootstrap sets
  `data-font="poppins"` before first paint; users can choose another font in Settings.
- **Brand wordmark:** the approved `orbit-wordmark.svg` asset (Poppins semibold with the Orbit
  gradient) is used in the sidebar. The former demo typeface was removed; no unlicensed font is
  bundled with the product.
- **Code and metadata:** the existing monospace stack from `@forion/orbit-ui-tokens` and
  `packages/ui-web`.

Do not replace fonts globally for visual novelty. The type scale remains the shared semantic
scale (`text-caption`, `text-label`, `text-body`, `text-heading*`).

## Component conventions

- Use semantic tokens (`bg-background`, `text-foreground`, `border-border`, `bg-card`,
  `text-muted-foreground`, `ring-ring`) instead of hardcoded cyan/indigo/white values.
- Use the shared `OrbitLogoMark`; do not inline a second logo implementation.
- Use the shared `.orbit-gradient-text` for the wordmark; do not repeat gradient hex values in
  components.
- Keep radii on the established token scale. Brand changes should not restyle unrelated
  controls.
- Preserve runtime compatibility identifiers: environment variables, request headers, storage
  keys, native module names, bundle identifiers, container labels and database roles are not
  branding.

## Surface checklist

Updated in this pass:

- authentication and sign-up
- workspace sidebar lockup
- chat header mark
- loading state
- PWA manifest and icons
- web favicon and Apple touch icon
- desktop, mobile and notification icons
- transactional email copy (already Orbit)
- Android download page copy

## Known gaps

- `apps/www` now carries only Orbit product pages: home (and locale aliases), About, Pricing,
  Brand, Download, Support, Privacy, Terms, 404, and one self-hosting blog guide. The inherited
  Rakazo docs, comparison, integration, sandbox, voice-provider, plugin, and competitor-blog
  pages were archived; `apps/www/vercel.json` redirects those routes to the Orbit home or the
  external documentation site.
- Documentation under `docs/` still contains Rakazo product prose and runtime identifiers; see
  `docs/DOCUMENTATION_MIGRATION.md`.
- The optional cosmic themes are product-specific; only Deep Space and Cosmic Light were
  re-checked against the main Orbit palette.
- The marketing site now uses Poppins as its primary typeface, with Geist and Geist Mono retained
  for supporting and monospace text. The unlicensed Corpta and Aeonik files were removed.

## Validation screenshots

- [Light sign-up](brand/orbit-auth-light.png)
- [Dark sign-up](brand/orbit-auth-dark.png)

These were rendered from the local dev server with an empty browser profile and service workers
blocked, so they show the first-load theme rather than a cached older shell.
- [Mobile sign-up](brand/orbit-auth-mobile.png)
- [Chat surfaces, dark fixture](brand/orbit-chat-dark-fixture.png) — the repository's
  `/e2e/fixtures/gallery.html` transcript, used to check chat styling without a live account.
- [Marketing home, desktop](brand/orbit-marketing-home.png)
- [Marketing home, mobile](brand/orbit-marketing-mobile.png)
