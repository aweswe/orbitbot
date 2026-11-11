#!/usr/bin/env bash
# Configure the official Rakazo repository as a read-only upstream remote.
#
# Usage:
#   bash scripts/setup-upstream.sh             # configure this clone
#   bash scripts/setup-upstream.sh --dry-run   # print what would change
#   bash scripts/setup-upstream.sh --check     # verify, change nothing
#
# This is local Git configuration, not a security boundary: anyone with write access to the
# clone can deliberately override it. The script never fetches, merges, cherry-picks, or pushes.
set -euo pipefail

UPSTREAM_URL="${UPSTREAM_URL:-https://github.com/elie222/rakazo.git}"
UPSTREAM_PUSH_URL="${UPSTREAM_PUSH_URL:-no_push}"
MODE="apply"
case "${1:-}" in
  --dry-run) MODE="dry-run" ;;
  --check) MODE="check" ;;
  "") ;;
  *)
    echo "Unknown option: $1" >&2
    echo "Usage: bash scripts/setup-upstream.sh [--dry-run|--check]" >&2
    exit 2
    ;;
esac

if ! root="$(git rev-parse --show-toplevel 2>/dev/null)"; then
  echo "setup-upstream: run this inside a Git clone." >&2
  exit 1
fi
cd "$root"

origin_fetch_before="$(git remote get-url origin 2>/dev/null || true)"
origin_push_before="$(git remote get-url --push origin 2>/dev/null || true)"
upstream_fetch="$(git config --get remote.upstream.url 2>/dev/null || true)"
upstream_push="$(git config --get remote.upstream.pushurl 2>/dev/null || true)"

normalize() {
  local url="$1"
  url="${url%/}"
  url="${url%.git}"
  printf '%s' "$url"
}

echo "Repository: $root"
echo "Origin fetch: ${origin_fetch_before:-<missing>}"
echo "Origin push:  ${origin_push_before:-<missing>}"

if [[ -n "$upstream_fetch" ]] && [[ "$(normalize "$upstream_fetch")" != "$(normalize "$UPSTREAM_URL")" ]]; then
  echo "Refusing to replace an existing upstream remote with an unexpected URL:" >&2
  echo "  current: $upstream_fetch" >&2
  echo "  wanted:  $UPSTREAM_URL" >&2
  echo "Review it, then run: git remote set-url upstream $UPSTREAM_URL" >&2
  exit 2
fi

if [[ -z "$upstream_fetch" ]]; then
  echo "upstream: missing; will add $UPSTREAM_URL"
  if [[ "$MODE" == "check" ]]; then
    echo "setup-upstream: FAILED (upstream is not configured)" >&2
    exit 1
  fi
  if [[ "$MODE" == "apply" ]]; then
    git remote add upstream "$UPSTREAM_URL"
  fi
else
  echo "upstream: fetch URL is already $UPSTREAM_URL"
fi

if [[ -z "$upstream_push" ]] || [[ "$upstream_push" != "$UPSTREAM_PUSH_URL" ]]; then
  echo "upstream: disabling pushes with push URL '$UPSTREAM_PUSH_URL'"
  if [[ "$MODE" == "check" ]]; then
    echo "setup-upstream: FAILED (upstream push URL is not disabled)" >&2
    exit 1
  fi
  if [[ "$MODE" == "apply" ]]; then
    git remote set-url --push upstream "$UPSTREAM_PUSH_URL"
  fi
else
  echo "upstream: push URL is already disabled ('$UPSTREAM_PUSH_URL')"
fi

origin_fetch_after="$(git remote get-url origin 2>/dev/null || true)"
origin_push_after="$(git remote get-url --push origin 2>/dev/null || true)"
if [[ "$origin_fetch_before" != "$origin_fetch_after" ]] || [[ "$origin_push_before" != "$origin_push_after" ]]; then
  echo "setup-upstream: origin changed unexpectedly; refusing to continue." >&2
  exit 3
fi

if [[ "$MODE" == "check" ]]; then
  echo "setup-upstream: upstream is configured and origin is unchanged."
  exit 0
fi

echo
if [[ "$MODE" == "dry-run" ]]; then
  echo "Dry run: no Git configuration was changed. Origin was not changed."
  echo "Run without --dry-run to apply."
else
  echo "Configured. Origin was not changed."
  echo "Next: git fetch upstream main --no-tags"
  echo "Verify: git remote -v"
  echo "A push through upstream is expected to fail because its push URL is '$UPSTREAM_PUSH_URL'."
  echo "This is local configuration, not a security boundary."
fi
