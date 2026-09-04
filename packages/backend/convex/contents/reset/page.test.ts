import { afterEach, beforeEach, describe, expect, it } from "@effect/vitest";
import { api, internal } from "@repo/backend/convex/_generated/api";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import { CONTENT_ANALYTICS_LEASE_DURATION_MS } from "@repo/backend/convex/contents/constants";
import { learningPopularityRankings } from "@repo/backend/convex/contents/rankings";
import { runPopularityResetPage } from "@repo/backend/convex/contents/reset/page";
import {
  type PopularityResetPageArgs,
  type PopularityResetPageResult,
  type PopularityResetTable,
  popularityResetPageArgs,
} from "@repo/backend/convex/contents/reset/spec";
import { internalMutation } from "@repo/backend/convex/functions";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import schema from "@repo/backend/convex/schema";
import {
  createConvexTestWithBetterAuth,
  registerLearningPopularityAggregate,
} from "@repo/backend/convex/test.helpers";
import { convexModules } from "@repo/backend/convex/test.setup";
import { testMaterialGraph } from "@repo/backend/test/content/material";
import {
  insertContentViewArticle,
  makeArticleViewArgs,
} from "@repo/backend/test/content/view";
import type { TransactionMetrics } from "convex/server";
import { makeFunctionReference } from "convex/server";
import { v } from "convex/values";
import { convexTest } from "convex-test";

const NOW = Date.parse("2026-01-08T12:00:00.000Z");
const STANDARD_PAGE_SIZE = 32;

interface MeasuredPage {
  metrics: TransactionMetrics;
  result: PopularityResetPageResult;
}

const measurePage = internalMutation({
  args: popularityResetPageArgs,
  returns: v.any(),
  handler: async (ctx, args): Promise<MeasuredPage> => {
    const result = await runConvexProgram(
      runPopularityResetPage(
        ctx,
        args,
        internal.contents.mutations.reset.page,
        internal.contents.mutations.reset.aggregate
      )
    );
    const metrics = await ctx.meta.getTransactionMetrics();
    return { metrics, result };
  },
});
const measuredModules = {
  ...convexModules,
  "./contents/reset/measure.ts": async () => ({ page: measurePage }),
};
const measuredPage = makeFunctionReference<
  "mutation",
  PopularityResetPageArgs,
  MeasuredPage
>("contents/reset/measure:page");

function identity(index: number) {
  const graph = testMaterialGraph("vector", "addition", "en", "mathematics");
  const suffix = `reset:${index}`;
  const assetId = `${graph.assetId}:${suffix}`;
  return {
    alignmentId: `${graph.alignmentId}:${suffix}`,
    assetId,
    conceptId: `${graph.conceptId}:${suffix}`,
    content_id: assetId,
    learningObjectId: `${graph.learningObjectId}:${suffix}`,
    lensId: `${graph.lensId}:${suffix}`,
  };
}

function contentRow(index: number) {
  const graph = identity(index);
  const route = `material/reset/${index}`;
  return {
    ...graph,
    contextKey: `reset:${index}`,
    contextMode: "canonical" as const,
    description: `Reset description ${index}`,
    locale: "en" as const,
    materialDomain: "mathematics" as const,
    route,
    scopeMode: "global" as const,
    section: "material" as const,
    sourcePath: route,
    title: `Reset title ${index}`,
  };
}

