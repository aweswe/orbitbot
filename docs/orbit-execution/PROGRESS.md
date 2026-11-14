# Orbit execution progress

Pinned audit: `ORBIT_AUDIT_2026-11-14.md` (orbitbot@c3bd4da). Work branches: `feat/orbit-phase0-containment` (Orbit Bot), `feat/orbit-billing-authority` (Forion).

## Phase 0 — containment

| Task | Status | Evidence |
|---|---|---|
| T0.1 Human rotation checklist | Done | `HUMAN_ACTIONS.md` |
| T0.2 Remove tracked secrets at HEAD | Done | `inspect-auth.mjs` deleted; 7 DSNs redacted in two docs |
| T0.3 Remove hardcoded internal-secret fallbacks; fail closed | Done | `forion-internal-secret.ts`; `run-model.ts`; `pi-runtime-stream.ts`; API/worker boot checks; 64 focused tests pass |
| T0.4 Secret scanning (pre-commit + CI) | Done | `.gitleaks.toml`, `scripts/secret-scan.sh`, `.githooks/pre-commit`, `.github/workflows/secret-scan.yml` |
| T0.5 Gate | Done | gitleaks: no leaks in 33.55 MB tracked; `pnpm test:pi` 21/21; secret/env 64/64; adapters/api/worker `tsc --noEmit` pass |

## Phase 1 — hermetic harness + billing invariants

| Task | Status | Evidence |
|---|---|---|
| T1.1 Hermetic unit harness | Done | `orbit-adversarial-gate.test.ts` no longer reads `.env` or calls Forion; DB half gated on `VERIFY_DATABASE`; `pin-test-env.ts` and `harness.ts` clear billing vars; `scripts/check-test-hermeticity.mjs` wired into `pnpm test` |
| T1.2 Fake gateway + wallet harness | Done | `packages/testkit/src/fake-forion-gateway.ts`: HMAC v3 verification, wallet/reservation ledger, fault injection. 7 gateway tests plus a two-pass 30-bot soak |
| T1.3 Cross-service invariant suite | Done | I1-I8 mapped in `docs/billing/INVARIANTS.md`; I4/I6 now green after Phase 2 |
| T1.4 Gate | Done | Full suite 23,240 passed / 1,064 skipped / 0 failed; wallet spec 8/8 against a fresh pgvector DB |

## Phase 2 — single billing authority

| Task | Status | Evidence |
|---|---|---|
| T2.1 Per-reservation ledger validation | Done | Forion `cb90b5d4`: reservation validated under `FOR UPDATE`; commit/refund no longer trust the user-wide bucket |
| T2.2 Locked-credit cap + TTL | Done | 5-minute per-call TTL with streaming heartbeat; lock cap derived from 30 × 500 = 15,000 (`a9b6b1d5`) |
| T2.3 One pricing function | Hosted done | Gateway `usdToCredits` is authoritative for hosted calls; legacy self-host math remains outside the closed path |
| T2.4 Observer telemetry-only | Done | `model-credit-observer.ts`: hosted mode never locks/settles; 4/4 tests |
| T2.5 Durable gateway outbox / request IDs | Done | Forion `d2023125` request IDs/view; A3 outbox + dead-letter + drain job; 3/3 crash/idempotency tests |
| T2.7 Request correlation | Done | Migration 0015, `x-request-id` on Orbit→gateway calls, reconciliation view with zero-drift fuzz |
| T2.6 Hot-chat revenue leak (BILL-10) | Done | Forion `8ddd479c`: real lock + per-run overage key |
| T2.8 Gate | Done hosted | I1-I4, I6-I10 green in hosted mode; I5 local. 30-concurrent fuzz and twice-run 30-bot soak show zero locked-credit drift |

## Phase 3 — cloud-only server policy

| Task | Status | Evidence |
|---|---|---|
| T3.1 Model/provider/import gate | Done | `ORBIT_CLOUD_ONLY` boot check; `refuseCloudOnly` on models.connect/probe/OAuth; agent import strips third-party keys |
| T3.2 Aux model routing | Done hosted | Every AI path is tagged (`billing-paths.ts`); direct OpenRouter/TypeSafe decisions and Cursor cloud agents are cloud-disabled; judge calls use the gateway |
| T3.3 Voice/memory/media disabled | Done | Voice + memory connect routes reject; media factory returns undefined; memory factory forces Forion |
| T3.4 Identity/RLS/HMAC hardening | Done code-side | HMAC v3 binds the canonical body and nonce; replay cache rejects reused signatures; Orbit runtime/migration roles + RLS cross-tenant test exist; canonical user mapping migration `20261204120000_identity_mappings`. Enforcement flags remain human-owned |
| T3.5 Catalog from Forion | Done | Composer lists `models.list` and saves the main role; Custom model surface removed; Standard/Deep maps thinking level |
| T3.6 Gate | Done code-side | Cloud-only env tests 60/60; signed-body/replay tests 56/56; adapters + API tsc pass. Hosted flag flip is in `HUMAN_ACTIONS.md` |

## Phase 4 — web alpha / managed execution

