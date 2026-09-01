import { afterEach, beforeEach, describe, expect, it } from "@effect/vitest";
import { internal } from "@repo/backend/convex/_generated/api";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import {
  claimContentAnalyticsPartition,
  processClaimedContentAnalyticsPartition,
  scheduleAllContentAnalyticsPartitions,
} from "@repo/backend/convex/contents/analytics/impl";
import { invalidContentAnalyticsPartitionCode } from "@repo/backend/convex/contents/analytics/spec";
import {
  CONTENT_ANALYTICS_BATCH_SIZE,
  CONTENT_ANALYTICS_LEASE_DURATION_MS,
  CONTENT_ANALYTICS_PARTITIONS,
} from "@repo/backend/convex/contents/constants";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import schema from "@repo/backend/convex/schema";
import { convexModules } from "@repo/backend/convex/test.setup";
import { logger } from "@repo/backend/convex/utils/logger";
import { testMaterialGraph } from "@repo/backend/test/content/material";
import { convexTest, type TestConvex } from "convex-test";

const NOW = Date.parse("2026-01-01T00:00:00.000Z");
const SUBJECT_ROUTE = "material/lesson/mathematics/vector/addition";
const canonicalContext = {
  contextKey: "canonical",
  contextMode: "canonical",
} as const;
const subject = (() => {
  const graph = testMaterialGraph("vector", "addition", "en", "mathematics");
  return { ...graph, content_id: graph.assetId };
})();

/** Inserts one currently or previously leased analytics partition. */
async function insertPartition(
  ctx: MutationCtx,
  options: { leaseExpiresAt?: number; leaseVersion?: number } = {}
) {
  await ctx.db.insert("contentAnalyticsPartitions", {
    leaseExpiresAt:
      options.leaseExpiresAt ?? NOW + CONTENT_ANALYTICS_LEASE_DURATION_MS,
    leaseVersion: options.leaseVersion ?? 1,
    partition: 0,
  });
}

/** Enqueues repeated material views for one analytics partition. */
async function enqueueViews(ctx: MutationCtx, count: number, partition = 0) {
  for (let index = 0; index < count; index += 1) {
    await ctx.db.insert("learningEngagementQueue", {
      ...subject,
      ...canonicalContext,
      description: "Subject description",
      insertedAt: NOW + index,
      locale: "en",
      materialDomain: "mathematics",
      partition,
      route: SUBJECT_ROUTE,
      section: "material",
      scopeMode: "global",
      sourcePath: SUBJECT_ROUTE,
      title: "Vector Addition",
      viewerKey: `device:${partition}-${index}`,
      viewedAt: NOW + index,
    });
  }
}

/** Runs the production schedule-all implementation in one test transaction. */
function scheduleAll(target: TestConvex<typeof schema>) {
  return target.mutation((ctx) =>
    runConvexProgram(
      scheduleAllContentAnalyticsPartitions(
        ctx,
        internal.contents.mutations.analytics.scheduleContentAnalyticsPartition
      )
    )
  );
}

/** Runs the production lease claim implementation in one test transaction. */
function claim(target: TestConvex<typeof schema>, partition = 0) {
  return target.mutation((ctx) =>
    runConvexProgram(
      claimContentAnalyticsPartition(
        ctx,
        { partition },
        internal.contents.mutations.analytics.processContentAnalyticsPartition
      )
    )
  );
}

/** Runs the production bounded partition processor in one test transaction. */
function process(
  target: TestConvex<typeof schema>,
  options: { leaseVersion?: number; partition?: number } = {}
) {
  return target.mutation((ctx) =>
    runConvexProgram(
      processClaimedContentAnalyticsPartition(
        ctx,
        {
          leaseVersion: options.leaseVersion ?? 1,
          partition: options.partition ?? 0,
        },
        internal.contents.mutations.analytics.processContentAnalyticsPartition
      )
    )
  );
}

