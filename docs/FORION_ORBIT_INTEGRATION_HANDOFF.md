# Orbit Bot & Forion Server Integration: Comprehensive Architecture & Handoff Guide

**Document Version:** 1.0.0  
**Timestamp:** 2026-11-07  
**Status:** Implemented & Locally Verified  
**Primary Integration Nodes:**
- **Orbit Bot Web SPA:** Vite + React + Tailwind + Radix UI (`http://127.0.0.1:5173`)
- **Orbit Bot API & Worker:** Fastify / Hono + ORPC + Graphile Worker (`http://127.0.0.1:3100`)
- **Forion Server (Control Plane Authority):** `https://forion-main-bfq6huxo2q-ew.a.run.app`
- **Database (Supabase PostgreSQL):** `aws-1-ap-northeast-1.pooler.supabase.com:6543/postgres`
- **Isolated Schema:** `orbit_bot` (Application role: `orbit_bot_app`)

---

## 1. Executive Summary & Core Requirements

The objective of this integration is to connect **Orbit Bot** (an autonomous full-featured agentic development workspace with sandboxed container execution, tool routing, and deep multi-step coding capabilities) directly with **Forion Server** as its **sole authoritative control plane**.

### Core Invariants:
1. **Forion Server is the Sole Authority:**
   - Identity, session authority, billing, and wallet credits are owned exclusively by Forion Server.
   - Orbit Bot has no independent email/password sign-up or sign-in in production.
   - Orbit Bot users are 1:1 mapped to Forion / Orbit users.
2. **Zero Regressions & Additive Database Isolation:**
   - Orbit Bot shares the existing production/staging PostgreSQL instance with Forion.
   - To guarantee that no existing table, constraint, view, or RLS policy in Forion is impacted, Orbit Bot lives exclusively in an isolated schema: `orbit_bot`.
   - Dedicated restricted application role: `orbit_bot_app`. No modifications or regressions to `public.*`.
3. **Orbit Brand Parity:**
   - Orbit Bot frontend utilizes the official Orbit vector and mark branding (`OrbitLogo`).
   - Clean, unified login with "Login with Orbit". No unwanted legacy strings or debug labels.
   - Composer model selection matching Orbit's model hierarchy: **Orbit Flash**, **Orbit Forge** (with reasoning multipliers 1×, 2×, 4×, 8×), and **Custom**.
   - Real-time credit badge displaying wallet balance from Forion.

---

## 2. System Architecture & Topology

```
+-----------------------------------------------------------------------------------+
|                                  BROWSER CLIENT                                    |
|  http://127.0.0.1:5173  (Production: https://orbitbot.forion.dev)                 |
|                                                                                   |
|  - Auth Page: "Login with Orbit" (Orbit Vector Logo)                              |
|  - Chat Composer: OrbitModelPicker (Orbit Flash, Orbit Forge 1x/2x/4x/8x, Custom) |
|  - Real-time Header: OrbitCreditBadge (Live balance query)                        |
+----------------------------------------+------------------------------------------+
                                         |  /api (Vite proxy / CDN route)
                                         v
+-----------------------------------------------------------------------------------+
|                                 ORBIT BOT API                                     |
|  http://127.0.0.1:3100  (Production: https://api.orbitbot.forion.dev)             |
|                                                                                   |
|  - Better-Auth with HMAC-SHA256 cookie signing (`better-auth.session_token`)       |
|  - POST /api/orbit/login -> bootstrapUserSpace & signed session generation       |
|  - GET  /api/orbit/billing -> Forion wallet balance snapshot                      |
|  - GET  /api/orbit/models -> Orbit Flash & Orbit Forge model definitions          |
|  - ModelCreditObserver -> Real-time credit deduction via Forion Control Plane    |
+-------------------+-----------------------------------+---------------------------+
                    |                                   |
                    | Credit Lock/Commit/Refund         | PostgreSQL (Port 6543)
                    v                                   v
+--------------------------------------+   +----------------------------------------+
|            FORION SERVER             |   |         SUPABASE POSTGRESQL            |
|  (GCP Cloud Run Staging)             |   |  (aws-1-ap-northeast-1)                |
|  https://forion-main-bfq6huxo...     |   |                                        |
|                                      |   |  Schema: [public]     Schema: [orbit_bot]
|  - GET  /api/orbit/credits/balance   |   |  - Forion Core        - All 232 Migrations
|  - POST /api/orbit/credits/lock      |   |  - Unchanged          - App Role:
|  - POST /api/orbit/credits/commit    |   |  - Non-destructive      orbit_bot_app  
|  - POST /api/orbit/credits/refund    |   |                                        |
+--------------------------------------+   +----------------------------------------+
```

