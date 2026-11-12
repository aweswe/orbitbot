import { AsyncLocalStorage } from "node:async_hooks";
import { createHmac } from "node:crypto";
import { getLogger } from "@forion/orbit-logging";
import type { Pool, PoolClient } from "pg";
import type { PrismaClient } from "./generated/prisma/client.js";
import { Prisma } from "./generated/prisma/client.js";
import { withTransactionRetry } from "./transaction-retry.js";

/**
 * Who a database operation runs for. Row-level security policies read the
 * matching `app.*` settings on the connection that runs the statement.
 *
 * - `tenant`: rows are limited to one Space (and, for user-owned rows, one user).
 * - `system`: an explicit, named bypass for work that legitimately spans
 *   tenants (job dispatch, reconcilers, webhooks before they resolve a tenant).
 *
 * Without a context, protected tables return no rows and reject writes.
 */
export type DbContext =
  | { kind: "tenant"; spaceId: string; userId: string }
  | { kind: "system"; reason: string };

const storage = new AsyncLocalStorage<DbContext>();

export function currentDbContext(): DbContext | undefined {
  return storage.getStore();
}

export function runAsTenant<T>(
  tenant: { spaceId: string; userId: string },
  fn: () => T | PromiseLike<T>,
): Promise<T> {
  if (!tenant.spaceId || !tenant.userId)
    throw new Error("runAsTenant requires a non-empty spaceId and userId");
  return within({ kind: "tenant", spaceId: tenant.spaceId, userId: tenant.userId }, fn);
}

/**
 * Run `fn` across tenants. Each call is an audited bypass of row-level
 * security, so name why: `grep -rn "runAsSystem("` lists every one.
 */
export function runAsSystem<T>(reason: string, fn: () => T | PromiseLike<T>): Promise<T> {
  return within({ kind: "system", reason }, fn);
}

/**
 * The same client with every call run as an explicit system context, for test
 * fixtures and assertions that have no request or job around them. Code under
 * test keeps the context its request or job gives it.
 */
export function asSystem<T extends object>(client: T, reason = "test fixture"): T {
  return new Proxy(client, {
    get(target, key) {
      const value = Reflect.get(target, key);
      if (typeof value === "function") {
        return (...args: unknown[]) =>
          runAsSystem(reason, () => Reflect.apply(value, target, args));
      }
      if (value && typeof value === "object") return asSystem(value, reason);
      return value;
    },
  });
}

type SqlClient = Pick<PrismaClient, "$queryRaw">;

/**
 * runAsSystem for a step inside an interactive transaction a tenant opened: the
 * transaction's connection keeps the settings it was checked out with, so this
 * turns the bypass on for `fn` and back afterwards. Name why, as for runAsSystem.
 */
export async function runAsSystemInTransaction<T>(
  tx: SqlClient,
  reason: string,
  fn: () => Promise<T>,
): Promise<T> {
  const [previous] = await tx.$queryRaw<
    Array<{ bypass: string | null; key: string | null; login: string }>
  >`SELECT current_setting('app.rls_bypass', true) AS bypass,
      current_setting('app.rls_bypass_key', true) AS key, session_user AS login`;
  const restore = () =>
    tx.$queryRaw`SELECT set_config('app.rls_bypass', ${previous?.bypass ?? "off"}, true),
      set_config('app.rls_bypass_key', ${previous?.key ?? ""}, true)`;
  await tx.$queryRaw`SELECT set_config('app.rls_bypass', 'on', true),
    set_config('app.rls_bypass_key', ${bypassKeys.get(previous?.login ?? "") ?? ""}, true)`;
  let result: T;
  try {
    result = await within({ kind: "system", reason }, fn);
  } catch (error) {
    // A failed statement aborts the transaction, which drops the local setting anyway.
    await restore().catch(() => undefined);
    throw error;
  }
  await restore();
  return result;
}

// Prisma operations are lazy and start when awaited. Await inside the scope so
// an operation returned from `fn` still runs with this context.
function within<T>(context: DbContext, fn: () => T | PromiseLike<T>): Promise<T> {
  return storage.run(context, async () => await fn());
}

