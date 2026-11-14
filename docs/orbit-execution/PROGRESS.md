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
| T1.3 Cross-service invariant suite | Partial | I1, I2 (aggregate), I3, I5, I8 green; I4 and I6 recorded as `it.failing`; I7/I9/I10 remain Phase 2/3 targets. See `docs/billing/INVARIANTS.md` |
| T1.4 Gate | Pending full-suite confirmation | First run: 23,239 passed, 1,064 skipped, 1 failed (UI type-scale); fixed; rerun in progress. Wallet spec 6/6 passed against a fresh pgvector DB |

## Phase 2 — single billing authority

Status: not started. Entry gate: Phase 1 full suite green + invariant baseline documented.

## Phase 3 — cloud-only server policy

Status: not started.

## Phase 4 — web alpha / managed execution

Status: blocked on cloud IAM and E2B credential (human); code-side work can start after Phase 3.

## Phase 5 — group scale

Status: deferred until Phase 2 gate is green.

## Phase 6 — licensing / release hygiene

Status: not started; can run in parallel with Phase 3.
