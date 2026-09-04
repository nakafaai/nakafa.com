import { afterEach, beforeEach, describe, expect, it } from "@effect/vitest";
import { internal } from "@repo/backend/convex/_generated/api";
import type { Id } from "@repo/backend/convex/_generated/dataModel";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import { POPULARITY_RETENTION_BATCH_SIZE } from "@repo/backend/convex/contents/constants";
import { startLearningPopularityRetention } from "@repo/backend/convex/contents/metrics/retention";
import {
  getFinitePopularityWindows,
  learningPopularityScopeValues,
  POPULARITY_DAY_MS,
} from "@repo/backend/convex/contents/popularity";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import schema from "@repo/backend/convex/schema";
import { registerLearningPopularityAggregate } from "@repo/backend/convex/test.helpers";
import { convexModules } from "@repo/backend/convex/test.setup";
import { testMaterialGraph } from "@repo/backend/test/content/material";
import { convexTest, type TestConvex } from "convex-test";

const DAY = Date.parse("2026-01-08T00:00:00.000Z");
const ROUTE = "material/lesson/mathematics/vector/addition";

/** Builds a test deployment with the production ranking trigger component. */
function createTarget() {
  const target = convexTest(schema, convexModules);
  registerLearningPopularityAggregate(target);
  return target;
}

/** Creates a unique graph identity for one retained or expired row. */
function graph(index: number) {
  const value = testMaterialGraph("vector", "addition", "en", "mathematics");
  const suffix = String(index);
  return {
    alignmentId: `${value.alignmentId}:${suffix}`,
    assetId: `${value.assetId}:${suffix}`,
    conceptId: `${value.conceptId}:${suffix}`,
    content_id: `${value.assetId}:${suffix}`,
    learningObjectId: `${value.learningObjectId}:${suffix}`,
    lensId: `${value.lensId}:${suffix}`,
  };
}

/** Inserts every finite maintenance namespace for one UTC day. */
async function insertCycles(ctx: MutationCtx, day: number) {
  let lastCycleId: Id<"learningPopularityCycles"> | null = null;

  for (const scopeMode of learningPopularityScopeValues) {
    for (const windowKey of getFinitePopularityWindows()) {
      lastCycleId = await ctx.db.insert("learningPopularityCycles", {
        completedDay: day,
        mode: "repair",
        scopeMode,
        startedDay: day,
        windowKey,
      });
    }
  }

  if (!lastCycleId) {
    throw new Error("Expected at least one popularity cycle fixture.");
  }

  return lastCycleId;
}

/** Runs the production retention claim and captures exact transaction use. */
async function startRetention(target: TestConvex<typeof schema>, day: number) {
  return await target.mutation(async (ctx) => {
    const result = await runConvexProgram(
      startLearningPopularityRetention(
        ctx,
        day,
        internal.contents.mutations.popularity.sweepLearningPopularityRetention
      )
    );
    return {
      metrics: await ctx.meta.getTransactionMetrics(),
      result,
    };
  });
}

/** Runs the registered bounded retention page and captures transaction use. */
async function sweepRetention(target: TestConvex<typeof schema>, day: number) {
  return await target.mutation(async (ctx) => {
    const result = await ctx.runMutation(
      internal.contents.mutations.popularity.sweepLearningPopularityRetention,
      { day }
    );
    return {
      metrics: await ctx.meta.getTransactionMetrics(),
      result,
    };
  });
}

/** Inserts one viewer-dedupe row at an exact retention boundary. */
async function insertViewerSignal(
  ctx: MutationCtx,
  index: number,
  signalDay: number
) {
  await ctx.db.insert("learningPopularityViewerSignals", {
    ...graph(index),
    contextKey: "canonical",
    contextMode: "canonical",
    locale: "en",
    scopeMode: "global",
    section: "material",
    signalDay,
    viewedAt: signalDay,
    viewerKey: `device:${index}`,
  });
}

