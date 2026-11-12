# Upstream workflow

Orbit Bot is a derivative of [Rakazo](https://github.com/elie222/rakazo), licensed under
Apache-2.0. We keep the upstream repository as a read-only source of selected improvements. We do
not publish a fork, merge upstream wholesale, or overwrite Forion-specific work.

## One-time setup for a new clone

```bash
git clone <your-origin-url> orbitbot
cd orbitbot
bash scripts/setup-upstream.sh
```

The setup script is not tracked yet. A fresh clone of the current public history does not contain
it. Until a reviewed change adds it, obtain the script from the review artifact or the local archive
and run it from the clone root. Do not commit it only to make a fresh clone work.

The script:

- finds the repository root;
- adds `upstream` only if it is missing;
- verifies the fetch URL is `https://github.com/elie222/rakazo.git`;
- sets the `upstream` push URL to `no_push`;
- checks that `origin` was not changed;
- is idempotent and refuses to replace an unexpected existing `upstream` URL.

Verify without changing anything:

```bash
bash scripts/setup-upstream.sh --check
bash scripts/setup-upstream.sh --dry-run
```

The push URL is a local guard, not an unchangeable security boundary. Anyone who can edit the
clone can deliberately override it. The repository must never be given Rakazo write credentials.

## Baseline

The local history is a squashed import, so it has no common ancestor with upstream history. The
compliance baseline records the upstream commit whose files best match the local import:

| Item | Value |
|---|---|
| Upstream | `https://github.com/elie222/rakazo.git` |
| Inferred baseline commit | `b365d73b66e2b7c24d13a12a2e523049925c703f` |
| Local import commit | `02ae9e7` |
| Exact file-hash matches | 4,638 of 4,731 files |
| Local-only files at import | 23 |

The match is strong evidence, not a legal conclusion. The machine-readable baseline is
[`compliance/upstream-baseline.json`](../compliance/upstream-baseline.json).

## Fetching upstream

```bash
git fetch upstream main --no-tags
```

`git fetch` does not modify the working tree. No merge, rebase, or cherry-pick runs automatically.

## Reviewing incoming changes

Because the histories are unrelated, compare against the recorded baseline rather than using a
three-dot merge-base diff:

```bash
# Commits added upstream since the baseline
git log --oneline --no-merges b365d73b66e2b7c24d13a12a2e523049925c703f..upstream/main

# Files changed upstream since the baseline
git diff --stat b365d73b66e2b7c24d13a12a2e523049925c703f..upstream/main

# One commit, including its changed files
git show --stat --oneline <commit>
git show <commit> -- path/to/file
```

Do not use `git merge upstream/main` or `git rebase upstream/main` as the default integration
route. Upstream's tree and ours have diverged and a merge would put unrelated history and
Forion-specific files at risk.

## Integrating a selected commit

Use a short-lived integration branch:

```bash
git switch -c integrate/<short-topic>
git cherry-pick -x <upstream-commit>
```

`-x` records the upstream commit in the new commit message. Resolve conflicts with both sides in
mind:

- Keep Forion naming, Orbit branding, provider-neutral contracts, and local security changes.
- Do not replace a Forion-specific file just because upstream changed the original.
- If the change touches a file classified `upstream-modified` in
  [`compliance/provenance.json`](../compliance/provenance.json), review the local changes first.
- If a change depends on an upstream migration, follow the repository's deferred-migration rules.
- Do not edit `CHANGELOG.md` in a feature PR.

Run the relevant checks before opening the PR:

```bash
pnpm check
pnpm test -- <targeted tests>
pnpm --filter @forion/orbit-web build
pnpm --filter @forion/orbit-api build
node scripts/licence-compliance.mjs --ci
pnpm --filter @forion/orbit-www check
```

The desktop Playwright suite opens real Electron windows and should not be run routinely on a
maintainer's machine; CI's virtual-display job owns it.

## Updating the baseline

Only after an integration is reviewed and merged:

```bash
node scripts/licence-compliance.mjs \
  --update-baseline \
  --upstream-dir <path-to-a-local-bare-or-clone-of-rakazo> \
  --upstream-ref <reviewed-upstream-commit> \
  --write
```

Commit the regenerated `compliance/upstream-baseline.json`,
`compliance/dependency-licenses.baseline.json`, and reports in the same PR that records the
decision. Do not update the baseline merely because upstream moved.

## Safety rules

- Never push to `upstream`.
- Never push to `origin` without explicit approval.
- Treat repository visibility as a security decision. The history currently contains private infrastructure metadata; see `security/INCIDENT_ASSESSMENT.md`.
- Never merge or cherry-pick automatically.
- Never rewrite history to hide provenance.
- Keep `ATTRIBUTION.md`, `LICENSE`, and `THIRD_PARTY_NOTICES.md` intact.
