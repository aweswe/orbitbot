# Orbit Bot handoff — 2026-11-14

We cannot work on this device anymore. We have to switch.

## Branch and commits

- Handoff branch: `handoff/orbitbot-final-2026-11-14`
- Source branch: `fix/orbit-e2e-green-gate`
- Code commit before this handoff file: `8c35edde001de9fe3c828a78c9b73e6c44c36402`
  (`feat(dev): add explicit shared staging database mode`)
- Earlier pushed commits on the same branch: `af60b61`, `a254897`, `464b086`

The handoff commit containing this file has its own SHA; the pushed branch head is the final
handoff SHA reported with the push.

## Live process and port state at handoff

- Orbit Bot API: `:3100` running.
- Orbit Bot web: `:5173` running.
- Orbit Bot was started with `ORBIT_DEV_SHARED_DB=1`, so it reads and writes the configured
  shared Supabase staging database in schema `orbit_bot`, not a per-branch copy.
- Staging data before handoff: 4 users, 3 bots, 19 messages.
- Five pending migrations were applied additively to `orbit_bot`:
  `20261202120000_schema_scoped_grants`, `20261202120100_billing_audit_schema_fix`,
  `20261203120000_reconciler_leases`, `20261204000000_credit_reservations_and_settlement_outbox`,
  `20261204120000_identity_mappings`.
- New tables now present: `reconciler_leases`, `credit_reservations`, `settlement_outbox`,
  `identity_mappings`.
- Orbit Chat `:3000` was running the peer’s patched checkout.
- Forion `:3001` was unhealthy (503) at handoff and was not restarted; the process may still be
  running but should be treated as requiring a restart.

## Verified

- Cross-device account restore: the new `apps/web/e2e/account-history-sync.spec.ts` creates a
  bot and message in one isolated browser context, signs into a second isolated context with the
  same account, and sees the bot and history. It passes.
- Full Chromium E2E gate: 294 passed / 1 failed / 8 skipped. The single failure was an
  `activity-list` keyboard-focus flake, fixed and green 3/3 on rerun. An earlier `message-jump`
  flake was fixed and green 2/2.
- Web unit suite: 1,984 passed across 224 files.
- Web app and E2E TypeScript checks pass.
- The 8 skips are page-browser helper tests that need the pinned Linux `agent-browser` binary.

## Not verified / caveats

- Google sign-in and history restore on the live staging database were not exercised
  end-to-end here; the database contents and cross-device API contract were verified.
- The staging API currently connects as `postgres`, which has `BYPASSRLS`. Row-level security is
  not enforced until `DATABASE_URL` points at a dedicated runtime login.
- No working Orbit Bot cloud endpoint was found: `orbit.forion.dev` redirects to
  `orbit.forion.ai`, which is Orbit Chat; the documented Orbit Bot hosts have no DNS.
- Local-computer permission and pairing were not rerun in this pass.
- Forion `:3001` was returning 503 and needs a restart with the latest cherry-pick.
- The full E2E gate is 294/1 with the sole failure fixed and rerun green, not a literal
  one-run zero-failure result.

## Blockers before a real cross-device cloud launch

1. Deploy one Orbit Bot API/web/worker backend and point desktop `RAKAZO_CLOUD_URL`, mobile
   `EXPO_PUBLIC_API_URL`, and the web deployment at that one origin.
2. Give that backend a dedicated runtime database login so RLS is enforced.
3. Restore Forion health and rerun the live gates.
4. Complete the P0 secret rotation and repository privacy actions in `HUMAN_ACTIONS.md`.
5. Re-run the live cross-device test with a real Google account on the deployed backend.

## Resume commands

```bash
git switch handoff/orbitbot-final-2026-11-14
ORBIT_DEV_SHARED_DB=1 pnpm dev
```

No service was restarted or debugged after this handoff was requested.
