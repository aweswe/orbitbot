# Font removal audit

Date: 2026-11-14
Status: removed from git HEAD; production artifacts must be rebuilt before distribution

## Correction

An earlier version of this record, dated 2026-11-10, stated that both fonts had been removed and
were no longer tracked, packaged, or served. That was false: both files remained tracked in
`aweswe/orbitbot`, were publicly downloadable, and were present in the then-built `Orbit.app`.
This record replaces that claim. The files were actually deleted from HEAD on 2026-11-14.

## Removed files

| File | Size | SHA-256 | Disposition |
| --- | --- | --- | --- |
| `apps/web/public/assets/font/Corpta DEMO.otf` | 7.4 KB | `dd039d7b41291ff741bb3b301720980ea44a0f5d4752d1321bdec544833130d0` | Deleted from git. Any archived copy stays outside the repository. |
| `apps/www/public/fonts/aeonik-medium.woff` | 63 KB | `cfa52bfb7c9df5b5d37bec72d115f232aec6b5c5f119354759e0eb115531df40` | Deleted from git. Any archived copy stays outside the repository. |

## Why they were removed

- The Corpta file's metadata identifies a commercial demo typeface with an all-rights-reserved
  notice and no licence grant in the repository.
- The Aeonik file had no licence file or grant in the repository.
- An npm or upstream provenance does not establish a redistribution licence for a font binary.

## Replacements

- Web UI: Poppins remains the primary interface font from the existing Google Fonts link; the
  wordmark uses the approved SVG asset. No replacement font file is tracked.
- Marketing: Poppins remains in the stacks; no Aeonik `@font-face` or stack remains.
- No new font with unknown licensing was introduced.

## Verification

- `git ls-files` contains neither font filename.
- `scripts/check-shipped-assets.mjs` fails on either filename or hash in tracked files, builds,
  or packaged desktop output.
- The check is wired into the production build job. Existing local builds and the previously
  packaged `Orbit.app` are stale and must be rebuilt; they still contain the old font.
