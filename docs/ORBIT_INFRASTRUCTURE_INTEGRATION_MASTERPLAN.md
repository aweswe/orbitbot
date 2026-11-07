# ORBIT × ORBITBOT — DEEP INFRASTRUCTURE & INTEGRATION MASTERPLAN
**Architecture, Unified Database Strategy, Bidirectional Memory Sync, and Native Execution**

**Version:** 2.0 (Engineering Architecture Review)  
**Target Systems:**
- **Orbit Frontend / BFF:** Next.js 14 (`orbit`, port 3000)
- **Forion Server (Control Plane):** NestJS (`forion-server`, port 3001)
- **Forion Runtime (Sandbox/Brain):** NestJS (`forion-nestjs-runtime`, port 3002)
- **OrbitBot Harness & API:** Fastify / Node (`orbit-bot`, port 3100)
- **Database:** Supabase PostgreSQL with `pgvector` + Redis 5+

---

## 1. Executive Architecture Summary

Orbit and OrbitBot have distinct strengths that complement each other:

- **Orbit (Frontend & Control Plane)** owns the user identity, billing accounts, project workspaces, product-level chat UI, intent classification, and long-term user memory (`pgvector`).
- **OrbitBot (Autonomous Harness & Worker)** owns the deep execution loop: multi-turn tool loops, sandboxed computer execution (E2B / Docker), bounded subagent delegation, model fallback cascades, and mid-run checkpoints.

Rather than porting 200,000+ lines of agent harness into NestJS or rebuilding Orbit's control plane in OrbitBot, **OrbitBot operates as an internal, Orbit-authenticated autonomous execution service**.

```
┌────────────────────────────────────────────────────────────────────────┐
│                        ORBIT PRODUCT / CLIENT                          │
│     (Next.js 14 — Chat Composer, Agent Studio, Artifact Workspace)     │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ HTTP / SSE
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                      FORION SERVER (CONTROL PLANE)                     │
│    (NestJS — Intent Classification, Credits, MemoryService, BullMQ)    │
└───────────────┬───────────────────┬───────────────────┬────────────────┘
                │                   │                   │
         Shared │ Postgres          │ Redis Stream      │ Internal HMAC RPC
         Vector │ Memories          │ Job Queue         │ (Runs / Streaming)
                ▼                   ▼                   ▼
┌─────────────────────────┐ ┌───────────────┐ ┌──────────────────────────┐
│   SUPABASE POSTGRESQL   │ │  REDIS BUS    │ │     ORBITBOT HARNESS     │
│   • public schema:      │ │  • BullMQ     │ │   • PiAgentRuntime       │
│     users, memories,    │ │  • Event      │ │   • Tool & Computer Loop │
│     projects, artifacts │ │    PubSub     │ │   • Subagent Supervisor  │
│   • orbitbot schema:    │ └───────────────┘ │   • ForionMemoryStore    │
│     runs, leases, bots  │                   └──────────────────────────┘
└─────────────────────────┘
```

---

## 2. Unified Supabase Database Strategy (Single Instance)

Orbit and OrbitBot can run on the **same Supabase PostgreSQL instance** without database proliferation, provided a strict **PostgreSQL Schema Isolation** strategy is enforced.

### 2.1 The Two Deadly Pitfalls of the `public` Schema
1. **PostgREST Security Exposure**: Supabase automatically exposes tables in the `public` schema via PostgREST to `anon` and `authenticated` roles. OrbitBot tables (`ChatGroup`, `Bot`, `ModelCreditEntry`, `Space`) rely on custom session-variable RLS (`app.space_id`), not Supabase's `auth.uid()`. Placing OrbitBot tables in `public` would expose internal bot configuration and credit records over Supabase's public HTTP API.
2. **Prisma vs Drizzle Migration Collisions**: Orbit uses Drizzle ORM (`@forion/db`) with SQL migrations targeting `public`. OrbitBot uses Prisma (`packages/db`). Mixing both in `public` leads to migration lockups, index naming collisions, and sequence resets.

