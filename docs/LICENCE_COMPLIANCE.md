# Licence compliance

This document explains the repository's automated licence checks, the known compliance gaps, and
where notices belong in each distribution. It is an engineering control, not legal advice. A
passing checker does not prove legal compliance.

## Upstream licence

[Rakazo](https://github.com/elie222/rakazo) is licensed under the Apache License, Version 2.0.

| Item | Finding |
|---|---|
| Licence | Apache-2.0 |
| Root `LICENSE` | Present; matches the upstream Apache-2.0 text (`sha256 b9738182…`) |
| Root `NOTICE` | None at the inspected upstream revision |
| Inferred baseline | `b365d73b66e2b7c24d13a12a2e523049925c703f` |
| Baseline confidence | 4,638 of 4,731 local import files match exactly |

The absence of an upstream `NOTICE` means there is no upstream NOTICE attribution to reproduce.
`ATTRIBUTION.md` records the project, URL, licence, and derivative status. Do not invent a
copyright owner or date.

## What the checker does

`scripts/licence-compliance.mjs` is offline and uses the existing Node tooling.

```bash
node scripts/licence-compliance.mjs            # check; warnings do not fail
node scripts/licence-compliance.mjs --ci       # pull-request mode
node scripts/licence-compliance.mjs --release  # release mode; warnings fail
node scripts/licence-compliance.mjs --write    # regenerate reports and THIRD_PARTY_NOTICES.md
node scripts/licence-compliance.mjs --json     # machine-readable output
```

It checks:

- `LICENSE` exists and contains Apache-2.0.
- `ATTRIBUTION.md` names Rakazo and its Apache-2.0 licence.
- `THIRD_PARTY_NOTICES.md` exists and contains the required attribution and modification statement.
- `compliance/upstream-baseline.json` and `compliance/provenance.json` exist and are readable.
- The modification-notice policy exists; release mode requires it to be approved.
- Installed dependencies have known licences; restrictive or unknown licences are flagged.
- New direct dependencies and licence changes are compared with the dependency baseline.
- Bundled assets are covered by `compliance/assets.json`; blocked and unreviewed assets are flagged.
- The provenance inventory separates upstream-unmodified, upstream-modified, moved/copied, and
  locally added files.

Hard errors fail both normal and release checks. Warnings fail only `--release`. The intent is to
keep ordinary feature development moving while making release decisions explicit.

## Provenance method

The local repository is a squashed import with unrelated history. Exact Git blob matches identify
the most likely upstream baseline; the checker does not use a merge base.

`compliance/provenance.json` classifies every tracked file:

- `upstream-unmodified` — same path and blob as the baseline.
- `upstream-modified` — same path, different content.
- `upstream-moved-or-copied` — absent at this path but the blob exists upstream.
- `locally-added` — absent from the baseline.
- `upstream-deleted` — present in the baseline, absent locally.

Files marked `upstream-modified` need a change notice before source redistribution. The exact
Section 4(b) placement is pending legal review in
`compliance/modification-policy.json`. Do not treat this repository as release-cleared while that
policy is pending.

## Dependency and asset inventory

`compliance/dependency-licenses.json` is generated from `pnpm licenses list --json` plus every
workspace `package.json`. Desktop, mobile, and marketing packages are not installed by the root
workspace lockfile; their declared dependencies are reported as `not-installed` until a job
installs them. That is a coverage warning, not a licence conclusion.

`compliance/assets.json` is the reviewable asset manifest. `THIRD_PARTY_NOTICES.md` is generated
from both inventories. Fonts, product marks, screenshots, and binary downloads are the highest-risk
items; package-manager licence scanning alone cannot clear them.

## Known outstanding items

These require human or legal review before a public or commercial distribution:

1. **Modification notices** — the Section 4(b) policy is pending legal review.
2. **Desktop and mobile dependency inventories** — those packages were added to the root pnpm
   workspace in this sprint; the checker must be rerun against the installed artifacts.
3. **Assets not covered by the manifest** — the checker warns about any asset it does not recognize;
   add a reviewed entry rather than accepting the warning.

The unlicensed Corpta and Aeonik font files were removed from the repository and from built
artifacts. The sidebar wordmark now uses the approved `orbit-wordmark.svg`; the marketing site uses
Poppins. The inherited marketing illustrations, third-party product marks, provider logos, and
comparison screenshots were archived with their pages.

## Distribution targets

### Desktop installers

`apps/desktop/package.json` packages the Electron app. Before shipping, the installer must include
`LICENSE`, `ATTRIBUTION.md`, `THIRD_PARTY_NOTICES.md`, and
`compliance/modified-files.md` (for example through `extraResources`) and expose them in the app's
legal/about surface. The checker's release mode is a gate; packaging is a separate build step that
must be verified on the actual installer.

### Mobile distributions

The mobile app is distributed through app stores. Include `LICENSE`, `ATTRIBUTION.md`,
`THIRD_PARTY_NOTICES.txt`, and `compliance/modified-files.md` in the app's licence/legal screen and
in the app bundle. Keep the Apache-2.0 text and attribution available after install. Store listing
text is not a substitute for in-app notices.

### Web frontend bundles

A web bundle is distributed to browsers. Serve `NOTICE`, `LICENSE`, `ATTRIBUTION.md`,
`THIRD_PARTY_NOTICES.md`, and `compliance/modified-files.md` from the deployed bundle. A source map
or repository link is not a substitute for the notice page.

### Docker and container distributions

Images are distributed software. Copy `LICENSE`, `ATTRIBUTION.md`, and `THIRD_PARTY_NOTICES.md`
into the image (for example `/usr/share/doc/orbit/`) and keep the files in the image layers. Do not
rely on the repository being reachable from the running container.

### Backend-only SaaS

A private backend that is not distributed does not trigger the same distribution obligations as an
installer or app bundle, but the repository must still preserve the licence and attribution for
any distributed client or source archive. Do not remove notices because a server is hosted.

## Updating the inventories

```bash
# Refresh reports after a dependency or asset change
pnpm install
node scripts/licence-compliance.mjs --write

# Refresh the upstream and dependency baselines after a reviewed integration
node scripts/licence-compliance.mjs \
  --update-baseline \
  --upstream-dir <local-rakazo-clone> \
  --upstream-ref <reviewed-commit> \
  --write
```

Review the diff. The checker is a guardrail, not an automatic legal approval.
