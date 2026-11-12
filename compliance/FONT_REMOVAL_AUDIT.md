# Font removal audit

Date: 2026-11-10
Status: removed from the repository and from produced artifacts

## Removed files

| File | Size | SHA-256 | Disposition |
| --- | --- | --- | --- |
| `apps/web/public/assets/font/Corpta DEMO.otf` | 7.4 KB | `dd039d7b41291ff741bb3b301720980ea44a0f5d4752d1321bdec544833130d0` | Moved to a local archive outside the repository. |
| `apps/www/public/fonts/aeonik-medium.woff` | 63 KB | `cfa52bfb7c9df5b5d37bec72d115f232aec6b5c5f119354759e0eb115531df40` | Moved to a local archive outside the repository. |

The archived copies are not tracked, not packaged, and not served. They are kept only as an audit
record until the owner decides whether to delete them.

## Why they were removed

- The Corpta file's metadata identifies a commercial demo typeface with an all-rights-reserved
  notice and no licence grant in the repository.
- The Aeonik file had no licence file or grant in the repository.
- An npm or upstream provenance does not establish a redistribution licence for a font binary.

## Replacements

- **Web application wordmark:** the sidebar now uses the approved
  `apps/web/public/assets/imgs/logo/orbit-wordmark.svg` asset (Poppins semibold with the Orbit
  gradient). The `@font-face` and `.orbit-brand-text` rules were removed from
  `apps/web/src/styles.css`.
- **Web UI type:** Poppins remains the primary interface font, loaded from the existing Google
  Fonts link. System fallbacks remain in the stack.
- **Marketing type:** the `@font-face` for Aeonik was removed from
  `apps/www/src/styles/global.css`. Every `Aeonik, Geist, …` stack now starts with Poppins, and the
  body uses `Poppins, Geist, ui-sans-serif, system-ui, …`. Poppins was added to the Google Fonts
  link in `apps/www/src/layouts/BaseLayout.astro`. Geist and Geist Mono remain for supporting and
  monospace text.
- No new font with unknown licensing was introduced.

## References removed

- `apps/web/src/styles.css`: `@font-face` for “Corpta DEMO”, `.orbit-brand-text` rules, and the
  demo-font override.
- `apps/web/src/pages/shell/sidebar-header.tsx`: text wordmark replaced with the approved SVG.
- `apps/www/src/styles/global.css`: Aeonik `@font-face` and all Aeonik font stacks.
- `apps/www/src/layouts/BaseLayout.astro`: Poppins added to the font request.
- `compliance/assets.json`: both font entries removed.
- `docs/ORBIT_BRAND_SYSTEM.md`: wordmark and marketing typography description updated.
- `docs/LICENCE_COMPLIANCE.md`: font blockers replaced with a removal record.
- `THIRD_PARTY_NOTICES.md`, web public notices, and mobile notices: regenerated; no font assets
  remain.

## Verification

- `find` over the repository excluding `node_modules` and `.git` finds no `.otf`, `.ttf`, `.woff`,
  or `.woff2` files.
- `rg -i 'corpta|aeonik'` finds no reference in application source, marketing source, built web
  bundle, or desktop app resources.
- The web build succeeds.
- The marketing Astro check and build succeed.
- The desktop app is packaged and its resources contain no font binaries or font names.
- Mobile prebuild produces no font binaries.

## Residual work

The Apache-2.0 and third-party notices are regenerated from the current asset inventory. Any future
font must arrive with a reviewed licence file and an asset-manifest entry before it can ship.
