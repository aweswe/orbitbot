# Documentation migration

Date: 2026-11-10
Status: product-name migration complete; deployment identifiers intentionally retained

This inventory separates Orbit product documentation from inherited Rakazo material and required
attribution. It is not legal advice.

## Final counts

- 74 Markdown documents under `docs/`.
- 4 documents intentionally retain the Rakazo name: `DOCUMENTATION_MIGRATION.md`,
  `LICENCE_COMPLIANCE.md`, `ORBIT_BRAND_SYSTEM.md`, and `UPSTREAM_WORKFLOW.md`.
- 26 documents retain runtime compatibility identifiers.
- 0 product documents retain Rakazo as the product name.
- 45 documents contain no Rakazo name or runtime identifier.

A product-name rewrite replaced `Rakazo` with `Orbit`, `Rakazo Cloud` with `hosted Orbit`, and
`rakazo.com` with `orbit.forion.dev` in the remaining documents. The technical content was not
otherwise rewritten or re-verified.

## Intentionally retained attribution and policy documents

| Document | Status |
| --- | --- |
| `docs/DOCUMENTATION_MIGRATION.md` | This inventory; Rakazo references are the subject. |
| `docs/LICENCE_COMPLIANCE.md` | Upstream licence and attribution policy; Rakazo references are required. |
| `docs/ORBIT_BRAND_SYSTEM.md` | Brand hierarchy and attribution notes; Rakazo references are intentional. |
| `docs/UPSTREAM_WORKFLOW.md` | Upstream remote and baseline workflow; Rakazo references are required. |

## Product documentation rewritten

These documents now use Orbit as the product name and contain no capitalised Rakazo product prose.

| Document | Final status |
| --- | --- |
| `docs/account.md` | Orbit naming applied. |
| `docs/agent-verification.md` | Orbit naming applied. |
| `docs/ai-data-sharing-review.md` | Orbit naming applied. |
| `docs/build-a-plugin.md` | Orbit naming applied; submission instructions now use the live API instead of the retired marketing form. |
| `docs/content-encryption.md` | Orbit naming applied. |
| `docs/context-and-evals-tasks.md` | Orbit naming applied. |
| `docs/desktop-app.md` | Orbit naming applied; hosted-instance wording corrected. |
| `docs/import-an-agent.md` | Orbit naming applied. |
| `docs/integrations.md` | Orbit naming applied. |
| `docs/memory.md` | Orbit naming applied. |
| `docs/messaging-apps.md` | Orbit naming applied. |
| `docs/mobile-app.md` | Orbit naming applied. |
| `docs/mobile-release.md` | Orbit naming applied; existing bundle identifiers and schemes retained. |
| `docs/models.md` | Orbit naming applied. |
| `docs/performance.md` | Orbit naming applied. |
| `docs/self-host-audit-log.md` | Orbit naming applied. |
| `docs/self-host-billing.md` | Orbit naming applied; billing lookup keys retained. |
| `docs/settings-from-chat-tasks.md` | Orbit naming applied; the internal `rakazo` skill identifier is retained. |
| `docs/tool-activity.md` | Orbit naming applied. |
| `docs/troubleshooting.md` | Orbit naming applied; help URL corrected to the documentation host. |
| `docs/infisical-secrets.md` | Orbit naming applied. |
| `docs/getting-started.md` | Orbit naming applied; stale marketing links replaced with repository docs. |

`docs/evals/page-browser-bench.md` contained two inherited product-name references; they now use
Orbit. The remaining files under `docs/evals/` and `docs/ui-ux/` are internal engineering records
and are not linked from the product site.

## Deployment and compatibility documentation

These documents describe the inherited self-hosted topology, published image registry, database
roles, systemd units, and filesystem layout. Their runtime identifiers are intentional:

- `RAKAZO_*` environment variables
- `rakazo_app` database role
- `ghcr.io/elie222/rakazo` image registry
- `/etc/rakazo`, `/var/backups/rakazo`, `/srv/rakazo`
- `rakazo-*.service` and `rakazo-*.timer`
- `com.rakazo.app` bundle identifier and `rakazo` URL scheme
- `x-rakazo-*` request headers
- `rakazo_byok_*` billing lookup keys

Rewriting the prose while leaving the implementation unchanged would make the instructions false.
Product-name prose was migrated; identifiers were preserved.

