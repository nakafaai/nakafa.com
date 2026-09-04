import { afterEach, beforeEach, describe, expect, it } from "@effect/vitest";
import { internal } from "@repo/backend/convex/_generated/api";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import { CONTENT_ANALYTICS_LEASE_DURATION_MS } from "@repo/backend/convex/contents/constants";
import { learningPopularityRankings } from "@repo/backend/convex/contents/rankings";
import { runPopularityResetAggregate } from "@repo/backend/convex/contents/reset/aggregate";
import {
  type AggregatePopularityResetArgs,
  type AggregatePopularityResetResult,
  aggregatePopularityResetArgs,
} from "@repo/backend/convex/contents/reset/spec";
import { internalMutation } from "@repo/backend/convex/functions";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import schema from "@repo/backend/convex/schema";
import {
  createConvexTestWithBetterAuth,
  registerLearningPopularityAggregate,
  seedAuthenticatedUser,
} from "@repo/backend/convex/test.helpers";
import { convexModules } from "@repo/backend/convex/test.setup";
import { testMaterialGraph } from "@repo/backend/test/content/material";
import type { TransactionMetrics } from "convex/server";
import { makeFunctionReference } from "convex/server";
import { v } from "convex/values";
import { convexTest } from "convex-test";

const NOW = Date.parse("2026-01-08T12:00:00.000Z");
const ROW_COUNT = 3;
const RESET_VERIFY_DELAY_MS = 60_000;

interface MeasuredAggregate {
  metrics: TransactionMetrics;
  result: AggregatePopularityResetResult;
}

const measureAggregate = internalMutation({
  args: aggregatePopularityResetArgs,
  returns: v.any(),
  handler: async (ctx, args): Promise<MeasuredAggregate> => {
    const result = await runConvexProgram(
      runPopularityResetAggregate(
        ctx,
        args,
        internal.contents.mutations.reset.aggregate,
        internal.contents.mutations.reset.verify
      )
    );
    const metrics = await ctx.meta.getTransactionMetrics();
    return { metrics, result };
  },
});
const measuredModules = {
  ...convexModules,
  "./contents/reset/measure.ts": async () => ({ aggregate: measureAggregate }),
};
const measuredAggregate = makeFunctionReference<
  "mutation",
  AggregatePopularityResetArgs,
  MeasuredAggregate
>("contents/reset/measure:aggregate");