/** Inserts one daily repair signal at an exact retention boundary. */
async function insertDailySignal(
  ctx: MutationCtx,
  index: number,
  signalDay: number
) {
  await ctx.db.insert("learningPopularitySignals", {
    ...graph(index),
    applied: {
      d1: 0,
      d7: 0,
      d14: 0,
      d30: 0,
      d90: 0,
      d180: 0,
      d365: 1,
    },
    contextKey: "canonical",
    contextMode: "canonical",
    locale: "en",
    materialDomain: "mathematics",
    route: ROUTE,
    scopeMode: "global",
    section: "material",
    signalDay,
    sourcePath: ROUTE,
    title: `Vector ${index}`,
    updatedAt: DAY,
    viewCount: 1,
  });
}

describe("contents/metrics/retention", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(DAY));
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("claims one chain only after every daily namespace completes", async () => {
    const target = createTarget();
    const lastCycleId = await target.mutation(async (ctx) => {
      const cycleId = await insertCycles(ctx, DAY);
      await ctx.db.patch(cycleId, { completedDay: undefined });
      return cycleId;
    });

    const incomplete = await startRetention(target, DAY);
    const beforeCompletion = await target.query(async (ctx) => ({
      jobs: await ctx.db.system.query("_scheduled_functions").collect(),
      retention: await ctx.db.query("learningPopularityRetention").collect(),
    }));

    expect(incomplete.result).toBe(false);
    expect(beforeCompletion).toEqual({ jobs: [], retention: [] });

    await target.mutation(async (ctx) => {
      await ctx.db.patch(lastCycleId, { completedDay: DAY });
    });
    const claimed = await startRetention(target, DAY);
    const duplicate = await startRetention(target, DAY);

    expect(claimed.result).toBe(true);
    expect(claimed.metrics.databaseQueries.used).toBe(15);
    expect(claimed.metrics.documentsRead.used).toBe(14);
    expect(claimed.metrics.documentsWritten.used).toBe(1);
    expect(claimed.metrics.functionsScheduled.used).toBe(1);
    expect(duplicate.result).toBe(false);
    expect(duplicate.metrics.documentsWritten.used).toBe(0);
    expect(duplicate.metrics.functionsScheduled.used).toBe(0);

    const nextDay = DAY + POPULARITY_DAY_MS;
    await target.mutation(async (ctx) => {
      const cycles = await ctx.db.query("learningPopularityCycles").collect();
      for (const cycle of cycles) {
        await ctx.db.patch(cycle._id, {
          completedDay: nextDay,
          startedDay: nextDay,
        });
      }
    });
    const nextClaim = await startRetention(target, nextDay);
    const retained = await target.query(
      async (ctx) => await ctx.db.query("learningPopularityRetention").unique()
    );

    expect(nextClaim.result).toBe(true);
    expect(nextClaim.metrics.databaseQueries.used).toBe(15);
    expect(nextClaim.metrics.documentsRead.used).toBe(16);
    expect(nextClaim.metrics.documentsWritten.used).toBe(1);
    expect(nextClaim.metrics.functionsScheduled.used).toBe(1);
    expect(retained).toMatchObject({
      day: nextDay,
      phase: "viewers",
    });
    expect(retained).not.toHaveProperty("completedDay");
  });

  it("drains saturated boundaries and never changes lifetime counters", async () => {
    const target = createTarget();
    const expiredSignalDay = DAY - 365 * POPULARITY_DAY_MS;
    const retainedSignalDay = DAY - 364 * POPULARITY_DAY_MS;

    await target.mutation(async (ctx) => {
      await ctx.db.insert("learningPopularityRetention", {
        day: DAY,
        key: "popularity",
        phase: "viewers",
      });
      await ctx.db.insert("learningPopularityCounters", {
        ...graph(10_000),
        contextKey: "canonical",
        contextMode: "canonical",
        latestDay: DAY,
        locale: "en",
        materialDomain: "mathematics",
        route: ROUTE,
        score: 99,
        section: "material",
        scopeMode: "global",
        sourcePath: ROUTE,
        title: "Lifetime vector",
        updatedAt: DAY,
        windowKey: "lifetime",
      });

      for (
        let index = 0;
        index < POPULARITY_RETENTION_BATCH_SIZE + 1;
        index += 1
      ) {
        await insertViewerSignal(ctx, index, DAY - POPULARITY_DAY_MS);
        await insertDailySignal(ctx, index, expiredSignalDay);
      }

      await insertViewerSignal(ctx, 20_000, DAY);
      await insertDailySignal(ctx, 20_001, retainedSignalDay);
    });

    const first = await sweepRetention(target, DAY);
    const second = await sweepRetention(target, DAY);
    const third = await sweepRetention(target, DAY);
    const fourth = await sweepRetention(target, DAY);

    expect(first.result).toEqual({
      deleted: POPULARITY_RETENTION_BATCH_SIZE,
      done: false,
      skipped: false,
    });
    expect(first.metrics.databaseQueries.used).toBe(2);
    expect(first.metrics.documentsRead.used).toBe(
      2 * POPULARITY_RETENTION_BATCH_SIZE + 1
    );
    expect(first.metrics.documentsWritten.used).toBe(
      POPULARITY_RETENTION_BATCH_SIZE
    );
    expect(first.metrics.functionsScheduled.used).toBe(1);
    expect(second.result).toEqual({
      deleted: 1,
      done: false,
      skipped: false,
    });
    expect(second.metrics.databaseQueries.used).toBe(2);
    expect(second.metrics.documentsRead.used).toBe(4);
    expect(second.metrics.documentsWritten.used).toBe(2);
    expect(second.metrics.functionsScheduled.used).toBe(1);
    expect(third.result).toEqual({
      deleted: POPULARITY_RETENTION_BATCH_SIZE,
      done: false,
      skipped: false,
    });
    expect(third.metrics.databaseQueries.used).toBe(2);
    expect(third.metrics.documentsRead.used).toBe(
      2 * POPULARITY_RETENTION_BATCH_SIZE + 1
    );
    expect(third.metrics.documentsWritten.used).toBe(
      POPULARITY_RETENTION_BATCH_SIZE
    );
    expect(third.metrics.functionsScheduled.used).toBe(1);
    expect(fourth.result).toEqual({
      deleted: 1,
      done: true,
      skipped: false,
    });
    expect(fourth.metrics.databaseQueries.used).toBe(2);
    expect(fourth.metrics.documentsRead.used).toBe(4);
    expect(fourth.metrics.documentsWritten.used).toBe(2);
    expect(fourth.metrics.functionsScheduled.used).toBe(0);

    await target.finishAllScheduledFunctions(vi.runAllTimers);

    const state = await target.query(async (ctx) => ({
      counters: await ctx.db.query("learningPopularityCounters").collect(),
      retention: await ctx.db.query("learningPopularityRetention").unique(),
      signals: await ctx.db.query("learningPopularitySignals").collect(),
      viewers: await ctx.db.query("learningPopularityViewerSignals").collect(),
    }));
    const replay = await sweepRetention(target, DAY);

    expect(state.counters).toHaveLength(1);
    expect(state.counters[0]).toMatchObject({
      score: 99,
      windowKey: "lifetime",
    });
    expect(state.viewers.map((signal) => signal.signalDay)).toEqual([DAY]);
    expect(state.signals.map((signal) => signal.signalDay)).toEqual([
      retainedSignalDay,
    ]);
    expect(state.retention).toMatchObject({
      completedDay: DAY,
      day: DAY,
      phase: "signals",
    });
    expect(replay.result).toEqual({
      deleted: 0,
      done: true,
      skipped: true,
    });
    expect(replay.metrics.documentsWritten.used).toBe(0);
    expect(replay.metrics.functionsScheduled.used).toBe(0);
  });

  it("ignores missing and superseded retention pages", async () => {
    const target = createTarget();

    await expect(sweepRetention(target, DAY)).resolves.toMatchObject({
      result: { deleted: 0, done: true, skipped: true },
    });

    await target.mutation(async (ctx) => {
      await ctx.db.insert("learningPopularityRetention", {
        day: DAY + POPULARITY_DAY_MS,
        key: "popularity",
        phase: "viewers",
      });
    });

    await expect(sweepRetention(target, DAY)).resolves.toMatchObject({
      result: { deleted: 0, done: true, skipped: true },
    });
  });
});