| Document | Runtime identifiers retained | Final status |
| --- | --- | --- |
| `docs/bot-secrets.md` | 3 | Orbit naming applied; identifiers retained. |
| `docs/computer-runtime.md` | 1 | Orbit naming applied; identifiers retained. |
| `docs/self-host-accounts.md` | 3 | Orbit naming applied; passkey domain corrected to `orbit.forion.dev`. |
| `docs/self-host-backups.md` | 21 | Orbit naming applied; identifiers retained. |
| `docs/self-host-clients.md` | 12 | Orbit naming applied; client headers and bundle IDs retained. |
| `docs/self-host-configuration.md` | 11 | Orbit naming applied; identifiers retained. |
| `docs/self-host-docker-computers.md` | 3 | Orbit naming applied; identifiers retained. |
| `docs/self-host-inbound-email.md` | 5 | Orbit naming applied; identifiers retained. |
| `docs/self-host-integrations.md` | 1 | Orbit naming applied; identifiers retained. |
| `docs/self-host-models.md` | 23 | Orbit naming applied; identifiers retained. |
| `docs/self-host-observability.md` | 16 | Orbit naming applied; identifiers retained. |
| `docs/self-host-production.md` | 22 | Orbit naming applied; identifiers retained. |
| `docs/self-host-restricted-network.md` | 17 | Orbit naming applied; identifiers retained. |
| `docs/self-host-sandbox-providers.md` | 7 | Orbit naming applied; provider/image identifiers retained. |
| `docs/self-host-secrets.md` | 3 | Orbit naming applied; identifiers retained. |
| `docs/self-host-storage.md` | 1 | Orbit naming applied; paths retained. |
| `docs/self-host-upgrading.md` | 34 | Orbit naming applied; updater and image identifiers retained. |
| `docs/self-host.md` | 3 | Orbit naming applied; image registry and runtime identifiers retained. |
| `docs/wuying-computers.md` | 3 | Orbit naming applied; provider identifiers retained. |
| `docs/wuying-computers.zh-CN.md` | 3 | Chinese text migrated; product-name prose corrected. |
| `docs/zh-CN/self-host-backups.md` | 19 | Chinese text migrated; identifiers retained. |
| `docs/zh-CN/self-host-models.md` | 12 | Chinese text migrated; identifiers retained. |
| `docs/zh-CN/self-host-restricted-network.md` | 16 | Chinese text migrated; identifiers retained. |
| `docs/zh-CN/self-host-upgrading.md` | 6 | Chinese text migrated; identifiers retained. |
| `docs/zh-CN/self-host.md` | 1 | Chinese text migrated; identifiers retained. |

## Internal records

`docs/ui-ux/` and `docs/evals/` are internal design and evaluation records. They are retained for
engineering history, are not part of the published marketing site, and are not product claims.

## Archived documentation

The following internal documents were moved out of the repository during the migration:

- `docs/FORION_ORBIT_INTEGRATION_HANDOFF.md` — contained private infrastructure identifiers. See
  `security/INCIDENT_ASSESSMENT.md`. The file remains in Git history.
- `docs/ORBIT_INFRASTRUCTURE_INTEGRATION_MASTERPLAN.md` — internal architecture plan with private
  infrastructure references.
- `docs/ORION_READINESS_AND_CAPABILITIES_REPORT.md` — obsolete “Orion” readiness report with
  unverified test counts and architecture claims.

The archived files were preserved in a local archive outside the repository. They were not
committed or pushed.

## Marketing site

The built marketing site contains 26 pages:

- Home and 15 locale home URLs
- About, Pricing, Brand, Download, Support, Privacy, Terms, 404
- Blog index, one self-hosting guide, its category page, and RSS
- Markdown alternates, `llms.txt`, `robots.txt`, sitemap, and AI catalog

The non-English locale homes are `noindex` and canonicalize to `https://orbit.forion.dev/` until
translated. They remain reachable from the footer language menu but are excluded from the sitemap.

Removed routes are redirected with HTTP 301 in `apps/www/vercel.json`. The inherited docs,
alternatives, integrations, sandboxes, voice-provider, plugin, and competitor-blog pages are no
longer built.

## Remaining documentation work

- The deployment guides still describe the inherited upstream image registry and runtime names.
  A future deployment-identity migration must change the implementation and the prose together.
- The Chinese translations were product-name migrated but not re-reviewed for translation quality.
- The setup script `scripts/setup-upstream.sh` is functional but remains untracked. A fresh clone
  must obtain it separately until it is committed through a reviewed change.