---

## 3. Database Isolation & Migrations

### 3.1 Schema Isolation
- The `orbit_bot` schema was created on the database:
  ```sql
  CREATE SCHEMA IF NOT EXISTS orbit_bot;
  ```
- Dedicated role created:
  ```sql
  CREATE ROLE orbit_bot_app WITH LOGIN PASSWORD '...';
  GRANT USAGE, CREATE ON SCHEMA orbit_bot TO orbit_bot_app;
  GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA orbit_bot TO orbit_bot_app;
  GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA orbit_bot TO orbit_bot_app;
  GRANT ALL PRIVILEGES ON ALL ROUTINES IN SCHEMA orbit_bot TO orbit_bot_app;
  ALTER ROLE orbit_bot_app SET search_path = orbit_bot;
  ```
- Both connection strings target `schema=orbit_bot`:
  ```env
  DATABASE_URL="postgresql://postgres.loanzmtsltoppejrmfdj:...@aws-1-ap-northeast-1.pooler.supabase.com:6543/postgres?schema=orbit_bot&pgbouncer=true"
  DATABASE_MIGRATION_URL="postgresql://postgres.loanzmtsltoppejrmfdj:...@aws-1-ap-northeast-1.pooler.supabase.com:6543/postgres?schema=orbit_bot"
  ```

### 3.2 Additive Migration Repairs
During `pnpm exec prisma migrate deploy` into schema `orbit_bot`, 4 historical migrations contained hardcoded assumptions that broke in non-public schemas. They were cleanly resolved:
1. `20260828090002a_group_organization_repair_invalid_idx`:
   - Updated `WHERE n.nspname = 'public'` to `WHERE (n.nspname = 'public' OR n.nspname = current_schema())`.
2. `20261023000300_billing_audit`:
   - Removed hardcoded `public.billing_audit_events` to target `current_schema()`.
3. `20261023000500_credit_expiration`:
   - Removed hardcoded `public.` schema references.
4. `20261114120000_rls_bypass_key`:
   - Added `c.relnamespace = current_schema()::regnamespace` and `DROP FUNCTION ... CASCADE`.
All **232 Prisma migrations** applied cleanly (`232 migrations applied`).

---

## 4. Authentication Mechanism & Nuances

### 4.1 "Login with Orbit" & Single-Sign-On
1. **Capabilities Endpoint (`GET /api/auth/capabilities`):**
   - In Orbit mode (`ORBIT_AUTH_MODE=forion`), password auth and email code auth are returned as `false`.
   - SSO is declared with `{ name: "Orbit", availability: "available" }`.
   - The UI displays only the single primary action: **Login with Orbit**.
2. **Branding:**
   - The button uses the official Orbit vector mark (`OrbitLogo`).
   - All internal text such as "Authorized via Forion Server Control Plane" has been eliminated.
3. **Session Creation Pipeline (`POST /api/orbit/login`):**
   - Executed within `runAsSystem("orbit-login", ...)` to prevent tenant context lookup failures.
   - Upserts the user record in `orbit_bot.User`.
   - Bootstraps the personal workspace via `bootstrapUserSpace(prisma, user, env)`.
   - Creates a persistent session in `orbit_bot.Session`.

### 4.2 Better-Auth HMAC-SHA256 Cookie Signing (Critical Nuance)
Better-Auth verifies the integrity of the session token cookie (`better-auth.session_token`). An unsigned or raw token will result in `auth.api.getSession` returning `null`, which causes redirect loops back to `/sign-in`.

**Signing Implementation in `apps/api/src/app.ts`:**
```ts
const sig = createHmac("sha256", env.authSecret).update(sessionToken).digest("base64");
const signedCookieValue = encodeURIComponent(`${sessionToken}.${sig}`);

const isProd = env.nodeEnv === "production";
const cookieHeader = `better-auth.session_token=${signedCookieValue}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${30 * 24 * 60 * 60}${isProd ? "; Secure" : ""}`;
c.header("Set-Cookie", cookieHeader);
```
With this signature, `GET /api/auth/get-session` returns HTTP 200 with the active user and session object, and `/rpc/bootstrap` immediately grants access to the app shell.

---

## 5. Billing & Real-Time Credit Observability

### 5.1 Orbit Control Plane Adapter
Implemented in `packages/adapters/src/orbit-control-plane/orbit-control-plane-client.ts`:
- **`lockCredits(input: { userId, amount, reason, idempotencyKey })`:**
  Locks worst-case credit budget before streaming model responses.
