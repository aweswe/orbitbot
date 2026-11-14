#!/usr/bin/env bash
# Scan only tracked files. The working tree contains node_modules, build output,
# and local data; gitleaks would otherwise scan hundreds of megabytes of noise.
set -euo pipefail

root="$(git rev-parse --show-toplevel)"
tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT

if ! command -v gitleaks >/dev/null 2>&1; then
  echo "gitleaks is required. Install it from https://github.com/gitleaks/gitleaks/releases" >&2
  exit 1
fi

git -C "$root" ls-files -z | rsync -a --files-from=- --from0 "$root/" "$tmp/"
gitleaks detect \
  --source "$tmp" \
  --no-git \
  --redact \
  --config "$root/.gitleaks.toml" \
  --verbose