async function seedTable(
  ctx: MutationCtx,
  table: PopularityResetTable,
  count: number,
  aggregate = false
) {
  for (let index = 0; index < count; index += 1) {
    const row = contentRow(index);
    if (table === "partitions") {
      await ctx.db.insert("contentAnalyticsPartitions", {
        leaseExpiresAt: NOW + CONTENT_ANALYTICS_LEASE_DURATION_MS,
        leaseVersion: 1,
        partition: index,
      });
    } else if (table === "queue") {
      await ctx.db.insert("learningEngagementQueue", {
        ...row,
        insertedAt: NOW + index,
        partition: index,
        viewedAt: NOW,
        viewerKey: `device:reset-${index}`,
      });
    } else if (table === "viewers") {
      await ctx.db.insert("learningPopularityViewerSignals", {
        alignmentId: row.alignmentId,
        assetId: row.assetId,
        conceptId: row.conceptId,
        content_id: row.content_id,
        contextKey: row.contextKey,
        contextMode: row.contextMode,
        learningObjectId: row.learningObjectId,
        lensId: row.lensId,
        locale: row.locale,
        scopeMode: row.scopeMode,
        section: row.section,
        signalDay: NOW,
        viewedAt: NOW,
        viewerKey: `device:reset-${index}`,
      });
    } else if (table === "signals") {
      await ctx.db.insert("learningPopularitySignals", {
        ...row,
        signalDay: NOW,
        updatedAt: NOW,
        viewCount: 1,
      });
    } else {
      const counterId = await ctx.db.insert("learningPopularityCounters", {
        ...row,
        score: index + 1,
        updatedAt: NOW,
        windowKey: "7d",
      });
      const counter = await ctx.db.get(counterId);
      if (!counter) {
        throw new Error("Expected the reset counter fixture.");
      }
      if (aggregate) {
        await learningPopularityRankings.insert(ctx, counter);
      }
    }
  }
}

async function seedControl(ctx: MutationCtx) {
  await ctx.db.insert("learningPopularityControl", {
    cleared: [],
    key: "popularity",
    mode: "reset",
    startedAt: NOW,
  });
}