export const ROW_SECURITY_MODELS: ReadonlySet<string> = new Set([
  "BillingAuditEvent",
  "PushToken",
  "CallPushDevice",
  "EmailSend",
  "Thread",
  "Message",
  "Event",
  "MemoryDocument",
  "MemoryRevision",
  "Artifact",
  "Secret",
  "BotSecret",
  "VaultCredential",
  "AgentSecret",
  "UserModelCredential",
  "UserVoiceCredential",
  "TrustedLinkSite",
  "FeedbackReport",
  "PaymentWallet",
  "Purchase",
  "SpendingLimit",
  "Payment",
  "TaughtSkill",
  "AgentSkill",
  "AgentSkillSpace",
  "CapabilityInstallSpace",
  "AgentImport",
  "Bot",
  "Run",
  "Task",
  "Routine",
  "Connection",
  "McpServer",
  "McpServerSpace",
  "McpOAuthSession",
  "ModelOAuthSession",
  "BotMcpServer",
  "Computer",
  "ComputerRun",
  "HomeDeletionNotice",
  "Board",
  "Ticket",
  "TicketComment",
  "MessagingIdentity",
  "MessagingInstallation",
  "MessagingInstallSession",
  "MessagingOutbound",
  "ExternalConversation",
  "ExternalMessage",
  "SteeringMessage",
  "UsageRecord",
  "ScratchpadItem",
  "BotEmailMessage",
  "ActionApprovalRule",
  "SpaceModelRoleChoice",
  "SpaceSettingOverride",
  "UserModelRoleChoice",
  "UserModelPreference",
  "UserVoicePreference",
  "UserActionApprovalRule",
  "UserActionAutoReviewPreference",
  "SecurityEvent",
  "AuditEvent",
  "Page",
  "PageVersion",
]);

/**
 * Proves a system context to the database. The policies honour app.rls_bypass only
 * alongside this key, whose digest `pnpm db:migrate` stores where the runtime role
 * cannot read it, so SQL that runs for a tenant cannot turn the bypass on itself.
 * Derived from the runtime login's password, so it needs no setting of its own.
 */
export function rlsBypassKey(connectionString: string | undefined): string {
  const { password } = credentials(connectionString);
  return password ? createHmac("sha256", password).update("rakazo rls bypass").digest("hex") : "";
}

// As pg-connection-string reads them: query parameters win over the URL's userinfo, and a
// stray `%` is escaped first.
function credentials(connectionString: string | undefined): { user: string; password: string } {
  let normalized = connectionString ?? "";
  if (/ |%[^a-f0-9]|%[a-f0-9][^a-f0-9]/i.test(normalized))
    normalized = encodeURI(normalized).replace(/%25(\d\d)/g, "%$1");
  try {
    const url = new URL(normalized);
    return {
      user: url.searchParams.get("user") || decodeURIComponent(url.username),
      password: url.searchParams.get("password") || decodeURIComponent(url.password),
    };
  } catch {
    return { user: "", password: "" };
  }
}

// By login, for runAsSystemInTransaction, which only has the transaction's connection.
const bypassKeys = new Map<string, string>();

type Settings = [
  spaceId: string,
  userId: string,
  bypass: "on" | "off",
  bypassKey: string,
  schema: string,
];

function settingsFor(context: DbContext | undefined, bypassKey: string, schema: string): Settings {
  if (context?.kind === "tenant") return [context.spaceId, context.userId, "off", "", schema];
  if (context?.kind === "system") return ["", "", "on", bypassKey, schema];
  return ["", "", "off", "", schema];
}

/**
 * Prisma's `?schema=` is applied to its own queries, but raw SQL in this package
 * is written unqualified. A direct connection gets the schema from the startup
 * `options`; a transaction pooler ignores startup options, so every transaction
 * also sets `search_path` locally.
 */
