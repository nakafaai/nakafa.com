import { internal } from "@repo/backend/convex/_generated/api";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import { invalidContentAnalyticsPartitionCode } from "@repo/backend/convex/contents/analytics/spec";
import {
  CONTENT_ANALYTICS_BATCH_SIZE,
  CONTENT_ANALYTICS_LEASE_DURATION_MS,
  CONTENT_ANALYTICS_PARTITIONS,
} from "@repo/backend/convex/contents/constants";
import {
  getDefaultPopularityWindow,
  getPopularitySignalDay,
} from "@repo/backend/convex/contents/popularity";
import schema from "@repo/backend/convex/schema";
import { registerLearningPopularityAggregate } from "@repo/backend/convex/test.helpers";
import { convexModules } from "@repo/backend/convex/test.setup";
import { logger } from "@repo/backend/convex/utils/logger";
import { createLearningGraphIdentityFromRoute } from "@repo/contents/_types/learning-graph";
import { convexTest } from "convex-test";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const NOW = Date.parse("2026-01-01T00:00:00.000Z");
const ARTICLE_ROUTE = "articles/politics/dynastic-politics-asian-values";
const SUBJECT_ROUTE = "material/lesson/mathematics/vector/addition";
const canonicalContext = {
  contextKey: "canonical",
  contextMode: "canonical",
} as const;

/**
 * Builds a Convex test instance with the popularity aggregate registered so
 * analytics counter writes exercise the same trigger path as production.
 */
function createAnalyticsConvexTest() {
  const t = convexTest(schema, convexModules);
  registerLearningPopularityAggregate(t);
  return t;
}

/** Builds a graph identity fixture and fails fast when the route is invalid. */
function getGraph(route: string) {
  const graph = createLearningGraphIdentityFromRoute({
    locale: "en",
    route,
  });

  if (!graph) {
    throw new Error(`Expected graph identity for ${route}.`);
  }

  return {
    ...graph,
    content_id: graph.assetId,
  };
}

