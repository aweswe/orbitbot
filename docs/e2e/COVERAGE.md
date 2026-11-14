# E2E coverage — existing harness

Generated from the specs present at HEAD on 2026-11-14. This is an inventory of
what the mature suite already covers, not a rebuild plan. A row marked **Gap**
has no browser or harness test yet and blocks the Stage 2 gate.

Counts at HEAD: 117 web Playwright specs, 4 desktop Electron specs, 27
Postgres-backed testkit suites, 78 testkit unit suites, 183 RPC procedures.

## Flow coverage

| # | Flow | Existing specs | Status |
|---|---|---|---|
| 1 | Auth / account | `auth-lifecycle`, `login-card`, `passkeys`, `account-locale` | Covered |
| 2 | Onboarding | `onboarding-conversation`, `onboarding-model-required`, `onboarding-signup-survey` | Covered |
| 3 | Credits / billing | `billing-paywall`, `spending-limit`; `group-soak`, Forion wallet/fuzz/outbox suites | Covered except checkout failure/duplicate-webhook UI |
| 4 | Model picker / catalog | `model-settings`, `model-header-discovery`; composer picker unit path | **Gap**: composer catalog selection + no Custom in cloud mode |
| 5 | Bots | `bot-crud`, `bot-templates`, `bot-organization`, `agent-import`, `bot-email`, `fleet-groups` | Covered; per-bot budget gap |
| 6 | Chat / runs | `composer-send-failure`, `chat-*`, `message-*`, `markdown-*`, `transcript-*`, `stop-by-message`, `run-failure`, `tool-activity`, `subagent-card` | Covered; refresh-mid-stream gap |
| 7 | Groups | `group-chats`, `fleet-groups`; speaker router + 30-bot soak in testkit | Covered except pause/resume and per-bot budget controls |
| 8 | Sandbox / computers | `computer-*`, `host-computer-prompt`, `user-computer-*`, `screen-proxy-isolation`, `page-browser` | Covered |
| 9 | E2B previews | `pages`, `page-browser`, `artifact-preview`; Orbit Chat has `app/api/artifact-preview` | **Gap**: signed URL expiry, idle teardown, frame-ancestors |
| 10 | Memory | `knowledge-panel`; Forion signed-memory unit tests | **Gap**: per-space isolation and third-party memory rejection in E2E |
| 11 | Settings | `settings-shell`, `ui-appearance`, `ui-locale`, `vault-settings`, `approval-rules-settings`, `messaging-settings`, `agent-connection-approval` | Covered |
| 12 | Cloud-only negatives | Unit/API tests for `refuseCloudOnly`; env boot tests | **Gap**: API-level and browser E2E for every BYO vector |
| 13 | Security | `screen-proxy-isolation`, `secret-card`, `auth-lifecycle`; Forion HMAC body/replay tests; Orbit RLS cross-tenant Postgres test | Covered at unit/DB; **Gap**: forged/replayed internal calls in an end-to-end stack |
| 14 | Prompt injection | None in `apps/web/e2e`; eval suites cover model behaviour | **Gap** for cloud tools |
| 15 | Failure injection | `fake-forion-gateway` faults, `group-soak`, `run-failure`, `load-failure`, `composer-send-failure` | Covered at harness level; **Gap**: worker/DB/Redis chaos |
| 16 | Concurrency | `group-soak` (30 bots, two passes), executor lifecycle, multi-tab chat tests | Covered for billing; **Gap**: Playwright-driven 30-bot load |
| 17 | Responsive / mobile web | `mobile-sidebar-swipe`, `mobile-computer-keyboard`, `transcript-width`; web projects include mobile viewports | Partial |
| 18 | Performance budgets | `logo-avatar-motion-conformance`, bundle checks in CI | **Gap**: LCP/TTI and first-token budget |
| 19 | Release artifacts | `check-shipped-assets`, licence-compliance workflow, desktop release tests | Covered |

## Stage 2 gaps to close

1. Composer catalog selection and Custom removal (new picker has no E2E yet).
2. Cloud-only negative matrix at the API and UI level.
3. Prompt-injection corpus for web/email/file tools.
4. Memory per-space isolation through the real stack.
5. E2B preview URL expiry, idle teardown, and frame-ancestors.
6. Worker/DB/Redis chaos and a Playwright-driven 30-bot load.
7. Performance budgets (LCP/TTI, first token, heap growth).
8. Per-bot budget and group pause/resume controls, if those ship in this release.

The browser matrix, fixtures, page objects, and a11y/console assertions already
exist in `apps/web/playwright.config.ts` and `apps/web/e2e/helpers.ts`; do not
rebuild them.