function identity(index: number, locale: "de" | "en" | "id" = "en") {
  const graph = testMaterialGraph("vector", "addition", locale, "mathematics");
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

function contentRow(index: number, locale: "de" | "en" | "id" = "en") {
  const graph = identity(index, locale);
  const route = `material/reset/${index}`;
  return {
    ...graph,
    contextKey: `reset:${index}`,
    contextMode: "canonical" as const,
    description: `Reset description ${index}`,
    locale,
    materialDomain: "mathematics" as const,
    route,
    scopeMode: "global" as const,
    section: "material" as const,
    sourcePath: route,
    title: `Reset title ${index}`,
  };
}

async function insertCounter(
  ctx: MutationCtx,
  index: number,
  options?: {
    locale?: "de" | "en" | "id";
    section?: "articles" | "material";
    windowKey?:
      | "1d"
      | "7d"
      | "14d"
      | "30d"
      | "90d"
      | "180d"
      | "365d"
      | "lifetime";
  }
) {
  const row = contentRow(index, options?.locale);
  const counterId = await ctx.db.insert("learningPopularityCounters", {
    ...row,
    section: options?.section ?? "material",
    score: index + 1,
    updatedAt: NOW,
    windowKey: options?.windowKey ?? "7d",
  });
  const counter = await ctx.db.get(counterId);
  if (!counter) {
    throw new Error("Expected the popularity counter reset fixture.");
  }
  await learningPopularityRankings.insert(ctx, counter);
  return counterId;
}

async function seedOwnedState(ctx: MutationCtx) {
  const user = await seedAuthenticatedUser(ctx, {
    now: NOW,
    suffix: "popularity-reset",
  });

  for (let index = 0; index < ROW_COUNT; index += 1) {
    const row = contentRow(index);
    await ctx.db.insert("contentAnalyticsPartitions", {
      leaseExpiresAt: NOW + CONTENT_ANALYTICS_LEASE_DURATION_MS,
      leaseVersion: 1,
      partition: index,
    });
    await ctx.db.insert("learningEngagementQueue", {
      ...row,
      insertedAt: NOW + index,
      partition: index,
      viewedAt: NOW,
      viewerKey: `device:reset-${index}`,
    });
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
    await ctx.db.insert("learningPopularitySignals", {
      ...row,
      signalDay: NOW,
      updatedAt: NOW,
      viewCount: 1,
    });
    await insertCounter(ctx, index);
  }

  const graph = identity(0);
  await ctx.db.insert("learningViews", {
    ...graph,
    contextKey: "canonical",
    contextMode: "canonical",
    deviceId: "reset-history",
    firstViewedAt: NOW,
    lastViewedAt: NOW,
    locale: "en",
    route: "material/reset/history",
    section: "material",
  });
  await ctx.db.insert("userLearningRecents", {
    ...graph,
    contextKey: "canonical",
    contextMode: "canonical",
    description: "Preserved recent",
    lastViewedAt: NOW,
    locale: "en",
    materialDomain: "mathematics",
    route: "material/reset/history",
    section: "material",
    sourcePath: "material/reset/history",
    title: "Preserved recent",
    userId: user.userId,
  });
}

async function seedOrphanNamespaces(ctx: MutationCtx) {
  const locales = ["de", "en", "id"] as const;
  const sections = ["articles", "material"] as const;
  const windows = [
    "1d",
    "7d",
    "14d",
    "30d",
    "90d",
    "180d",
    "365d",
    "lifetime",
  ] as const;
  let index = 100;

  for (const section of sections) {
    for (const locale of locales) {
      for (const windowKey of windows) {
        const counterId = await insertCounter(ctx, index, {
          locale,
          section,
          windowKey,
        });
        await ctx.db.delete(counterId);
        index += 1;
        if (index === 117) {
          return;
        }
      }
    }
  }
}

describe("contents/reset/aggregate", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(NOW));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("reports empty inactive storage without claiming completion", async () => {
    const target = convexTest(schema, convexModules);
    registerLearningPopularityAggregate(target);

    await expect(
      target.query(internal.contents.mutations.reset.report, {})
    ).resolves.toEqual({
      aggregate: { cleared: 0, empty: false },
      complete: false,
      resetting: false,
      tables: {
        countersEmpty: true,
        partitionsEmpty: true,
        queueEmpty: true,
        signalsEmpty: true,
        viewerSignalsEmpty: true,
      },
    });
    await expect(
      target.mutation(internal.contents.mutations.reset.verify, {})
    ).resolves.toEqual({ restarted: false });
  });

  it("deletes only derived popularity storage and proves every namespace empty", async () => {
    const target = createConvexTestWithBetterAuth();
    await target.run(async (ctx) => {
      await seedOwnedState(ctx);
      await seedOrphanNamespaces(ctx);
    });

    const before = await target.query(
      internal.contents.mutations.reset.report,
      {}
    );
    expect(before).toMatchObject({
      aggregate: { cleared: 0, empty: false },
      complete: false,
      resetting: false,
      tables: {
        countersEmpty: false,
        partitionsEmpty: false,
        queueEmpty: false,
        signalsEmpty: false,
        viewerSignalsEmpty: false,
      },
    });
    await expect(
      target.mutation(internal.contents.mutations.reset.start, {})
    ).resolves.toEqual({ scheduled: true, started: true });

    await target.finishAllScheduledFunctions(vi.runAllTimers, 500);

    const complete = await target.query(
      internal.contents.mutations.reset.report,
      {}
    );
    expect(complete).toEqual({
      aggregate: { cleared: 18, empty: true },
      complete: true,
      resetting: true,
      tables: {
        countersEmpty: true,
        partitionsEmpty: true,
        queueEmpty: true,
        signalsEmpty: true,
        viewerSignalsEmpty: true,
      },
    });
    await expect(
      target.query(async (ctx) => ({
        recents: await ctx.db.query("userLearningRecents").collect(),
        views: await ctx.db.query("learningViews").collect(),
      }))
    ).resolves.toMatchObject({
      recents: [expect.objectContaining({ title: "Preserved recent" })],
      views: [expect.objectContaining({ deviceId: "reset-history" })],
    });

    await expect(
      target.mutation(internal.contents.mutations.reset.start, {})
    ).resolves.toEqual({ scheduled: true, started: false });
    await target.finishAllScheduledFunctions(vi.runAllTimers, 500);
    const restart = await target.query(
      internal.contents.mutations.reset.report,
      {}
    );
    expect(restart.complete).toBe(true);
    expect(restart.aggregate).toEqual({ cleared: 18, empty: true });
  }, 30_000);

  it("restarts table deletion when a row appears during the quiet period", async () => {
    const target = convexTest(schema, convexModules);
    registerLearningPopularityAggregate(target);
    await target.run((ctx) =>
      ctx.db.insert("learningPopularityControl", {
        cleared: [],
        key: "popularity",
        mode: "reset",
        startedAt: NOW,
      })
    );

    await expect(
      target.mutation(internal.contents.mutations.reset.aggregate, {})
    ).resolves.toEqual({ cleared: 0, cursor: "endcursor", isDone: true });
    await target.run(async (ctx) => {
      const row = contentRow(999);
      await ctx.db.insert("learningEngagementQueue", {
        ...row,
        insertedAt: NOW,
        partition: 0,
        viewedAt: NOW,
        viewerKey: "device:late-reset",
      });
    });

    vi.advanceTimersByTime(RESET_VERIFY_DELAY_MS);
    await target.finishInProgressScheduledFunctions();
    await expect(
      target.query(internal.contents.mutations.reset.report, {})
    ).resolves.toMatchObject({
      complete: false,
      tables: { queueEmpty: false },
    });

    await target.finishAllScheduledFunctions(vi.runAllTimers, 100);
    await expect(
      target.query(internal.contents.mutations.reset.report, {})
    ).resolves.toMatchObject({
      complete: true,
      tables: { queueEmpty: true },
    });
  });

  it("does not clear an aggregate before the reset latch is active", async () => {
    const target = convexTest(schema, convexModules);
    registerLearningPopularityAggregate(target);
    await target.run(async (ctx) => {
      const counterId = await insertCounter(ctx, 777);
      await ctx.db.delete(counterId);
    });

    await expect(
      target.mutation(internal.contents.mutations.reset.aggregate, {})
    ).resolves.toEqual({ cleared: 0, cursor: "", isDone: false });
    await expect(
      target.run((ctx) =>
        learningPopularityRankings.count(ctx, {
          namespace: ["material", "en", "global", "7d"],
        })
      )
    ).resolves.toBe(1);
  });

  it("clears a populated aggregate root with conservative limit reserves", async () => {
    const target = convexTest({
      schema,
      modules: measuredModules,
      transactionLimits: true,
    });
    registerLearningPopularityAggregate(target);
    await target.run(async (ctx) => {
      await ctx.db.insert("learningPopularityControl", {
        cleared: [],
        key: "popularity",
        mode: "reset",
        startedAt: NOW,
      });
      for (let index = 2000; index < 2064; index += 1) {
        const counterId = await insertCounter(ctx, index);
        await ctx.db.delete(counterId);
      }
    });

    const { metrics, result } = await target.mutation(measuredAggregate, {});
    expect(result).toEqual({ cleared: 1, cursor: "", isDone: false });
    expect(metrics.bytesRead.remaining).toBeGreaterThan(8 * 1024 * 1024);
    expect(metrics.bytesWritten.remaining).toBeGreaterThan(8 * 1024 * 1024);
    expect(metrics.databaseQueries.remaining).toBeGreaterThanOrEqual(4000);
    expect(metrics.documentsRead.remaining).toBeGreaterThan(31_900);
    expect(metrics.documentsWritten.remaining).toBeGreaterThan(15_900);
    expect(metrics.functionsScheduled.remaining).toBeGreaterThanOrEqual(998);
    expect(metrics.scheduledFunctionArgsBytes.remaining).toBeGreaterThan(
      16 * 1024 * 1024 - 1024
    );
  });
});
