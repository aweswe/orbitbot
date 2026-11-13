# Orion / Orbit Bot — Handoff Diagnostics & Known Issues

**Date:** 2026-11-13  
**Branch:** `handoff/orion-status-and-known-issues`  
**Base:** `feature/orion-cross-product-phase3-handoff`  
**Status:** Pre-fix audit state (no code fixes applied yet, strictly as requested)

---

## 1. Executive Summary & Repositories State

### `forion-server` (`C:\Users\adars\Desktop\Orbit Microservices\forion-server`):
- **Branch:** `feature/orion-cross-product-phase3-handoff`
- **State:** **100% CLEAN** tracked state (up to date with remote).
- **Runtime:** Running continuously on port `3001` (NestJS). Health and internal credit/wallet balance checks return HTTP 200.
- **Tests:** 41/41 unit/service tests passing (`orbit-user-sync`, `ai-gateway-security`, `memory`, `memory-extraction`).

### `orbit-bot` (`c:\Users\adars\.gemini\antigravity\scratch\orbit-bot`):
- **Branch:** `handoff/orion-status-and-known-issues`
- **Services:**
  - API daemon: running on `http://127.0.0.1:3100` (listening, handling RPC requests).
  - Web client: running on `http://127.0.0.1:5173` via Vite dev server.

---

## 2. Problems Faced (Resolved During Session)

1. **inspect-auth.mjs Docker URL Failure:**
   - Previous script hardcoded `127.0.0.1:55433` (local test DB).
   - Resolved by dynamically reading `DATABASE_URL` pointing to the Tokyo Supabase `orbit_bot` schema.

2. **Port 3001 ECONNREFUSED in Gate Tests:**
   - Adversarial credit tests failed when Forion Server was stopped.
   - Resolved by starting Forion Server daemon before running test suites (all 5 adversarial scenarios passed).

3. **Electron Dev Execution Mode Collision (`ELECTRON_RUN_AS_NODE=1`):**
   - The developer shell environment had `ELECTRON_RUN_AS_NODE=1` set.
   - This caused Electron v45 to execute as pure Node.js v24, triggering `SyntaxError: The requested module 'electron' does not provide an export named 'BrowserWindow'`.
   - Identified and isolated; clearing `ELECTRON_RUN_AS_NODE` restores native Electron execution.

---

## 3. Current Problems We Are Facing (Pending Fixes)

### Issue A: Electron Packaged App Crash (`Cannot find native Koffi module`)
- **Symptom:** Running `out/win-unpacked/Orbit.exe` displays a JavaScript error dialog on launch:
  `Error: Cannot find the native Koffi module; did you bundle it correctly? at wrapNative(...)`
- **Root Cause:**
  - In `apps/desktop/scripts/build.mjs`, `koffi` is externalized from esbuild.
  - In `apps/desktop/package.json`, electron-builder's `files` array only includes `dist/**/*` and `package.json`.
  - While macOS has an explicit native rule (`x64ArchFiles`), Windows lacks the rule to unpack and bundle `@koromix/koffi-win32-x64` / `koffi.node`.
  - Therefore, `app.asar` does not contain the native binary.
- **Planned Fix:** Update `package.json` to include Koffi Windows native binaries in `files` or `asarUnpack`.

### Issue B: Google OAuth Error 400 (`redirect_uri_mismatch`)
- **Symptom:** Clicking "Sign in with Google" displays Google Error 400: `redirect_uri_mismatch`.
- **Root Cause:**
  - Better-Auth generates the redirect URI as `http://localhost:5173/api/auth/callback/google` (proxied by Vite to port 3100).
  - The Google Cloud Console OAuth 2.0 Client ID `828624095626-e5cam4e5emmir99s2518oblimn2raaf3` does not have `http://localhost:5173/api/auth/callback/google` listed in its "Authorized redirect URIs".
- **Action Required:** Add `http://localhost:5173/api/auth/callback/google` and `http://127.0.0.1:5173/api/auth/callback/google` in the Google Cloud Console credentials page.

### Issue C: Web App Latency / Perceived Slowness
- **Symptom:** Sending messages in Orbit chat has a 1–2 second delay before text generation starts.
- **Root Cause:**
  1. **Geographic Network Roundtrips:** Database is located on Supabase in Tokyo (`aws-1-ap-northeast-1.pooler.supabase.com`). Roundtrip latency from India is ~130ms–160ms. Sequential queries (auth verification, thread retrieval, two-phase credit lock on Forion, memory search) sum to 1.2s+ of network transit alone.
  2. **Vite Dev Server:** In dev mode, the browser dynamically fetches hundreds of individual ES modules and transforms them on the fly. (The packaged `.exe` will eliminate UI loading latency by reading from local disk, though LLM generation latency will remain cloud-bound).
  3. **Upstream LLM Router:** Requesty gateway routing and DeepSeek queue times add time-to-first-token (TTFT).

### Issue D: Vision / Image Warning ("Image input is not configured for this model")
- **Symptom:** Uploading an image in chat shows:
  `Image input is not configured for this model. The bot can use the file but won't see the picture.`
- **Root Cause:**
  - Active model is `deepseek/deepseek-v4-flash`, which is a text-only LLM.
  - DeepSeek V4.1 Flash (`deepseek-v4.1-flash`) has native multimodal vision capabilities.
  - `packages/adapters/src/model-vision.ts` checks model capability tables and currently rejects image admission for text-only model strings.
- **Planned Fix:** Update configuration to `deepseek/deepseek-v4.1-flash` and ensure `modelAcceptsImageInput` includes the V4.1 vision model ID.
