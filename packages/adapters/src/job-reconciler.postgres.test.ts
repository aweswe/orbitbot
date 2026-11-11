import { randomUUID } from "node:crypto";
import type { BackgroundJob, JobPublisher } from "@forion/orbit-adapter-kit";
import { asSystem, createDb, provisionMessagingIdentity, runAsSystem } from "@forion/orbit-db";
import { Pool } from "pg";
import { describe, expect, it } from "vitest";
import { createJobReconciler, createPostgresReconciliationLeadership } from "./job-reconciler.js";

const databaseUrl = process.env.DATABASE_URL;
const describePostgres =
  process.env.VERIFY_DATABASE && databaseUrl ? describe.sequential : describe.skip;

describePostgres("job reconciliation leadership (PostgreSQL contract)", () => {
  const pool = () => new Pool({ connectionString: databaseUrl!, max: 4 });
  const lockId = () => `test-${randomUUID()}`;

  it("elects one lease owner and hands leadership to a follower after release", async () => {
    const db = pool();
    const id = lockId();
    const first = createPostgresReconciliationLeadership(db, { lockId: id });
    const second = createPostgresReconciliationLeadership(db, { lockId: id });

    try {
      await expect(first.tryAcquire()).resolves.toBe(true);
      await expect(second.tryAcquire()).resolves.toBe(false);

      await first.release();
      await expect(second.tryAcquire()).resolves.toBe(true);
    } finally {
      await first.release();
      await second.release();
      await db.end();
    }
  });

  it("renews a live lease with its heartbeat", async () => {
    const db = pool();
    const id = lockId();
    const first = createPostgresReconciliationLeadership(db, { lockId: id, leaseMs: 200 });
    const second = createPostgresReconciliationLeadership(db, { lockId: id });

    try {
      await expect(first.tryAcquire()).resolves.toBe(true);
      await new Promise((resolve) => setTimeout(resolve, 350));
      await expect(second.tryAcquire()).resolves.toBe(false);
    } finally {
      await first.release();
      await second.release();
      await db.end();
    }
  });

  it("lets a follower recover an expired lease after a crash", async () => {
    const db = pool();
    const id = lockId();
    const crashed = createPostgresReconciliationLeadership(db, {
      lockId: id,
      leaseMs: 100,
      heartbeatMs: 10_000,
    });
    const follower = createPostgresReconciliationLeadership(db, { lockId: id, leaseMs: 100 });

    try {
      await expect(crashed.tryAcquire()).resolves.toBe(true);
      await new Promise((resolve) => setTimeout(resolve, 180));
      await expect(follower.tryAcquire()).resolves.toBe(true);
      // The old owner cannot renew or delete the new owner's row.
      await expect(crashed.tryAcquire()).resolves.toBe(false);
      await crashed.release();
      await expect(follower.tryAcquire()).resolves.toBe(true);
    } finally {
      await crashed.release();
      await follower.release();
      await db.end();
    }
  });

  it("elects exactly one of many concurrent contenders", async () => {
    const db = pool();
    const id = lockId();
    const leaders = Array.from({ length: 8 }, () =>
      createPostgresReconciliationLeadership(db, { lockId: id }),
    );
    try {
      const results = await Promise.all(leaders.map((leader) => leader.tryAcquire()));
      expect(results.filter(Boolean)).toHaveLength(1);
    } finally {
      await Promise.all(leaders.map((leader) => leader.release()));
      await db.end();
    }
  });

  it("fails closed when the database is unreachable", async () => {
    const db = new Pool({
      connectionString: databaseUrl!.replace(/:\d+\//, ":1/"),
      max: 1,
      connectionTimeoutMillis: 200,
    });
    const leader = createPostgresReconciliationLeadership(db, {
      lockId: lockId(),
      leaseMs: 100,
    });
    try {
      await expect(leader.tryAcquire()).resolves.toBe(false);
    } finally {
      await leader.release();
      await db.end().catch(() => undefined);
    }
  });
});

describePostgres("bounded routine reconciliation (PostgreSQL contract)", () => {
  it("reads stable routine pages from the current schema in one pass", async () => {
    const db = createDb(databaseUrl!);
    const system = asSystem(db.prisma);
    const address = `reconciler-${randomUUID()}@example.test`;
    let identity: Awaited<ReturnType<typeof provisionMessagingIdentity>> | undefined;
    try {
      identity = await runAsSystem("reconciliation fixture", () =>
        provisionMessagingIdentity(
          db.prisma,
          { provider: "email", address },
          {
            signupsEnabled: undefined,
            signupAllowlist: undefined,
          },
        ),
      );
      const nextRunAt = new Date(Date.now() - 1_000);
      const prefix = `routine-${randomUUID()}-`;
      await system.routine.createMany({
        data: Array.from({ length: 250 }, (_, i) => ({
          spaceId: identity!.spaceId,
          userId: identity!.userId,
          botId: identity!.botId,
          threadId: identity!.threadId,
          id: `${prefix}${String(i).padStart(4, "0")}`,
          name: "Recovery fixture",
          prompt: "fixture",
          crons: ["* * * * *"],
          active: true,
          nextRunAt,
        })),
      });
      const published: BackgroundJob[] = [];
      const jobs: JobPublisher = {
        enqueue: async (job) => {
          published.push(job);
        },
        cancel: async () => undefined,
        close: async () => undefined,
      };
      const run = (maxPagesPerPass: number) =>
        runAsSystem("reconcile jobs", () =>
          createJobReconciler({ prisma: db.prisma, jobs }, { maxPagesPerPass }).reconcileOnce(),
        );
      // Other due routines in a shared database can join a page, so only one page's
      // size is asserted globally and the drained set is checked for this fixture.
      await run(1);
      expect(published.filter((job) => job.name === "routine.wakeup")).toHaveLength(100);
      published.length = 0;
      await run(10);
      const routines = published.filter((job) => job.replaceKey?.startsWith(`routine:${prefix}`));
      expect(routines).toHaveLength(250);
      expect(new Set(routines.map((job) => job.replaceKey)).size).toBe(250);
      expect(routines.every((job) => job.availableAt?.getTime() === nextRunAt.getTime())).toBe(
        true,
      );
    } finally {
      if (identity) {
        await system.messagingIdentity.deleteMany({ where: { address } });
        await system.organization.deleteMany({ where: { id: identity.spaceId } });
        await system.user.deleteMany({ where: { id: identity.userId } });
      }
      await db.prisma.$disconnect();
      await db.pool.end();
    }
  });
});