Status: cloud-side defaults done; hosting remains blocked on human IAM/E2B credentials.
`ORBIT_CLOUD_ONLY=true` now defaults the sandbox to `e2b` and refuses `desktop`/`docker`;
the Cloud Run command carries both flags. Single hosted origin and device login are
documented and wired. Remaining human work: Cloud Run IAM/DNS, E2B production key, quotas.

## Phase 5 — group scale

Status: **done.** Speaker router selects at most three responders per unaddressed
message; explicit mentions and replies bypass it. `GROUP_MEMBER_MAX=30` across contracts,
API, database validation, fleet tools, web, and mobile. Credit calls retry 429/5xx with
`Retry-After` and jitter, and the rate bucket no longer resets its refill clock. A
30-bot soak with targeted faults runs twice with zero locked-credit drift (`1fc1fe1`).

## Phase 6 — licensing / release hygiene

| Task | Status | Evidence |
|---|---|---|
| T6.1 Remove unlicensed fonts | Done for HEAD | Corpta/Aeonik deleted; stale artifacts cleaned; truthful `compliance/FONT_REMOVAL_AUDIT.md`; `check:shipped-assets` |
| T6.2 Regenerate §4(b) manifest | Blocked on legal | `scripts/licence-compliance.mjs --write` exists; `compliance/report.json` still warns and policy approval is pending |
| T6.3 Bundle third-party license texts | Done existing | `THIRD_PARTY_NOTICES.md`, `apps/web/public/licenses`, and generated dependency licence reports ship |
| T6.4 Release gate | Done | Source maps off for web/desktop/server; Caddy 404s `.map`; desktop and mobile release workflows now call the compliance workflow as a hard dependency (`fc0676b`) |
| T6.5 Rebrand mobile/desktop identity | Deferred | `com.rakazo.app`, `rakazo://`, Expo owner, updater feed; see DEFERRED.md |
| T6.6 Nodebox/GSAP | Done code-side | Orbit Chat `4e6a11ab` removes Sandpack/Nodebox and renders E2B preview URLs; `ec636709` removes unused GSAP. Shipping Orbit Chat itself remains a product decision |

## Final status — 2026-11-14

### Commits

Orbit Bot (`feat/orbit-phase0-containment`): `9a38636` Phase 0 containment; `6140fa1` hermetic harness + invariants; `e316f3b` observer telemetry-only; `207907f` cloud-only policy; `64203c7` fonts + source maps; `796be87` desktop-dist asset gate; `50343d0` final router/compose fixes; `096a1d6` I10 AI path tagging; `9907674` signed memory identity; `a4005c4` group responder router; `d41cd2c` 30-bot cap; `6a76b57` jittered credit retries; `1fc1fe1` 30-bot soak; `1dbb4ca` body-bound v3 signing; `f9c73fb` catalog composer; `fc0676b` cloud-first defaults + compliance release dependency; `26487b8` gate test fixes.

Forion Server (`feat/orbit-billing-authority`): `8ddd479c` BILL-10 hot chat; `23ebc1bf` wallet harness + CI; `cb90b5d4` per-reservation ledger, 30m TTL, locked-credit cap; `0119e5ac` 30-run reconciliation fuzz; `a9b6b1d5` 5m TTL + heartbeat + 30-bot cap; `7fc655bb` rate-bucket refill fix; `d165835c` body-bound HMAC v3 + replay.

### Green gates

- Orbit full unit suite: **23,265 passed / 1,064 skipped / 0 failed** across 1,400 files (final run, exit 0). Hermeticity guard and node harness checks included.
- New composer picker test: 2/2.
- Billing/gateway: fake gateway 7/7, 30-bot soak passes twice, adversarial gate 3 passed / 2 skipped.
- Forion: security suite 56/56 (guard, memory v3, AI gateway); rate bucket 2/2; `tsc` clean.
- Web composer tests 123/123; web `tsc` clean; contracts 38/38; fleet tools 101/101; thread-target 114/114; env 60/60.
- `check:shipped-assets`: clean after a fresh web build; web build exits 0.
- Hermeticity guard: clean; no test reads root `.env` or loads dotenv config.
- Secret scan: no tracked-file leaks in 33.59 MB (prior public publication still requires rotation).
- Orbit Chat: Sandpack/Nodebox removed (`4e6a11ab`), unused GSAP removed (`ec636709`), dependency licence guard 2/2 (`3bfe4028`), artifact tests 12/12, eslint/tsc clean on changed files.

### Still blocked

1. Secret rotation and repo privacy (human; see `HUMAN_ACTIONS.md`).
2. Hosted flag flip for signed-only identity (`FORION_REQUIRE_SIGNED_INTERNAL=1`, `FORION_REQUIRE_SIGNATURE_V3=1`) after every auxiliary caller is confirmed.
3. Cloud origin/IAM/DNS, E2B production key and quotas, signing/update feed, provider resale, §4(b) legal sign-off.
4. Desktop/device control remains Stage 4; per-bot budget and group pause/resume are not shipped. See `DEFERRED.md`.

**Next action:** finish the fresh full-suite run, then Stage 2 discovery against the existing Playwright/testkit harness.