- **`commitCredits(input: { lockId, finalAmount, tokens, model })`:**
  Debits exact token usage from Forion wallet.
- **`refundCredits(input: { lockId, reason })`:**
  Releases reserved credit locks on network aborts or generation errors.
- **`getBillingSnapshot(userId)`:**
  Queries live balance from Forion Server.

### 5.2 ModelCreditObserver
In `packages/adapters/src/model-credit-observer.ts`:
- Seamlessly intercepts all AI model streams (generation ticks).
- When `FORION_SERVER_URL` is set, all credit events bypass internal billing and route through `OrbitControlPlaneClient`.

---

## 6. Frontend Composer & Model Selection

### 6.1 OrbitModelPicker Component
Located at `apps/web/src/components/composer/OrbitModelPicker.tsx`:
- **Orbit Flash (`orbit-flash`):**
  High speed, lightweight model for rapid conversational interactions. Multiplier: 1×.
- **Orbit Forge (`orbit-forge`):**
  High-capability reasoning model for heavy architecture, coding, and debugging.
  Features selectable reasoning multipliers:
  - `1×` (Standard)
  - `2×` (Deep)
  - `4×` (Heavy)
  - `8×` (Maximum Reasoning)
- **Custom Model (`custom`):**
  Allows developer configuration of custom models.

### 6.2 OrbitCreditBadge
Located at `apps/web/src/components/OrbitCreditBadge.tsx`:
- Polls `GET /api/orbit/billing`.
- Displays real-time available credits with quick refetch capability.

---

## 7. Production Deployment Blueprint

### 7.1 Web SPA (Vercel)
- **Repository Directory:** `apps/web`
- **Build Command:** `pnpm --filter @rakazo/web run build`
- **Output Directory:** `apps/web/dist`
- **Environment Variables:**
  ```env
  VITE_API_URL=https://api.orbitbot.forion.dev
  VITE_FORION_SERVER_URL=https://forion-main-bfq6huxo2q-ew.a.run.app
  ```
- **Custom Domain:** `orbitbot.forion.dev` (Configure CNAME in DNS pointing to `cname.vercel-dns.com`).

### 7.2 API & Worker (Oracle Cloud Free ARM / GCP Cloud Run)
- **Containerization:** Built via root `Dockerfile` using multi-stage build.
- **Always-on Services:**
  1. `apps/api`: Fastify HTTP & ORPC API server (Port 3100 or 8080).
  2. `apps/worker`: Graphile background worker for agent job queue.
  3. Local Redis or Valkey instance for fast pub/sub & ephemeral locks.
- **Reverse Proxy / SSL:** Caddy or Nginx with Let's Encrypt automated TLS.
- **Custom Domain:** `api.orbitbot.forion.dev` (A record pointing to VM public IP).
- **Production Environment Variables:**
  ```env
  NODE_ENV=production
  PORT=3100
  WEB_ORIGIN=https://orbitbot.forion.dev
  BETTER_AUTH_URL=https://api.orbitbot.forion.dev
  BETTER_AUTH_SECRET=<32-byte-hex>
  DATABASE_URL=postgresql://orbit_bot_app:<SECURE_PASSWORD>@aws-1-ap-northeast-1.pooler.supabase.com:6543/postgres?schema=orbit_bot&pgbouncer=true
  DATABASE_MIGRATION_URL=postgresql://postgres.loanzmtsltoppejrmfdj:<PASSWORD>@aws-1-ap-northeast-1.pooler.supabase.com:6543/postgres?schema=orbit_bot
  FORION_SERVER_URL=https://forion-main-bfq6huxo2q-ew.a.run.app
  FORION_ORBIT_INTERNAL_SECRET=<STRONG_SHARED_SECRET>
  REDIS_URL=redis://127.0.0.1:6379
  ```

---

## 8. Verification & Test Checklist

- [x] Schema `orbit_bot` created on Supabase.
- [x] All 232 Prisma migrations applied with 0 errors.
- [x] Database changes are completely additive; 0 regressions to `public.*`.
- [x] Dedicated role `orbit_bot_app` scoped to `orbit_bot`.
- [x] Forion Server Control Plane adapter implemented.
- [x] Better-Auth cookie HMAC signing verified (`curl /api/auth/get-session` returns HTTP 200).
- [x] "Login with Orbit" button uses official Orbit Logo with clean UI.
- [x] Model picker in chat composer matches Orbit Flash & Orbit Forge tiers.
- [x] Typechecks pass with 0 errors across API and Web (`tsc --noEmit`).
