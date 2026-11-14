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
| T1.2 Fake gateway + wallet harness | Partial | In-process HMAC verifier in the adversarial gate; real-Postgres `wallet.service.spec.ts` harness. Full fault-injecting FakeForionGateway still to build |
| T1.3 Cross-service invariant suite | Done | I1-I8 mapped in `docs/billing/INVARIANTS.md`; I4/I6 now green after Phase 2 |
| T1.4 Gate | Done | Full suite 23,240 passed / 1,064 skipped / 0 failed; wallet spec 8/8 against a fresh pgvector DB |

## Phase 2 — single billing authority

| Task | Status | Evidence |
|---|---|---|
| T2.1 Per-reservation ledger validation | Done | Forion `cb90b5d4`: reservation validated under `FOR UPDATE`; commit/refund no longer trust the user-wide bucket |
| T2.2 Locked-credit cap + TTL | Done | `FORION_MAX_LOCKED_CREDITS_PER_USER` default 10,000; TTL 30m |
| T2.3 One pricing function | Hosted done | Gateway `usdToCredits` is authoritative for hosted calls; legacy self-host math remains outside the closed path |
| T2.4 Observer telemetry-only | Done | `model-credit-observer.ts`: hosted mode never locks/settles; 4/4 tests |
| T2.5 Durable gateway outbox / requests IDs | Partial | Deferred: gateway settlement is still synchronous; no per-request ledger correlation yet |
| T2.6 Hot-chat revenue leak (BILL-10) | Done | Forion `8ddd479c`: real lock + per-run overage key |
| T2.8 Gate | Partial | I1-I4, I6-I9 green in hosted mode; I5 local; I10 pending Phase 3; T2.5/T2.7 pending |

## Phase 3 — cloud-only server policy

| Task | Status | Evidence |
|---|---|---|
| T3.1 Model/provider/import gate | Done | `ORBIT_CLOUD_ONLY` boot check; `refuseCloudOnly` on models.connect/probe/OAuth; agent import strips third-party keys |
| T3.2 Aux model routing | Partial | Decision/aux direct paths still need the gateway sweep; main model traffic is Forion-only |
| T3.3 Voice/memory/media disabled | Done | Voice + memory connect routes reject; media factory returns undefined; memory factory forces Forion |
| T3.4 Identity/RLS/HMAC hardening | Partial | Canonical-ID, body-bound HMAC, and RLS role separation remain; tracked in HUMAN_ACTIONS and the audit |
| T3.5 Catalog from Forion | Partial | Server now restricts providers; the composer catalog is still hardcoded (Phase 4/UI) |
| T3.6 Gate | Partial | 66 cloud-only/env tests pass; adapters + API tsc pass; identity negative tests pending |

## Phase 4 — web alpha / managed execution

Status: blocked on cloud IAM and E2B credential (human); code-side work can start after Phase 3.

## Phase 5 — group scale

Status: **deliberately deferred.** The 10-bot cap stays until speaker selection and
backpressure exist. Raising it now would fan out 20–30 simultaneous runs into one
wallet and sandbox fleet, making billing and latency worse. The test to write first
is a 30-bot soak with a fake gateway; the product decision is which responder policy
(mentions only, 1–3 speakers, or all) the room should use.

## Phase 6 — licensing / release hygiene

| Task | Status | Evidence |
|---|---|---|
| T6.1 Remove unlicensed fonts | Done for HEAD | Corpta/Aeonik deleted; stale artifacts cleaned; truthful `compliance/FONT_REMOVAL_AUDIT.md`; `check:shipped-assets` |
| T6.2 Regenerate §4(b) manifest | Not done | Requires legal sign-off; `compliance/report.json` still `release:false` |
| T6.3 Bundle third-party license texts | Not done | Notices list SPDX names only |
| T6.4 Release gate | Partial | Source maps off for web/desktop/server; Caddy 404s `.map`; CI + desktop release run the asset gate; compliance job still not a release dependency |
| T6.5 Rebrand mobile/desktop identity | Deferred | `com.rakazo.app`, `rakazo://`, Expo owner, updater feed; see DEFERRED.md |
| T6.6 Nodebox/GSAP | Human decision | `HUMAN_ACTIONS.md` |
