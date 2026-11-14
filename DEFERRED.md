# Deferred work

Items below are deliberately not in the cloud-chat launch. Each names what
exists, what is missing, and the condition that unblocks it. Nothing here is
silently assumed shipped.

## Desktop + device control (Stage 4)

Exists: Electron shell, hosted-origin setup, device-login file, single-origin
web bundle, Electron fuses, signed-release workflow, 4 Electron E2E specs.

Missing:
- Outbound-only device agent with server-signed, short-lived, replay-protected
  commands; per-bot `cloud` vs `device:<id>` target chosen by the server.
- Permission scopes (folder read/read-write, shell allowlist, app/screen
  control), default deny, per-action approval, hard blocks for `~/.ssh`,
  keychains, browser profiles, credential stores, and system directories.
- Append-only local audit log, tray pause/kill switch, idle auto-revoke,
  web revoke, visible control indicator.
- Packaged Electron E2E: install, pairing, update signature, tamper rejection,
  sleep/wake, multi-display, scope denial, kill switch, uninstall cleanup.
- Injection/escape corpus covering malicious pages, email, and files.

Blocked by: Apple Developer ID/notarization and Windows signing credentials, a
clean Mac and Windows runner, and the Stage 1-3 gates. Do not ship the current
`SANDBOX_PROVIDER=desktop` path as a consumer feature; cloud-only mode now
refuses it.

## Mobile

Deferred unless explicitly un-deferred. Affected identity and packaging files:
`apps/mobile/app.json`, `apps/mobile/app.config.ts`, `apps/mobile/eas.json`,
`apps/mobile/app/+native-intent.tsx`, and the mobile screenshot/EAS workflows.
The `com.rakazo.app` bundle ids, `rakazo://` scheme, app group, and Expo owners
still need the Orbit rebrand before an app-store release.

## Stage 2 expansion

- Firefox and WebKit Playwright projects; the current config runs Chromium only.
- Prompt-injection corpus wired to cloud tools (web, email, file text).
- Memory per-space isolation through the full stack.
- E2B preview URL expiry, idle teardown, and frame-ancestors E2E.
- Worker/DB/Redis chaos suite and a Playwright-driven 30-bot load.
- Six-to-twelve-hour soak and 20 consecutive full runs (wall-clock gates).
- LCP/TTI, first-token latency, bundle-size, and heap-growth budgets.

## Product controls

- Per-bot credit budget and group-level pause/resume are not implemented. The
  sender router and 30-bot cap are; an account-level spending limit exists.
  Adding per-bot budgets needs an expand-only migration, enforcement before a
  run starts, usage aggregation per bot, and UI tests.
- Group speaker policy is fixed by D8 (at most three responders, mentions
  bypass). There is no configurable alternative.