### 2.2 The Winning Blueprint: PostgreSQL Schema Isolation (`orbitbot`)

```
Supabase PostgreSQL Cluster
├── schema: "public"           ── Drizzle ORM (@forion/db)
│   ├── users                  (Authoritative User Accounts)
│   ├── projects               (Authoritative Workspaces)
│   ├── user_memories          (pgvector Semantic Memory Store)
│   ├── agent_v2_runs          (Authoritative Orbit Runs)
│   └── agent_artifacts        (Authoritative Generated Deliverables)
│
└── schema: "orbitbot"         ── Prisma Client (packages/db)
    ├── Bot                    (Execution Agent Personas & Instructions)
    ├── Space                  (Tenant Workspace Boundary -> mapped to project_id)
    ├── Run                    (Execution Runs & Leases)
    ├── Task                   (Execution Task Queue)
    ├── Computer               (Sandbox Instances & Screen Leases)
    └── ExternalEffect         (Idempotent Tool Execution Journal)
```

#### Exact Database Configuration Steps:

1. **Create the isolated schema in Supabase**:
   ```sql
   CREATE SCHEMA IF NOT EXISTS orbitbot;
   GRANT ALL ON SCHEMA orbitbot TO postgres, service_role;
   -- Revoke access from public web roles
   REVOKE ALL ON SCHEMA orbitbot FROM anon, authenticated;
   ```

2. **Configure Supabase PostgREST Settings**:
   In the Supabase Dashboard (`Settings -> API -> Exposed Schemas`), verify that **only `public`** is exposed. Do not expose `orbitbot`.

3. **Configure OrbitBot's Prisma (`packages/db/prisma/schema.prisma`)**:
   Enable multi-schema support:
   ```prisma
   datasource db {
     provider = "postgresql"
     url      = env("DATABASE_URL")
     schemas  = ["orbitbot"]
   }
   ```
   Tag every model in OrbitBot with `@@schema("orbitbot")`:
   ```prisma
   model Bot {
     id           String   @id @default(cuid())
     spaceId      String
     name         String
     instructions String?
     // ...
     @@schema("orbitbot")
   }
   ```

4. **Connection Pooling Rule (Critical Operational Guardrail)**:
   OrbitBot uses session-level variables for tenant isolation:
   `set_config('app.space_id', ..., false)` (in `row-security.ts:151`).
   - ⚠️ **NEVER connect OrbitBot through Supavisor Transaction Pooling (Port 6543)**. Transaction-mode pooling shares connections between transactions; session variables will leak across tenants or be wiped mid-run.
   - ✅ **ALWAYS connect OrbitBot using Direct Connection (Port 5432)** or **Supavisor Session Pooling**.

---

## 3. Bidirectional Memory Sharing Architecture

Orbit already has a semantic vector memory engine (`forion-server/src/memory/memory.service.ts`) with cosine similarity vector search (`<=>`), importance weights (`score = similarity * importance`), and category classification. OrbitBot has a decoupled `MemoryStore` interface.

```
┌────────────────────────────────────────────────────────────────────────┐
│                        BIDIRECTIONAL MEMORY FLOW                       │
├────────────────────────────────────────────────────────────────────────┤
│                                                                        │
│  [FLOW 1: Orbit -> OrbitBot] (Turn Context Preparation)               │
│                                                                        │
│   Orbit User Prompt ──► Forion MemoryService.search(userId, prompt)    │
│                                  │                                     │
│                                  ▼                                     │
│                     Top-5 Relevant Memories Retrieved                  │
│                                  │                                     │
│                                  ▼                                     │
│            Injected into OrbitBot PiAgentRuntime Context:              │
│            "<user_memory>- [preference] User prefers TS strict mode"   │
│                                                                        │
│ ────────────────────────────────────────────────────────────────────── │
│                                                                        │
│  [FLOW 2: OrbitBot -> Orbit] (Live Knowledge Ingestion)                │
│                                                                        │
│   OrbitBot Tool Call: remember("Deploy command is pnpm deploy", ...)   │
│                                  │                                     │
│                                  ▼                                     │
│   ForionMemoryStore ──► POST {forion-server}/internal/memory/store     │
│                                  │                                     │
│                                  ▼                                     │
│   Forion MemoryService: Computes Vector Embedding & Inserts into       │
│                         Supabase `public.user_memories` table          │
│                                                                        │
└────────────────────────────────────────────────────────────────────────┘
```