function settingNames(settings: Settings): Array<[string, string]> {
  const values: Array<[string, string]> = [
    ["app.space_id", settings[0]],
    ["app.user_id", settings[1]],
    ["app.rls_bypass", settings[2]],
    ["app.rls_bypass_key", settings[3]],
  ];
  if (settings[4]) values.push(["search_path", settings[4]]);
  return values;
}

function localSettings(settings: Settings): Prisma.Sql {
  return Prisma.sql`SELECT ${Prisma.join(
    settingNames(settings).map(([name, value]) => Prisma.sql`set_config(${name}, ${value}, true)`),
  )}`;
}

function settingsStatement(settings: Settings, local: boolean): { text: string; values: string[] } {
  const names = settingNames(settings);
  return {
    text: `SELECT ${names
      .map((_, index) => `set_config($${index * 2 + 1}, $${index * 2 + 2}, ${local})`)
      .join(", ")}`,
    values: names.flat(),
  };
}

const applied = new WeakMap<PoolClient, string>();

async function applySettings(client: PoolClient, schema: string): Promise<void> {
  if (!schema) return;
  // A new connection has no search_path yet.
  if (applied.get(client) === schema) return;
  // Forget the old value first: if this fails, the next checkout sets it again.
  applied.delete(client);
  await client.query("SELECT set_config('search_path', $1, false)", [schema]);
  applied.set(client, schema);
}

/**
 * Give every connection checked out of `pool` the schema from its connection
 * string, captured when `connect` is called (the callback of a queued checkout
 * can run in whichever request released the connection).
 *
 * Only `search_path` is session state. The `app.*` RLS settings are never
 * applied at checkout: a transaction pooler can leave them on a server
 * connection another client later uses, so a context-free query could see rows
 * it must not. They are set transaction-locally instead (see
 * withRowLevelSecurity and createScopedQuery), which also makes a missing
 * context fail closed.
 */
export function installDbContext(pool: Pool, options: { schema?: string } = {}): void {
  const { connectionString } = pool.options;
  const bypassKey = rlsBypassKey(connectionString);
  const schema = options.schema ?? "";
  if (bypassKey) bypassKeys.set(credentials(connectionString).user, bypassKey);
  type ConnectCallback = (
    err: Error | undefined,
    client: PoolClient | undefined,
    done: (release?: unknown) => void,
  ) => void;
  const originalConnect = pool.connect.bind(pool) as {
    (): Promise<PoolClient>;
    (callback: ConnectCallback): void;
  };

  function connect(): Promise<PoolClient>;
  function connect(callback: ConnectCallback): void;
  function connect(callback?: ConnectCallback): Promise<PoolClient> | undefined {
    if (!callback) {
      return originalConnect().then(async (client) => {
        try {
          await applySettings(client, schema);
          return client;
        } catch (error) {
          client.release(error as Error);
          throw error;
        }
      });
    }
    originalConnect((err, client, done) => {
      if (err || !client) return callback(err, client, done);
      applySettings(client, schema).then(
        () => callback(undefined, client, done),
        (error: Error) => {
          done(error);
          callback(error, undefined, () => undefined);
        },
      );
    });
  }

  pool.connect = connect as Pool["connect"];
}

export interface ScopedQuery {
  query<T = Record<string, unknown>>(text: string, values?: unknown[]): Promise<{ rows: T[] }>;
}

/**
 * Set the current context locally on a client the caller already checked out
 * and put inside a transaction. For raw test barriers and diagnostics; the
 * application paths use createScopedQuery or Prisma.
 */
export async function applyLocalContext(client: PoolClient, schema = ""): Promise<void> {
  const { rows } = await client.query<{ login: string }>("SELECT session_user AS login");
  const bypassKey = bypassKeys.get(rows[0]?.login ?? "") ?? "";
  const statement = settingsStatement(settingsFor(storage.getStore(), bypassKey, schema), true);
  await client.query(statement.text, statement.values);
}

/**
 * Queryable for raw SQL outside Prisma (the content-key store). Each statement
 * runs in its own transaction with the caller's context set locally, so a
 * transaction pooler can neither lose the settings nor reuse a server
 * connection that carries someone else's.
 */
