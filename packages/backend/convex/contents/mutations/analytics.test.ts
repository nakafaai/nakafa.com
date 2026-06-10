import { internal } from "@repo/backend/convex/_generated/api";
import type { Id } from "@repo/backend/convex/_generated/dataModel";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import { invalidContentAnalyticsPartitionCode } from "@repo/backend/convex/contents/analytics/spec";
import {
  CONTENT_ANALYTICS_BATCH_SIZE,
  CONTENT_ANALYTICS_LEASE_DURATION_MS,
  CONTENT_ANALYTICS_PARTITIONS,
} from "@repo/backend/convex/contents/constants";
import schema from "@repo/backend/convex/schema";
import { getTrendingBucketStart } from "@repo/backend/convex/subjectSections/utils";
import { convexModules } from "@repo/backend/convex/test.setup";
import { logger } from "@repo/backend/convex/utils/logger";
import { convexTest } from "convex-test";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const NOW = Date.parse("2026-01-01T00:00:00.000Z");

/** Inserts one article and one subject section for analytics worker tests. */
async function insertAnalyticsContent(ctx: MutationCtx) {
  const articleId = await ctx.db.insert("articleContents", {
    articleSlug: "dynastic-politics-asian-values",
    body: "Article body",
    category: "politics",
    contentHash: "article-hash",
    date: NOW,
    description: "Article description",
    locale: "en",
    slug: "articles/politics/dynastic-politics-asian-values",
    syncedAt: NOW,
    title: "Dynastic Politics",
  });
  const topicId = await ctx.db.insert("subjectTopics", {
    category: "high-school",
    grade: "10",
    locale: "en",
    material: "mathematics",
    order: 0,
    sectionCount: 1,
    slug: "subject/high-school/10/mathematics/vector",
    syncedAt: NOW,
    title: "Vector",
    topic: "vector",
  });
  const subjectId = await ctx.db.insert("subjectSections", {
    body: "Subject body",
    category: "high-school",
    contentHash: "subject-hash",
    date: NOW,
    description: "Subject description",
    grade: "10",
    locale: "en",
    material: "mathematics",
    order: 0,
    section: "addition",
    slug: "subject/high-school/10/mathematics/vector/addition",
    subject: "Vector",
    syncedAt: NOW,
    title: "Vector Addition",
    topic: "vector",
    topicId,
  });

  return { articleId, subjectId };
}