### 3.1 Flow 1: Orbit → OrbitBot (Context Hydration)

When a run is dispatched to OrbitBot:
1. Forion Server intercepts the run and queries semantic memory:
   ```ts
   const recalledMemories = await this.memoryService.search(userId, userMessage, {
     topK: 5,
     minSimilarity: 0.35,
   });
   ```
2. The memories are injected into the run dispatch payload:
   ```json
   {
     "orbitRunId": "run_01j7xyz...",
     "userId": "usr_998877",
     "message": "Fix the authentication token expiry",
     "injectedMemories": [
       { "category": "preference", "content": "Always use JWT with 15min expiry and refresh rotation" },
       { "category": "knowledge", "content": "PostgreSQL database runs on Supabase project ref xyz" }
     ]
   }
   ```
3. In OrbitBot (`packages/adapters/src/pi-runtime.ts`), the turn prompt prepends the recalled facts:
   ```markdown
   <user_persistent_memory>
   The following verified facts and user preferences are known from past sessions:
   - [preference]: Always use JWT with 15min expiry and refresh rotation
   - [knowledge]: PostgreSQL database runs on Supabase project ref xyz
   </user_persistent_memory>
   ```

### 3.2 Flow 2: OrbitBot → Orbit (Live Knowledge Ingestion)

When OrbitBot's agent decides to store a fact using `remember`, `save_memory`, or `save_shared_memory`:
1. In `orbit-bot`, implement the `ForionMemoryStore` adapter:
   ```ts
   export class ForionMemoryStore implements MemoryStore {
     constructor(private readonly forionClient: ForionInternalClient) {}

     async saveMemory(userId: string, input: { content: string; category?: string; importance?: number }): Promise<void> {
       await this.forionClient.post('/internal/memory/store', {
         userId,
         content: input.content,
         category: input.category ?? 'knowledge',
         importance: input.importance ?? 0.7,
         sourceType: 'tool',
       });
     }
     // ...
   }
   ```
2. In `forion-server`, the internal endpoint processes the memory:
   ```ts
   @Post('internal/memory/store')
   @UseGuards(InternalServiceAuthGuard)
   async storeInternalMemory(@Body() dto: StoreInternalMemoryDto) {
     return this.memoryService.store({
       userId: dto.userId,
       content: dto.content,
       category: dto.category,
       importance: dto.importance,
       sourceType: 'tool',
       sourceRunId: dto.sourceRunId,
     });
   }
   ```
3. `MemoryService` embeds the content via its embedding provider (`embedder.embed(content)`), assigns the importance score, and persists it to `public.user_memories`.
4. **Immediate Visibility**: Next time the user asks *any* question in Orbit or triggers another bot, that fact is instantly indexed and searchable.

---

## 4. Native Direct Execution: "Ask OrbitBot" via Orbit

Users in Orbit can invoke OrbitBot directly through Orbit Web's chat interface (e.g. typing `@OrbitBot`, choosing OrbitBot from the mode selector, or clicking an "Ask OrbitBot" action).

### 4.1 Request & Response Lifecycle

