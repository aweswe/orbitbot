# Billing invariants (I1–I10)

Status as of 2026-11-14, before the Phase 2 single-authority rewrite. Green tests are real; `it.failing` tests are known-red targets that keep CI green while the debt stays visible.

| ID | Invariant | Test | Status |
|---|---|---|---|
| I1 | No charge without a lock | `forion-server-orion/src/credits/wallet.service.spec.ts` — I1 | Green |
| I2 | A commit never exceeds that reservation's lock | `wallet.service.spec.ts` — I2, I2b, I2c | Green: the named reservation is validated under `FOR UPDATE`; I2b covers an under-reported shared bucket |
| I3 | Settle/commit/refund idempotent under replay | `wallet.service.spec.ts` — I3 | Green |
| I4 | Reservation TTL ≥ max call duration, or heartbeated | `wallet.service.spec.ts` — I4 | Green: TTL is 30 minutes |
| I5 | Crash mid-call leaves a recoverable obligation | `orbit-adversarial-gate.test.ts` — DB scenario 2 | Green under `pnpm test:integration` with a disposable DB |
| I6 | N concurrent runs (N=30) cannot consume each other's collateral | `wallet.service.spec.ts` — I6 | Green: the count cap is replaced by a total-locked-credits cap |
| I7 | Exactly one meter writes per inference | `orbitbot/packages/adapters/src/model-credit-observer.test.ts` — "does not meter when the Forion gateway owns billing" | Green in hosted mode: the observer is telemetry-only; the gateway is the sole meter |
| I8 | Balance never negative via settle overage without explicit policy | `wallet.service.spec.ts` — I8 | Green (settle caps at the lock; the undercharge is tracked separately) |
| I9 | One pricing function; same usage yields one price | Hosted: Forion `usdToCredits`; self-host legacy `costUsd/0.002` remains behind the cloud-only split | Green for hosted traffic; self-host path is not part of the closed product |
| I10 | Every metered path emits a credit event; unmetered paths are explicitly free | Phase 3 (T3.3) | Pending: voice, image, video, third-party memory are currently unmetered |

## How to run

```bash
# Forion wallet invariants (disposable migrated database)
FORION_TEST_DATABASE_URL=postgresql://.../forion_test \
  ./node_modules/.bin/jest src/credits/wallet.service.spec.ts --runInBand

# Orbit hermetic suites (no .env, no live gateway, no shared DB).
# Clear ORBIT_BILLING_ENABLED, FORION_SERVER_URL, ORBIT_CONTROL_PLANE_URL,
# FORION_ORBIT_INTERNAL_SECRET and FORION_API_KEY in the shell first, then:
pnpm test

# Orbit DB durability scenarios (disposable database via Testcontainers)
pnpm test:integration
```

`pnpm test` now runs `scripts/check-test-hermeticity.mjs` first and fails if a unit test reads the root `.env`, calls `loadRootEnv`, or loads dotenv config. The adversarial gate's live Forion HTTP calls were replaced with an in-process HMAC verifier; its DB scenarios only run under the integration harness.
