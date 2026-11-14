# Human actions — Orbit single-authority migration

The agent cannot perform these. Do them in order. Never paste secret values into chat, tickets, or commits.

## P0 — rotate now (before any further testing or deployment)

- [ ] **Rotate the shared database passwords.** In the Supabase dashboard for project `loanzmtsltoppejrmfdj`, rotate the `postgres` and `orbit_bot_app` passwords. Update every environment that uses them: `orbitbot/.env`, `forion-server-orion/.env`, secret managers, CI secrets. Do not reuse the old values.
- [ ] **Rotate the auth secret.** Generate a new `BETTER_AUTH_SECRET` with `openssl rand -hex 32`; update `orbitbot/.env` and any deployed environment. Rotating it invalidates existing Better-Auth sessions.
- [ ] **Rotate the Forion internal secret.** Generate a new `FORION_ORBIT_INTERNAL_SECRET` with `openssl rand -hex 32`; update both `.env` files and the deployed secret manager. Remove `FORION_API_KEY` fallbacks where they duplicate it.
- [ ] **Review database access logs.** In Supabase, review auth/query logs for the last 30 days for foreign IPs, unexpected roles, or unusual queries. If anything is unexplained, treat the database as compromised and rotate dependent credentials (Redis password if any, SMTP, storage keys).
- [ ] **Make the repository private.** Change `github.com/aweswe/orbitbot` to private. Remove public branches, Actions artifacts, and packages that expose source or secrets. Record that the already-published snapshot remains available under Apache-2.0; a private repo does not revoke it.
- [ ] **Decide on history rewrite.** Rewriting git history does not undo a public snapshot, but it reduces accidental re-publication. Coordinate with any known clones/forks first. This is optional after rotation.

## P0 — immediately after this code pass

- [ ] **Rebuild every client artifact.** The unlicensed Corpta and Aeonik files were deleted from HEAD and from local build outputs. Any previously packaged `Orbit.app`, web `dist`, or marketing `dist` still contains them and must be rebuilt before distribution. `node scripts/check-shipped-assets.mjs` must pass on the new artifacts.
- [x] **Group responder policy decided and implemented.** Unaddressed group messages route to at most three responders; explicit mentions and replies bypass the router. The cap is 30, and a 30-bot soak against `FakeForionGateway` runs twice with injected faults and zero locked-credit drift.

## P1 — before external distribution

- [ ] **Legal review** for the Apache-2.0 derivative, §4(b) change-notice policy, fonts, third-party notices, and the Orbit/Rakazo trademark boundary. See `docs/LICENCE_COMPLIANCE.md` and `compliance/report.json`. The desktop and mobile release workflows now call the compliance workflow as a hard dependency, so `--release` warnings must be resolved before packaging can start.
- [ ] **Provider resale consent.** Obtain written consent or approved contracts from Requesty (and OpenRouter/OpenAI/Anthropic/Vercel if used for paid credits), or move paid traffic to approved direct contracts/BYOK. This is a business/legal blocker, not a code change.
- [ ] **Contracting entity.** The marketing Terms currently name “Inbox Zero Inc.” Decide the correct Forion entity and update Terms, Privacy, DPA, and subprocessors.
- [ ] **Cloud IAM and DNS.** Fix the `orbit.forion.dev` origin, the Cloud Run 403/IAM path, and the deployment identity. Set `ORBIT_CLOUD_ONLY=true` and `SANDBOX_PROVIDER=e2b` on the hosted service; the API now refuses to boot with a local sandbox provider when cloud-only is set. The code can support a Google ID token/VPC client, but the cloud configuration is human-owned.
- [ ] **Signed-only internal identity.** Body-bound HMAC v3 is implemented for credits, memory, and buffered model calls, with replay rejection. Remaining human step: confirm every auxiliary caller signs, then set `FORION_REQUIRE_SIGNED_INTERNAL=1` and `FORION_REQUIRE_SIGNATURE_V3=1` in the hosted environment, and resolve one canonical Forion user ID for credits and memory. Orbit's runtime/migration database roles and RLS cross-tenant test already exist; run them against the hosted database before enabling enforcement.
- [ ] **Managed execution.** Provision the E2B/Daytona/K8s sandbox provider and per-bot quotas for the web alpha; `SANDBOX_PROVIDER=desktop` is not a consumer path.
- [ ] **Signing and update feed.** Provide Apple Developer ID/notarization and Windows signing credentials; resolve the updater repository (`forion-ai/orbit` vs the upstream feed).
- [ ] **Orbit Chat shipping decision.** If Orbit Chat ships, resolve `@codesandbox/nodebox` (non-commercial Sustainable Use License) and GSAP terms before distribution.

## P2 — launch operations

- [ ] Store identities (Apple/Google bundle IDs), EAS ownership, push/Passkey registration.
- [ ] Incident/refund runbooks, privacy/DPA review, export/sanctions review.
- [ ] SBOM/attestation publication and dependency-review policy.