/** Inserts one article and one curriculum lesson for analytics worker tests. */
async function insertAnalyticsContent(ctx: MutationCtx) {
  const articleId = await ctx.db.insert("articleContents", {
    articleSlug: "dynastic-politics-asian-values",
    body: "Article body",
    category: "politics",
    contentHash: "article-hash",
    date: NOW,
    description: "Article description",
    locale: "en",
    slug: ARTICLE_ROUTE,
    syncedAt: NOW,
    title: "Dynastic Politics",
  });
  const topicId = await ctx.db.insert("curriculumTopics", {
    locale: "en",
    material: "mathematics",
    order: 0,
    sectionCount: 1,
    slug: "material/lesson/mathematics/vector",
    syncedAt: NOW,
    title: "Vector",
    topic: "vector",
  });
  const subjectId = await ctx.db.insert("curriculumLessons", {
    body: "Subject body",
    contentHash: "subject-hash",
    date: NOW,
    description: "Subject description",
    locale: "en",
    material: "mathematics",
    order: 0,
    section: "addition",
    slug: SUBJECT_ROUTE,
    subject: "Vector",
    syncedAt: NOW,
    title: "Vector Addition",
    topic: "vector",
    topicId,
  });

  return {
    article: getGraph(ARTICLE_ROUTE),
    articleId,
    subject: getGraph(SUBJECT_ROUTE),
    subjectId,
  };
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
  subject: ReturnType<typeof getGraph>,
  count: number
) {
  for (let index = 0; index < count; index += 1) {
    await ctx.db.insert("learningEngagementQueue", {
      ...subject,
      ...canonicalContext,
      description: "Subject description",
      insertedAt: NOW + index,
      locale: "en",
      materialDomain: "mathematics",
      partition: 0,
      route: SUBJECT_ROUTE,
      section: "material",
      scopeMode: "global",
      sourcePath: SUBJECT_ROUTE,
      title: "Vector Addition",
      viewerKey: `device:subject-${index}`,
      viewedAt: NOW + index,
    });
  }
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

  it("does not schedule partition work when every queue is empty", async () => {
    const t = createAnalyticsConvexTest();

    const result = await t.mutation(
      internal.contents.mutations.analytics.scheduleContentAnalyticsPartitions
    );

    const scheduledJobs = await t.query(
      async (ctx) => await ctx.db.system.query("_scheduled_functions").collect()
    );

    expect(result).toEqual({
      enqueuedPartitions: 0,
    });
    expect(scheduledJobs).toEqual([]);
  });

  it("schedules one worker attempt per non-empty analytics partition", async () => {
    const t = createAnalyticsConvexTest();

    await t.mutation(async (ctx) => {
      const { article, subject } = await insertAnalyticsContent(ctx);
      await ctx.db.insert("learningEngagementQueue", {
        ...article,
        ...canonicalContext,
        description: "Article description",
        insertedAt: NOW,
        locale: "en",
        partition: 0,
        route: ARTICLE_ROUTE,
        section: "articles",
        scopeMode: "global",
        sourcePath: ARTICLE_ROUTE,
        title: "Dynastic Politics",
        viewerKey: "device:article",
        viewedAt: NOW,
      });
      await ctx.db.insert("learningEngagementQueue", {
        ...subject,
        ...canonicalContext,
        description: "Subject description",
        insertedAt: NOW,
        locale: "en",
        materialDomain: "mathematics",
        partition: 3,
        route: SUBJECT_ROUTE,
        section: "material",
        scopeMode: "global",
        sourcePath: SUBJECT_ROUTE,
        title: "Vector Addition",
        viewerKey: "device:subject",
        viewedAt: NOW,
      });
    });

    const result = await t.mutation(
      internal.contents.mutations.analytics.scheduleContentAnalyticsPartitions
    );
    const scheduledJobs = await t.query(
      async (ctx) => await ctx.db.system.query("_scheduled_functions").collect()
    );

    expect(result).toEqual({
      enqueuedPartitions: 2,
    });
    expect(scheduledJobs.map((job) => job.args[0])).toEqual([
      { partition: 0 },
      { partition: 3 },
    ]);
  });

  it("creates and leases a partition once while the lease is active", async () => {
    const t = createAnalyticsConvexTest();

    await t.mutation(async (ctx) => {
      const { subject } = await insertAnalyticsContent(ctx);
      await enqueueSubjectViews(ctx, subject, 1);
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
    const t = createAnalyticsConvexTest();

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
    const t = createAnalyticsConvexTest();

    const ids = await t.mutation(async (ctx) => {
      const content = await insertAnalyticsContent(ctx);
      await insertActivePartition(ctx);
      await ctx.db.insert("learningEngagementQueue", {
        ...content.article,
        ...canonicalContext,
        description: "Article description",
        insertedAt: NOW,
        locale: "en",
        partition: 0,
        route: ARTICLE_ROUTE,
        section: "articles",
        scopeMode: "global",
        sourcePath: ARTICLE_ROUTE,
        title: "Dynastic Politics",
        viewerKey: "device:article",
        viewedAt: NOW,
      });
      await ctx.db.insert("learningEngagementQueue", {
        ...content.subject,
        ...canonicalContext,
        description: "Subject description",
        insertedAt: NOW,
        locale: "en",
        materialDomain: "mathematics",
        partition: 0,
        route: SUBJECT_ROUTE,
        section: "material",
        scopeMode: "global",
        sourcePath: SUBJECT_ROUTE,
        title: "Vector Addition",
        viewerKey: "device:subject",
        viewedAt: NOW,
      });
      await enqueueSubjectViews(ctx, content.subject, 1);

      return content;
    });

    const result = await t.mutation(
      internal.contents.mutations.analytics.processContentAnalyticsPartition,
      { leaseVersion: 1, partition: 0 }
    );

    const state = await t.query(async (ctx) => ({
      articlePopularityCounter: await ctx.db
        .query("learningPopularityCounters")
        .withIndex(
          "by_windowKey_and_scopeMode_and_content_id_and_contextKey",
          (q) =>
            q
              .eq("windowKey", getDefaultPopularityWindow())
              .eq("scopeMode", "global")
              .eq("content_id", ids.article.content_id)
              .eq("contextKey", canonicalContext.contextKey)
        )
        .unique(),
      partitionRow: await ctx.db
        .query("contentAnalyticsPartitions")
        .withIndex("by_partition", (q) => q.eq("partition", 0))
        .unique(),
      queueItems: await ctx.db.query("learningEngagementQueue").collect(),
      subjectPopularityCounter: await ctx.db
        .query("learningPopularityCounters")
        .withIndex(
          "by_windowKey_and_scopeMode_and_content_id_and_contextKey",
          (q) =>
            q
              .eq("windowKey", getDefaultPopularityWindow())
              .eq("scopeMode", "global")
              .eq("content_id", ids.subject.content_id)
              .eq("contextKey", canonicalContext.contextKey)
        )
        .unique(),
      subjectPopularitySignal: await ctx.db
        .query("learningPopularitySignals")
        .withIndex(
          "by_scopeMode_and_signalDay_and_content_id_and_contextKey",
          (q) =>
            q
              .eq("scopeMode", "global")
              .eq("signalDay", getPopularitySignalDay(NOW))
              .eq("content_id", ids.subject.content_id)
              .eq("contextKey", canonicalContext.contextKey)
        )
        .unique(),
    }));

    expect(result).toEqual({
      hasMore: false,
      partition: 0,
      processed: 3,
      skipped: false,
    });
    expect(state.articlePopularityCounter).toMatchObject({
      content_id: ids.article.content_id,
      locale: "en",
      score: 1,
      section: "articles",
      scopeMode: "global",
      updatedAt: NOW,
    });
    expect(state.subjectPopularityCounter).toMatchObject({
      content_id: ids.subject.content_id,
      locale: "en",
      score: 2,
      section: "material",
      scopeMode: "global",
      updatedAt: NOW,
    });
    expect(state.subjectPopularitySignal).toMatchObject({
      content_id: ids.subject.content_id,
      locale: "en",
      scopeMode: "global",
      signalDay: getPopularitySignalDay(NOW),
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
    const t = createAnalyticsConvexTest();

    await t.mutation(async (ctx) => {
      const { subject } = await insertAnalyticsContent(ctx);
      await enqueueSubjectViews(ctx, subject, 1);
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
    const t = createAnalyticsConvexTest();

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
    const t = createAnalyticsConvexTest();

    const subject = await t.mutation(async (ctx) => {
      const { subject } = await insertAnalyticsContent(ctx);
      await insertActivePartition(ctx);
      await enqueueSubjectViews(ctx, subject, CONTENT_ANALYTICS_BATCH_SIZE);
      return subject;
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
      queueItems: await ctx.db.query("learningEngagementQueue").collect(),
      scheduledJobs: await ctx.db.system
        .query("_scheduled_functions")
        .collect(),
      subjectPopularityCounter: await ctx.db
        .query("learningPopularityCounters")
        .withIndex(
          "by_windowKey_and_scopeMode_and_content_id_and_contextKey",
          (q) =>
            q
              .eq("windowKey", getDefaultPopularityWindow())
              .eq("scopeMode", "global")
              .eq("content_id", subject.content_id)
              .eq("contextKey", canonicalContext.contextKey)
        )
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
    expect(state.subjectPopularityCounter).toMatchObject({
      content_id: subject.content_id,
      locale: "en",
      score: CONTENT_ANALYTICS_BATCH_SIZE,
      section: "material",
      scopeMode: "global",
    });
  });

  it("skips missing leases", async () => {
    const t = createAnalyticsConvexTest();

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
    const t = createAnalyticsConvexTest();

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
    const t = createAnalyticsConvexTest();

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
    const t = createAnalyticsConvexTest();

    await expect(
      t.mutation(
        internal.contents.mutations.analytics.scheduleContentAnalyticsPartition,
        { partition: CONTENT_ANALYTICS_PARTITIONS.length }
      )
    ).rejects.toMatchObject({
      data: {
        code: invalidContentAnalyticsPartitionCode,
        message: "Content analytics partition is out of range.",
      },
    });
    await expect(
      t.mutation(
        internal.contents.mutations.analytics.processContentAnalyticsPartition,
        { leaseVersion: 1, partition: CONTENT_ANALYTICS_PARTITIONS.length }
      )
    ).rejects.toMatchObject({
      data: {
        code: invalidContentAnalyticsPartitionCode,
        message: "Content analytics partition is out of range.",
      },
    });
  });
});