```
[ Orbit Web Client ]
         │
         │  POST /api/chat-agent
         │  Body: { conversationId, message, agentTarget: "orbitbot", projectId }
         ▼
[ Forion Server (ExecutionController) ]
         │
         ├─ 1. Authenticate user session (JWE cookie)
         ├─ 2. Enforce credit gate (CreditsService.assertMinimumBalance)
         ├─ 3. Query MemoryService for user context
         ├─ 4. Sign internal service request (HMAC: X-Orbit-Req-Sig)
         │
         ▼  POST http://orbitbot-api:3100/internal/runs/dispatch
[ OrbitBot API (Internal Service Router) ]
         │
         ├─ 1. Verify HMAC signature
         ├─ 2. Map orbit_project_id -> Space; orbit_user_id -> Actor
         ├─ 3. Mint execution lease & enqueue run in RunWorkerHost
         │
         ▼
[ OrbitBot Worker (PiAgentRuntime) ]
         │
         ├─ Model Stream & Tool Loop (shell, write_file, browser, subagents)
         │
         ▼  Emits ProductEvents to OrbitBot SSE Channel
[ Forion Server Normalizer (RunPubSubService) ]
         │
         ├─ Translates ProductEvent -> OrbitEvent in real time
         │
         ▼  SSE Stream (text/event-stream)
[ Orbit Web Client ]
         Renders live streaming text, tool execution cards, subagent status
```

### 4.2 Event Normalization Matrix

OrbitBot's internal event format (`ProductEvent`) is mapped into Orbit's client protocol (`OrbitEvent`):

| OrbitBot Event (`ProductEvent`) | Translated Orbit Event (`OrbitEvent`) | Web UI Rendering |
|---|---|---|
| `run.started` | `agent_started` | Bot avatar lights up; status changes to "Thinking..." |
| `thread.progress { delta, streaming: true }` | `token_stream` | Smooth markdown text streaming in chat bubble |
| `thread.progress { text, activity: true }` | `normalized_activity` | Activity status badge ("Reading workspace files...") |
| `agent.tool.called` | `tool_call_started` | Interactive tool card showing tool name and params |
| `agent.tool.completed` | `tool_result` | Tool output drawer (files written, commands run) |
| `thread.subagent` | `swarm_child_event` | Subagent pill showing child bot working in parallel |
| `thread.artifact` | `artifact_created` / `artifact_updated` | Artifact drawer opens with code/document preview |
| `run.waiting_input` | `question_asked` | Interactive form asking user for input or approval |
| `run.completed` | `agent_completed` | Completion checkmark, timing, and token summary |
| `run.failed` | `agent_error` | Terminal error card with retry action |

---

## 5. Security, Credits & Sandbox Isolation

### 5.1 Service-to-Service Authentication (HMAC Bridge)
Orbit and OrbitBot do not share session cookies. Orbit uses JWE cookies while OrbitBot internally uses Better Auth.
- **The Bridge**: Forion Server calls OrbitBot's internal endpoints using an HMAC-SHA256 signature (`X-Orbit-Req-Sig`) calculated over `timestamp + "." + body` using a shared `INTERNAL_SERVICE_SECRET`.
- OrbitBot's internal routes reject any call without a valid signature or with a timestamp older than 60 seconds.

### 5.2 Credit Metering & Fail-Closed Protection
OrbitBot already has an extensible `ModelCallObserver` interface (`packages/adapter-kit/src/types.ts:559`):
```ts
export interface ModelCallObserver {
  beforeCall(details: ModelCallDetails): Promise<string>; // returns reservationId
  afterCall(reservationId: string, usage: NormalizedUsage): Promise<void>;
  onRequestId(reservationId: string, providerRequestId: string): void;
}
```
- In managed mode, OrbitBot's internal billing tables are bypassed.
- Orbit injects `OrbitCreditObserver`:
  1. `beforeCall`: Checks the user's credit balance in Orbit (`CreditsService`). If the balance is insufficient, it throws an error immediately before any LLM API call is made.
  2. `afterCall`: Deducts the actual recorded tokens and cost from Orbit's credit ledger.
  3. Every subagent call (`operationKind: "subagent"`) inherits the same observer with the initiating `orbit_run_id`.

