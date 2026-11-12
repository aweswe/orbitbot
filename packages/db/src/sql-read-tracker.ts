import type { Pool, PoolClient, QueryResult } from "pg";

/** One statement's returned rows, as sent by Postgres. */
export interface SqlRead {
  text: string;
  values: unknown[];
  rowCount: number;
  rows: unknown[];
  fields: string[];
}

function sqlText(input: unknown): string {
  if (typeof input === "string") return input;
  if (input && typeof input === "object" && "text" in input && typeof input.text === "string")
    return input.text;
  return "";
}

function sqlValues(args: unknown[]): unknown[] {
  const [first, second] = args;
  if (Array.isArray(second)) return second;
  if (first && typeof first === "object" && "values" in first && Array.isArray(first.values))
    return first.values;
  return [];
}

/**
 * Record SELECT statements matching `matches`, however they reach the pool.
 *
 * Prisma sends one-off queries through `pool.query` but a context transaction
 * checks out a client and sends them through `client.query`. Wrap the checkout
 * so both paths are measured once.
 */
export function trackPoolReads(pool: Pool, matches: (text: string) => boolean): SqlRead[] {
  const reads: SqlRead[] = [];
  const tracked = new WeakSet<PoolClient>();
  const record = (args: unknown[], result: QueryResult) => {
    const text = sqlText(args[0]);
    if (/^\s*select\b/i.test(text) && matches(text))
      reads.push({
        text,
        values: sqlValues(args),
        rowCount: result.rowCount ?? 0,
        rows: result.rows ?? [],
        fields: result.fields?.map((field) => field.name) ?? [],
      });
  };
  const wrap = (client: PoolClient) => {
    if (tracked.has(client)) return;
    tracked.add(client);
    const original = client.query.bind(client);
    client.query = ((...args: unknown[]) => {
      const result = (original as (...inner: unknown[]) => unknown)(...args);
      if (!result || typeof (result as Promise<unknown>).then !== "function") return result;
      return (result as Promise<QueryResult>).then((queryResult) => {
        record(args, queryResult);
        return queryResult;
      });
    }) as PoolClient["query"];
  };
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
    if (!callback)
      return originalConnect().then((client) => {
        wrap(client);
        return client;
      });
    originalConnect((err, client, done) => {
      if (client) wrap(client);
      callback(err, client, done);
    });
  }

  pool.connect = connect as Pool["connect"];
  return reads;
}