export function createScopedQuery(pool: Pool, options: { schema?: string } = {}): ScopedQuery {
  const bypassKey = rlsBypassKey(pool.options.connectionString);
  const schema = options.schema ?? "";
  return {
    async query<T>(text: string, values?: unknown[]) {
      const settings = settingsFor(storage.getStore(), bypassKey, schema);
      const client = await pool.connect();
      let failure: Error | undefined;
      try {
        await client.query("BEGIN");
        const statement = settingsStatement(settings, true);
        await client.query(statement.text, statement.values);
        const result = await client.query(text, values);
        await client.query("COMMIT");
        return { rows: result.rows as T[] };
      } catch (error) {
        failure = error instanceof Error ? error : new Error(String(error));
        await client.query("ROLLBACK").catch(() => undefined);
        throw error;
      } finally {
        client.release(failure);
      }
    },
  };
}

const WRAPPED_OPERATION_OPTIONS = { maxWait: 10_000, timeout: 300_000 };

type InternalParams = { transaction?: { kind?: string }; dataPath?: unknown[] };

const reportedMissing = new Set<string>();
const MAX_REPORTED = 500;

// The database already returns nothing here, so log once per call site to point
// at the missing runAsTenant / runAsSystem instead of an empty result.
function missingContext(model: string, operation: string): void {
  const error = new Error(`${model}.${operation} ran outside runAsTenant/runAsSystem`);
  const callSite = (error.stack ?? "")
    .split("\n")
    .slice(1)
    .filter((frame) => !/row-security|@prisma|node:internal/.test(frame))
    .slice(0, 3)
    .join("\n");
  const key = `${model}.${operation}\n${callSite}`;
  if (reportedMissing.has(key) || reportedMissing.size >= MAX_REPORTED) return;
  reportedMissing.add(key);
  getLogger().error("database access without a tenant or system context", error, {
    model,
    operation,
  });
}

/**
 * The call sites logged since the last call, cleared as they are returned. Test
 * runs fail on any, so a path that reaches a protected table without a context
 * is caught in CI instead of returning nothing in production.
 */
export function drainUnscopedDatabaseAccess(): string[] {
  const sites = [...reportedMissing];
  reportedMissing.clear();
  return sites;
}

/**
 * Makes every query carry its context on the transaction that runs it.
 *
 * Prisma decides when a connection is checked out, and a transaction pooler may
 * run the next transaction on a different server connection. Settings applied at
 * checkout therefore cannot be trusted: they can be absent, or left behind by
 * another client. With a context, each operation runs in a short transaction
 * that sets `app.*` and `search_path` locally first, and an interactive
 * `$transaction` gets the same settings at its own start. Local settings end at
 * COMMIT or ROLLBACK, so they cannot leak to another user, Space or checkout.
 *
 * A batch `$transaction([...])` is rejected inside a context: its statements
 * start on a later tick, so the context that built them is no longer known.
 */