describe("contents/reset/page", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(NOW));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("does not delete before the reset latch is active", async () => {
    const target = convexTest(schema, convexModules);
    registerLearningPopularityAggregate(target);
    await target.run((ctx) => seedTable(ctx, "queue", 1));

    await expect(
      target.mutation(internal.contents.mutations.reset.page, {})
    ).resolves.toEqual({ deleted: 0, done: false, table: "queue" });
    await expect(
      target.query((ctx) => ctx.db.query("learningEngagementQueue").collect())
    ).resolves.toHaveLength(1);
  });

  it("deletes one 32-row queue page without touching the next table", async () => {
    const target = convexTest({
      schema,
      modules: convexModules,
      transactionLimits: true,
    });
    registerLearningPopularityAggregate(target);
    await target.run(async (ctx) => {
      await seedControl(ctx);
      await seedTable(ctx, "queue", STANDARD_PAGE_SIZE + 1);
      await seedTable(ctx, "partitions", 1);
    });

    await expect(
      target.mutation(internal.contents.mutations.reset.page, {})
    ).resolves.toEqual({
      deleted: STANDARD_PAGE_SIZE,
      done: false,
      table: "queue",
    });
    await expect(
      target.query(async (ctx) => ({
        partitions: await ctx.db.query("contentAnalyticsPartitions").collect(),
        queue: await ctx.db.query("learningEngagementQueue").collect(),
      }))
    ).resolves.toMatchObject({
      partitions: [expect.objectContaining({ partition: 0 })],
      queue: [
        expect.objectContaining({ insertedAt: NOW + STANDARD_PAGE_SIZE }),
      ],
    });
  });

  it.each([
    ["queue", STANDARD_PAGE_SIZE],
    ["partitions", STANDARD_PAGE_SIZE],
    ["viewers", STANDARD_PAGE_SIZE],
    ["signals", STANDARD_PAGE_SIZE],
    ["counters", 1],
  ] as const)(
    "keeps a conservative transaction reserve for the %s page",
    async (table, count) => {
      const target = convexTest({
        schema,
        modules: measuredModules,
        transactionLimits: true,
      });
      registerLearningPopularityAggregate(target);
      await target.run(async (ctx) => {
        await seedControl(ctx);
        await seedTable(ctx, table, count, table === "counters");
      });

      const { metrics, result } = await target.mutation(measuredPage, {
        table,
      });
      expect(result).toEqual({ deleted: count, done: false, table });
      expect(metrics.bytesRead.remaining).toBeGreaterThan(8 * 1024 * 1024);
      expect(metrics.bytesWritten.remaining).toBeGreaterThan(8 * 1024 * 1024);
      expect(metrics.databaseQueries.remaining).toBeGreaterThanOrEqual(4000);
      expect(metrics.documentsRead.remaining).toBeGreaterThan(31_900);
      expect(metrics.documentsWritten.remaining).toBeGreaterThan(15_900);
      expect(metrics.functionsScheduled.remaining).toBeGreaterThanOrEqual(999);
      expect(metrics.scheduledFunctionArgsBytes.remaining).toBeGreaterThan(
        16 * 1024 * 1024 - 1024
      );
    }
  );

  it("deletes a counter whose aggregate entry is already absent", async () => {
    const target = convexTest({
      schema,
      modules: convexModules,
      transactionLimits: true,
    });
    registerLearningPopularityAggregate(target);
    await target.run(async (ctx) => {
      await seedControl(ctx);
      await seedTable(ctx, "counters", 1);
    });

    await expect(
      target.mutation(internal.contents.mutations.reset.page, {
        table: "counters",
      })
    ).resolves.toEqual({ deleted: 1, done: false, table: "counters" });
    await expect(
      target.query((ctx) =>
        ctx.db.query("learningPopularityCounters").collect()
      )
    ).resolves.toEqual([]);
  });

  it("pauses derived writers while preserving learning history", async () => {
    const target = createConvexTestWithBetterAuth();
    const article = await target.mutation((ctx) =>
      insertContentViewArticle(ctx)
    );

    await expect(
      target.mutation(internal.contents.mutations.reset.start, {})
    ).resolves.toEqual({ scheduled: true, started: true });
    await expect(
      target.mutation(
        api.contents.mutations.views.recordContentView,
        makeArticleViewArgs(article.contentId, "reset-paused")
      )
    ).resolves.toEqual({
      alreadyViewed: false,
      isNewView: true,
      success: true,
    });
    await expect(
      target.mutation(
        internal.contents.mutations.analytics
          .scheduleContentAnalyticsPartitions,
        {}
      )
    ).resolves.toEqual({ enqueuedPartitions: 0 });
    await expect(
      target.mutation(
        internal.contents.mutations.analytics.scheduleContentAnalyticsPartition,
        { partition: 0 }
      )
    ).resolves.toEqual({ createdPartition: false, scheduled: false });
    await expect(
      target.mutation(
        internal.contents.mutations.analytics.processContentAnalyticsPartition,
        { leaseVersion: 1, partition: 0 }
      )
    ).resolves.toEqual({
      hasMore: false,
      partition: 0,
      processed: 0,
      skipped: true,
    });
    await expect(
      target.mutation(
        internal.contents.mutations.popularity
          .scheduleLearningPopularityRefreshes,
        {}
      )
    ).resolves.toEqual({ scheduledWindows: 0 });
    await expect(
      target.mutation(
        internal.contents.mutations.popularity
          .refreshLearningPopularityWindowPage,
        { cursor: "paused", scopeMode: "global", windowKey: "7d" }
      )
    ).resolves.toEqual({
      continueCursor: "paused",
      isDone: true,
      refreshedCounters: 0,
      removedCounters: 0,
      skipped: true,
    });
    await expect(
      target.mutation(
        internal.contents.mutations.popularity
          .refreshLearningPopularityWindowPage,
        { scopeMode: "global", windowKey: "7d" }
      )
    ).resolves.toEqual({
      continueCursor: "",
      isDone: true,
      refreshedCounters: 0,
      removedCounters: 0,
      skipped: true,
    });

    const state = await target.query(async (ctx) => ({
      jobs: await ctx.db.system.query("_scheduled_functions").collect(),
      queue: await ctx.db.query("learningEngagementQueue").collect(),
      signals: await ctx.db.query("learningPopularityViewerSignals").collect(),
      views: await ctx.db.query("learningViews").collect(),
    }));
    expect(state.jobs).toHaveLength(1);
    expect(state.queue).toEqual([]);
    expect(state.signals).toEqual([]);
    expect(state.views).toHaveLength(1);
  });
});