### 5.3 Sandbox Isolation
- **Studio/Build Sandboxes**: Managed by Forion Runtime (`forion-nestjs-runtime`) for previewing Vite/Next.js web apps.
- **Agent Computer Sandboxes**: Managed by OrbitBot (`E2BSandboxProvider`). OrbitBot uses E2B's desktop template with screen streaming and terminal execution.
- Both use the shared E2B team credentials (`E2B_API_KEY`), but each service owns its own sandbox IDs to prevent lifecycle conflicts.

---

## 6. Entity & Data Mapping Reference

| Entity | Canonical Owner | OrbitBot Representation | Storage Location | Notes |
|---|---|---|---|---|
| **User** | Orbit (`users`) | `Actor { userId, spaceId }` | `public.users` | 1:1 match. OrbitBot mirrors user ID as projection. |
| **Workspace / Project** | Orbit (`projects`) | `Space` | `public.projects` / `orbitbot.Space` | 1:1 match. One Space per Orbit project. |
| **User Memory** | Orbit (`user_memories`) | `MemoryStore` | `public.user_memories` | Stored exclusively in Orbit via pgvector. |
| **Execution Run** | Orbit (`agent_v2_runs`) | `Run` | Both schemas | Correlated by `orbit_run_id` in `Run.clientNonce`. |
| **Artifacts** | Orbit (`agent_artifacts`) | `Artifact` | `public.agent_artifacts` | Orbit owns the file bytes; OrbitBot generates revisions. |
| **Computer / VM** | OrbitBot (`Computer`) | `Computer` | `orbitbot.Computer` | Leased per bot, scoped to project workspace. |

---

## 7. Phased Implementation Roadmap

```
Phase 1: Database Setup ──► Phase 2: Service Auth ──► Phase 3: Memory Bridge ──► Phase 4: Run Dispatch ──► Phase 5: UI
(Supabase Schema)           (HMAC Internal API)       (Bidirectional Sync)        (SSE Normalizer)          (Ask OrbitBot)
```

### Phase 1: Supabase Schema Configuration
- [ ] Run `CREATE SCHEMA orbitbot;` on the Supabase PostgreSQL database.
- [ ] Ensure Supabase PostgREST exposes only `public`.
- [ ] Add `schemas = ["orbitbot"]` to OrbitBot's `schema.prisma` and run `prisma db push`.
- [ ] Verify database connection string uses direct connection (Port 5432).

### Phase 2: Service-to-Service Internal API Bridge
- [ ] Generate shared secret `ORBIT_INTERNAL_SERVICE_SECRET`.
- [ ] Add HMAC verification middleware in OrbitBot (`apps/api`).
- [ ] Add `POST /internal/runs/dispatch` and `POST /internal/runs/:id/abort` in OrbitBot.

### Phase 3: Bidirectional Memory Sync Adapter
- [ ] Add `POST /internal/memory/store` and `GET /internal/memory/search` to Forion Server (`MemoryModule`).
- [ ] Implement `ForionMemoryStore` in OrbitBot implementing `MemoryStore`.
- [ ] Wire `remember` tool calls in OrbitBot to persist directly into Forion's `user_memories`.

### Phase 4: Run Dispatcher & SSE Normalizer
- [ ] Implement `OrbitBotExecutionService` in Forion Server to dispatch runs to OrbitBot.
- [ ] Build the `ProductEvent` → `OrbitEvent` transformer to translate streaming tokens, tool states, and subagent updates into Orbit's SSE protocol.
- [ ] Wire `OrbitCreditObserver` into OrbitBot's `ModelCallObserver` seam for real-time credit tracking.

### Phase 5: Orbit Web UI Integration
- [ ] Add "@OrbitBot" mention detection in Orbit's chat composer (`apps/web` or `orbit`).
- [ ] Add "Ask OrbitBot" button toggle in the Orbit workspace header.
- [ ] Test end-to-end execution: prompt -> memory recall -> tool execution in sandbox -> live SSE streaming -> memory ingestion -> final answer.

---
*Report compiled and verified against Orbit and OrbitBot microservice architectures.*