/** Inserts a currently leased analytics partition. */
async function insertActivePartition(
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

/** Enqueues repeated subject views for one partition. */
async function enqueueSubjectViews(
  ctx: MutationCtx,
  subjectId: Id<"subjectSections">,
  count: number
) {
  for (let index = 0; index < count; index += 1) {
    await ctx.db.insert("contentViewAnalyticsQueue", {
      contentRef: { id: subjectId, type: "subject" },
      locale: "en",
      partition: 0,
      viewedAt: NOW + index,
    });
  }
}

function getConvexErrorData(error: unknown) {
  if (typeof error !== "object" || error === null || !("data" in error)) {
    throw new Error("Expected a ConvexError with data.");
  }

  return error.data;
}

describe("contents/mutations/analytics", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(NOW));
    vi.spyOn(logger, "info").mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("schedules one worker attempt per analytics partition", async () => {
    const t = convexTest(schema, convexModules);

    const result = await t.mutation(
      internal.contents.mutations.analytics.scheduleContentAnalyticsPartitions
    );

    const scheduledJobs = await t.query(
      async (ctx) => await ctx.db.system.query("_scheduled_functions").collect()
    );

    expect(result).toEqual({
      enqueuedPartitions: CONTENT_ANALYTICS_PARTITIONS.length,
    });
    expect(scheduledJobs).toHaveLength(CONTENT_ANALYTICS_PARTITIONS.length);
    expect(scheduledJobs.map((job) => job.args[0])).toEqual(
      CONTENT_ANALYTICS_PARTITIONS.map((partition) => ({ partition }))
    );
  });

  it("creates and leases a partition once while the lease is active", async () => {
    const t = convexTest(schema, convexModules);

    await t.mutation(async (ctx) => {
      const { subjectId } = await insertAnalyticsContent(ctx);
      await enqueueSubjectViews(ctx, subjectId, 1);
    });

    const firstResult = await t.mutation(
      internal.contents.mutations.analytics.scheduleContentAnalyticsPartition,
      { partition: 0 }
    );
    const secondResult = await t.mutation(
      internal.contents.mutations.analytics.scheduleContentAnalyticsPartition,
      { partition: 0 }
    );

    const state = await t.query(async (ctx) => ({
      partitionRows: await ctx.db.query("contentAnalyticsPartitions").collect(),
      scheduledJobs: await ctx.db.system
        .query("_scheduled_functions")
        .collect(),
    }));

    expect(firstResult).toEqual({
      createdPartition: true,
      scheduled: true,
    });
    expect(secondResult).toEqual({
      createdPartition: false,
      scheduled: false,
    });
    expect(state.partitionRows).toEqual([
      expect.objectContaining({
        leaseExpiresAt: NOW + CONTENT_ANALYTICS_LEASE_DURATION_MS,
        leaseVersion: 1,
        partition: 0,
      }),
    ]);
    expect(state.scheduledJobs).toHaveLength(1);
  });

  it("does not create a lease when a partition queue is empty", async () => {
    const t = convexTest(schema, convexModules);

    const result = await t.mutation(
      internal.contents.mutations.analytics.scheduleContentAnalyticsPartition,
      { partition: 0 }
    );
    const state = await t.query(async (ctx) => ({
      partitionRows: await ctx.db.query("contentAnalyticsPartitions").collect(),
      scheduledJobs: await ctx.db.system
        .query("_scheduled_functions")
        .collect(),
    }));

    expect(result).toEqual({ createdPartition: false, scheduled: false });
    expect(state.partitionRows).toEqual([]);
    expect(state.scheduledJobs).toEqual([]);
  });

  it("drains queued views into popularity tables and releases the lease", async () => {
    const t = convexTest(schema, convexModules);

    const ids = await t.mutation(async (ctx) => {
      const content = await insertAnalyticsContent(ctx);
      await insertActivePartition(ctx);
      await ctx.db.insert("contentViewAnalyticsQueue", {
        contentRef: { id: content.articleId, type: "article" },
        locale: "en",
        partition: 0,
        viewedAt: NOW,
      });
      await ctx.db.insert("contentViewAnalyticsQueue", {
        contentRef: { id: content.subjectId, type: "subject" },
        locale: "en",
        partition: 0,
        viewedAt: NOW,
      });
      await enqueueSubjectViews(ctx, content.subjectId, 1);

      return content;
    });

    const result = await t.mutation(
      internal.contents.mutations.analytics.processContentAnalyticsPartition,
      { leaseVersion: 1, partition: 0 }
    );

    const state = await t.query(async (ctx) => ({
      articlePopularity: await ctx.db
        .query("articlePopularity")
        .withIndex("by_contentId", (q) => q.eq("contentId", ids.articleId))
        .unique(),
      partitionRow: await ctx.db
        .query("contentAnalyticsPartitions")
        .withIndex("by_partition", (q) => q.eq("partition", 0))
        .unique(),
      queueItems: await ctx.db.query("contentViewAnalyticsQueue").collect(),
      subjectPopularity: await ctx.db
        .query("subjectPopularity")
        .withIndex("by_contentId", (q) => q.eq("contentId", ids.subjectId))
        .unique(),
      subjectTrendingBucket: await ctx.db
        .query("subjectTrendingBuckets")
        .withIndex("by_locale_and_bucketStart_and_contentId", (q) =>
          q
            .eq("locale", "en")
            .eq("bucketStart", getTrendingBucketStart(NOW))
            .eq("contentId", ids.subjectId)
        )
        .unique(),
    }));

    expect(result).toEqual({
      hasMore: false,
      partition: 0,
      processed: 3,
      skipped: false,
    });
    expect(state.articlePopularity).toMatchObject({
      contentId: ids.articleId,
      updatedAt: NOW,
      viewCount: 1,
    });
    expect(state.subjectPopularity).toMatchObject({
      contentId: ids.subjectId,
      updatedAt: NOW,
      viewCount: 2,
    });
    expect(state.subjectTrendingBucket).toMatchObject({
      bucketStart: getTrendingBucketStart(NOW),
      contentId: ids.subjectId,
      locale: "en",
      updatedAt: NOW,
      viewCount: 2,
    });
    expect(state.partitionRow).toMatchObject({
      lastProcessedAt: NOW,
      leaseExpiresAt: 0,
      leaseVersion: 1,
      partition: 0,
    });
    expect(state.queueItems).toEqual([]);
  });

  it("reclaims expired leases and schedules the next worker", async () => {
    const t = convexTest(schema, convexModules);

    await t.mutation(async (ctx) => {
      const { subjectId } = await insertAnalyticsContent(ctx);
      await enqueueSubjectViews(ctx, subjectId, 1);
      await insertActivePartition(ctx, {
        leaseExpiresAt: NOW - 1,
        leaseVersion: 2,
      });
    });

    const result = await t.mutation(
      internal.contents.mutations.analytics.scheduleContentAnalyticsPartition,
      { partition: 0 }
    );

    const state = await t.query(async (ctx) => ({
      partitionRow: await ctx.db
        .query("contentAnalyticsPartitions")
        .withIndex("by_partition", (q) => q.eq("partition", 0))
        .unique(),
      scheduledJobs: await ctx.db.system
        .query("_scheduled_functions")
        .collect(),
    }));

    expect(result).toEqual({ createdPartition: false, scheduled: true });
    expect(state.partitionRow).toMatchObject({
      leaseExpiresAt: NOW + CONTENT_ANALYTICS_LEASE_DURATION_MS,
      leaseVersion: 3,
      partition: 0,
    });
    expect(state.scheduledJobs.map((job) => job.args[0])).toEqual([
      { leaseVersion: 3, partition: 0 },
    ]);
  });

  it("releases an active lease when the partition queue is empty", async () => {
    const t = convexTest(schema, convexModules);

    await t.mutation(async (ctx) => {
      await insertActivePartition(ctx);
    });

    const result = await t.mutation(
      internal.contents.mutations.analytics.processContentAnalyticsPartition,
      { leaseVersion: 1, partition: 0 }
    );

    const partitionRow = await t.query(
      async (ctx) =>
        await ctx.db
          .query("contentAnalyticsPartitions")
          .withIndex("by_partition", (q) => q.eq("partition", 0))
          .unique()
    );

    expect(result).toEqual({
      hasMore: false,
      partition: 0,
      processed: 0,
      skipped: false,
    });
    expect(partitionRow).toMatchObject({
      lastProcessedAt: NOW,
      leaseExpiresAt: 0,
      leaseVersion: 1,
      partition: 0,
    });
  });

  it("continues a full partition batch without releasing the lease", async () => {
    const t = convexTest(schema, convexModules);

    const subjectId = await t.mutation(async (ctx) => {
      const { subjectId } = await insertAnalyticsContent(ctx);
      await insertActivePartition(ctx);
      await enqueueSubjectViews(ctx, subjectId, CONTENT_ANALYTICS_BATCH_SIZE);
      return subjectId;
    });

    const result = await t.mutation(
      internal.contents.mutations.analytics.processContentAnalyticsPartition,
      { leaseVersion: 1, partition: 0 }
    );

    const state = await t.query(async (ctx) => ({
      partitionRow: await ctx.db
        .query("contentAnalyticsPartitions")
        .withIndex("by_partition", (q) => q.eq("partition", 0))
        .unique(),
      queueItems: await ctx.db.query("contentViewAnalyticsQueue").collect(),
      scheduledJobs: await ctx.db.system
        .query("_scheduled_functions")
        .collect(),
      subjectPopularity: await ctx.db
        .query("subjectPopularity")
        .withIndex("by_contentId", (q) => q.eq("contentId", subjectId))
        .unique(),
    }));

    expect(result).toEqual({
      hasMore: true,
      partition: 0,
      processed: CONTENT_ANALYTICS_BATCH_SIZE,
      skipped: false,
    });
    expect(state.partitionRow).toMatchObject({
      leaseExpiresAt: NOW + CONTENT_ANALYTICS_LEASE_DURATION_MS,
      leaseVersion: 1,
      partition: 0,
    });
    expect(state.queueItems).toEqual([]);
    expect(state.scheduledJobs.map((job) => job.args[0])).toEqual([
      { leaseVersion: 1, partition: 0 },
    ]);
    expect(state.subjectPopularity).toMatchObject({
      contentId: subjectId,
      viewCount: CONTENT_ANALYTICS_BATCH_SIZE,
    });
  });

  it("skips missing leases", async () => {
    const t = convexTest(schema, convexModules);

    await expect(
      t.mutation(
        internal.contents.mutations.analytics.processContentAnalyticsPartition,
        { leaseVersion: 1, partition: 0 }
      )
    ).resolves.toEqual({
      hasMore: false,
      partition: 0,
      processed: 0,
      skipped: true,
    });
  });

  it("skips stale lease versions", async () => {
    const t = convexTest(schema, convexModules);

    await t.mutation(async (ctx) => {
      await insertActivePartition(ctx, { leaseVersion: 2 });
    });

    await expect(
      t.mutation(
        internal.contents.mutations.analytics.processContentAnalyticsPartition,
        { leaseVersion: 1, partition: 0 }
      )
    ).resolves.toEqual({
      hasMore: false,
      partition: 0,
      processed: 0,
      skipped: true,
    });
  });

  it("skips expired leases", async () => {
    const t = convexTest(schema, convexModules);

    await t.mutation(async (ctx) => {
      await insertActivePartition(ctx, { leaseExpiresAt: NOW - 1 });
    });

    await expect(
      t.mutation(
        internal.contents.mutations.analytics.processContentAnalyticsPartition,
        { leaseVersion: 1, partition: 0 }
      )
    ).resolves.toEqual({
      hasMore: false,
      partition: 0,
      processed: 0,
      skipped: true,
    });
  });

  it("rejects unknown partitions with a tagged Convex error", async () => {
    const t = convexTest(schema, convexModules);

    const scheduleError = await t
      .mutation(
        internal.contents.mutations.analytics.scheduleContentAnalyticsPartition,
        { partition: CONTENT_ANALYTICS_PARTITIONS.length }
      )
      .catch((error: unknown) => error);
    const processError = await t
      .mutation(
        internal.contents.mutations.analytics.processContentAnalyticsPartition,
        { leaseVersion: 1, partition: CONTENT_ANALYTICS_PARTITIONS.length }
      )
      .catch((error: unknown) => error);

    expect(getConvexErrorData(scheduleError)).toEqual({
      code: invalidContentAnalyticsPartitionCode,
      message: "Content analytics partition is out of range.",
    });
    expect(getConvexErrorData(processError)).toEqual({
      code: invalidContentAnalyticsPartitionCode,
      message: "Content analytics partition is out of range.",
    });
  });
});