export function withRowLevelSecurity(
  prisma: PrismaClient,
  bypassKey = "",
  schema = "",
): PrismaClient {
  const runInContext = (context: DbContext, query: () => Prisma.PrismaPromise<unknown>) =>
    withTransactionRetry(async () => {
      const [, result] = await prisma.$transaction(
        [prisma.$executeRaw(localSettings(settingsFor(context, bypassKey, schema))), query()],
        WRAPPED_OPERATION_OPTIONS as never,
      );
      return result;
    });

  // A raw batch of [settings, query] can be dispatched to different pooled
  // server connections, losing the local search_path. Run raw SQL in one
  // interactive transaction instead.
  const runRawInContext = (context: DbContext, operation: string, args: unknown) =>
    withTransactionRetry(() =>
      prisma.$transaction(async (tx) => {
        await tx.$executeRaw(localSettings(settingsFor(context, bypassKey, schema)));
        return dispatchRaw(tx, operation, args);
      }, WRAPPED_OPERATION_OPTIONS),
    );

  const wrapped = prisma.$extends({
    query: {
      async $allOperations({ model, operation, args, query, ...rest }) {
        const internal = (rest as { __internalParams?: InternalParams }).__internalParams;
        const transaction = internal?.transaction;
        const context = storage.getStore();
        // A lone statement that lost a deadlock changed nothing, so it can run again; a
        // transaction's statements are retried by whoever opened the transaction.
        const run = () => (transaction ? query(args) : withTransactionRetry(() => query(args)));
        if (!context) {
          if (model && ROW_SECURITY_MODELS.has(model)) missingContext(model, operation);
          return run();
        }
        if (transaction?.kind === "batch") {
          throw new Error(
            "Batch $transaction([...]) cannot carry a database context; use an interactive transaction",
          );
        }
        // The transaction set this context locally when it opened.
        if (transaction) return query(args);
        // Raw SQL may name a protected table and cannot be re-dispatched by
        // query(); run it in an interactive transaction with the settings.
        if (!model) return runRawInContext(context, operation, args);
        return runInContext(context, () => query(args));
      },
    },
  }) as unknown as PrismaClient;

  return wrapped;
}

/**
 * Put the caller's context at the start of every interactive transaction. Call
 * this on the client the application uses, after every `$extends`, because a
 * later extension returns a client with its own `$transaction`.
 */
export function installTransactionContext(client: PrismaClient, bypassKey = "", schema = ""): void {
  const original = client.$transaction?.bind(client) as
    | ((input: unknown, options?: unknown) => Promise<unknown>)
    | undefined;
  if (!original) return;
  client.$transaction = ((input: unknown, options?: unknown) => {
    if (typeof input !== "function") return original(input, options);
    const context = storage.getStore();
    if (!context) return original(input, options);
    const settings = settingsFor(context, bypassKey, schema);
    return original(async (tx: Prisma.TransactionClient) => {
      await tx.$executeRaw(localSettings(settings));
      return (input as (tx: Prisma.TransactionClient) => Promise<unknown>)(tx);
    }, options);
  }) as PrismaClient["$transaction"];

  // Application modules add extensions after createDb (secret persistence,
  // content filters, ...). Each returns a client with its own $transaction, so
  // carry this wrapper forward instead of losing the context.
  const extend = (
    client as unknown as {
      $extends?: (...args: unknown[]) => PrismaClient;
    }
  ).$extends?.bind(client);
  if (!extend) return;
  (client as unknown as { $extends: (...args: unknown[]) => PrismaClient }).$extends = (
    ...args: unknown[]
  ) => {
    const extended = extend(...args);
    installTransactionContext(extended, bypassKey, schema);
    return extended;
  };
}

type RawTemplate = { strings?: unknown[]; values?: unknown[] };

/** Rebuild the tagged template as Sql so parameter types keep Prisma's mapping. */
function interpolatedSql(template: RawTemplate): Prisma.Sql {
  const strings = template.strings ?? [];
  const values = template.values ?? [];
  let sql: Prisma.Sql = Prisma.raw(String(strings[0] ?? ""));
  for (let index = 0; index < values.length; index += 1)
    sql = Prisma.sql`${sql}${values[index]}${Prisma.raw(String(strings[index + 1] ?? ""))}`;
  return sql;
}

function dispatchRaw(tx: Prisma.TransactionClient, operation: string, args: unknown): unknown {
  if (operation === "$queryRaw" || operation === "$executeRaw") {
    const sql = interpolatedSql(args as RawTemplate);
    return operation === "$queryRaw" ? tx.$queryRaw(sql) : tx.$executeRaw(sql);
  }
  if (operation === "$queryRawUnsafe" || operation === "$executeRawUnsafe") {
    const parameters = Array.from(args as unknown as ArrayLike<unknown>);
    const run = operation === "$queryRawUnsafe" ? tx.$queryRawUnsafe : tx.$executeRawUnsafe;
    return Reflect.apply(run, tx, parameters);
  }
  throw new Error(`Raw Prisma operation ${operation} cannot run inside a context transaction`);
}