describe("contents/analytics/impl", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(NOW));
    vi.spyOn(logger, "info").mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("schedules only partitions that have queued views", async () => {
    const empty = convexTest(schema, convexModules);

    await expect(scheduleAll(empty)).resolves.toEqual({
      enqueuedPartitions: 0,
    });
    await expect(
      empty.query((ctx) =>
        ctx.db.system.query("_scheduled_functions").collect()
      )
    ).resolves.toEqual([]);

    const populated = convexTest(schema, convexModules);
    await populated.mutation(async (ctx) => {
      await enqueueViews(ctx, 1, 0);
      await enqueueViews(ctx, 1, 3);
    });

    await expect(scheduleAll(populated)).resolves.toEqual({
      enqueuedPartitions: 2,
    });
    await expect(
      populated.query(async (ctx) =>
        (await ctx.db.system.query("_scheduled_functions").collect()).map(
          (job) => job.args[0]
        )
      )
    ).resolves.toEqual([{ partition: 0 }, { partition: 3 }]);
  });

  it("creates one active lease and leaves it unchanged until expiry", async () => {
    const target = convexTest(schema, convexModules);
    await target.mutation((ctx) => enqueueViews(ctx, 1));

    await expect(claim(target)).resolves.toEqual({
      createdPartition: true,
      scheduled: true,
    });
    await expect(claim(target)).resolves.toEqual({
      createdPartition: false,
      scheduled: false,
    });

    const state = await target.query(async (ctx) => ({
      jobs: await ctx.db.system.query("_scheduled_functions").collect(),
      partitions: await ctx.db.query("contentAnalyticsPartitions").collect(),
    }));
    expect(state.jobs).toHaveLength(1);
    expect(state.partitions).toEqual([
      expect.objectContaining({
        leaseExpiresAt: NOW + CONTENT_ANALYTICS_LEASE_DURATION_MS,
        leaseVersion: 1,
        partition: 0,
      }),
    ]);
  });

  it("does not create a lease for an empty queue", async () => {
    const target = convexTest(schema, convexModules);

    await expect(claim(target)).resolves.toEqual({
      createdPartition: false,
      scheduled: false,
    });
    await expect(
      target.query((ctx) =>
        ctx.db.query("contentAnalyticsPartitions").collect()
      )
    ).resolves.toEqual([]);
  });

  it("reclaims an expired lease with a new version", async () => {
    const target = convexTest(schema, convexModules);
    await target.mutation(async (ctx) => {
      await enqueueViews(ctx, 1);
      await insertPartition(ctx, {
        leaseExpiresAt: NOW - 1,
        leaseVersion: 2,
      });
    });

    await expect(claim(target)).resolves.toEqual({
      createdPartition: false,
      scheduled: true,
    });
    await expect(
      target.query((ctx) => ctx.db.query("contentAnalyticsPartitions").unique())
    ).resolves.toMatchObject({
      leaseExpiresAt: NOW + CONTENT_ANALYTICS_LEASE_DURATION_MS,
      leaseVersion: 3,
      partition: 0,
    });
  });

  it("drains a partial batch and releases its lease", async () => {
    const target = convexTest(schema, convexModules);
    await target.mutation(async (ctx) => {
      await insertPartition(ctx);
      await enqueueViews(ctx, 2);
    });

    await expect(process(target)).resolves.toEqual({
      hasMore: false,
      partition: 0,
      processed: 2,
      skipped: false,
    });
    const state = await target.query(async (ctx) => ({
      partition: await ctx.db.query("contentAnalyticsPartitions").unique(),
      queue: await ctx.db.query("learningEngagementQueue").collect(),
    }));
    expect(state.partition).toMatchObject({
      lastProcessedAt: NOW,
      leaseExpiresAt: 0,
      leaseVersion: 1,
    });
    expect(state.queue).toEqual([]);
  });

  it("continues a full batch without releasing its lease", async () => {
    const target = convexTest(schema, convexModules);
    await target.mutation(async (ctx) => {
      await insertPartition(ctx);
      await enqueueViews(ctx, CONTENT_ANALYTICS_BATCH_SIZE);
    });

    await expect(process(target)).resolves.toEqual({
      hasMore: true,
      partition: 0,
      processed: CONTENT_ANALYTICS_BATCH_SIZE,
      skipped: false,
    });
    const state = await target.query(async (ctx) => ({
      jobs: await ctx.db.system.query("_scheduled_functions").collect(),
      partition: await ctx.db.query("contentAnalyticsPartitions").unique(),
      queue: await ctx.db.query("learningEngagementQueue").collect(),
    }));
    expect(state.partition).toMatchObject({
      leaseExpiresAt: NOW + CONTENT_ANALYTICS_LEASE_DURATION_MS,
      leaseVersion: 1,
    });
    expect(state.jobs.map((job) => job.args[0])).toEqual([
      { leaseVersion: 1, partition: 0 },
    ]);
    expect(state.queue).toEqual([]);
  });

  it("releases an active lease whose queue became empty", async () => {
    const target = convexTest(schema, convexModules);
    await target.mutation((ctx) => insertPartition(ctx));

    await expect(process(target)).resolves.toEqual({
      hasMore: false,
      partition: 0,
      processed: 0,
      skipped: false,
    });
    await expect(
      target.query((ctx) => ctx.db.query("contentAnalyticsPartitions").unique())
    ).resolves.toMatchObject({
      lastProcessedAt: NOW,
      leaseExpiresAt: 0,
    });
  });

  it("skips missing, stale, and expired leases", async () => {
    const missing = convexTest(schema, convexModules);
    await expect(process(missing)).resolves.toMatchObject({ skipped: true });

    const stale = convexTest(schema, convexModules);
    await stale.mutation((ctx) => insertPartition(ctx, { leaseVersion: 2 }));
    await expect(process(stale)).resolves.toMatchObject({ skipped: true });

    const expired = convexTest(schema, convexModules);
    await expired.mutation((ctx) =>
      insertPartition(ctx, { leaseExpiresAt: NOW - 1 })
    );
    await expect(process(expired)).resolves.toMatchObject({ skipped: true });
  });

  it("rejects partitions outside the configured set", async () => {
    const target = convexTest(schema, convexModules);
    const partition = CONTENT_ANALYTICS_PARTITIONS.length;

    await expect(claim(target, partition)).rejects.toMatchObject({
      data: {
        code: invalidContentAnalyticsPartitionCode,
        message: "Content analytics partition is out of range.",
      },
    });
    await expect(process(target, { partition })).rejects.toMatchObject({
      data: {
        code: invalidContentAnalyticsPartitionCode,
        message: "Content analytics partition is out of range.",
      },
    });
  });
});
