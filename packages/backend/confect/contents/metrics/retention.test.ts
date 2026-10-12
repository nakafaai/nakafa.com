import { RegisteredConvexFunction } from "@confect/server";
import {
  afterEach,
  assert,
  beforeEach,
  describe,
  expect,
  it,
} from "@effect/vitest";
import confectSchema from "@repo/backend/confect/_generated/schema";
import { pruneLearningPopularity } from "@repo/backend/confect/contents/metrics/retention";
import {
  POPULARITY_DAY_MS,
  POPULARITY_SCOPE,
  POPULARITY_WINDOW,
} from "@repo/backend/confect/contents/popularity";
import { learningPopularityRankings } from "@repo/backend/confect/contents/rankings";
import { registerLearningPopularityAggregate } from "@repo/backend/confect/test.helpers";
import { convexModules } from "@repo/backend/confect/test.setup";
import { internal } from "@repo/backend/convex/_generated/api";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import schema from "@repo/backend/convex/schema";
import { testMaterialGraph } from "@repo/backend/test/content/material";
import { convexTest } from "convex-test";
import { Array as Arr, Effect } from "effect";

const DAY = Date.parse("2026-09-23T00:00:00Z");
// The first day outside the seven-day window, consumed by today's expiry.
const EXPIRED = DAY - 7 * POPULARITY_DAY_MS;
const prune = internal.contents.mutations.popularity.pruneLearningPopularity;
const graph = testMaterialGraph("vector", "addition", "en", "mathematics");
const identity = {
  ...graph,
  content_id: graph.assetId,
  contextKey: "canonical",
  contextMode: "canonical" as const,
  locale: "en" as const,
  scopeMode: "global" as const,
  section: "material" as const,
};

/** Seeds the maintenance state that owns the window's expiration. */
function completeWindow(ctx: MutationCtx, completedDay = DAY) {
  return ctx.db.insert("learningPopularityCycles", {
    completedDay,
    mode: "expiry",
    scopeMode: POPULARITY_SCOPE,
    startedDay: completedDay,
    windowKey: POPULARITY_WINDOW,
  });
}

/** Seeds one private daily deduplication key. */
function insertViewer(
  ctx: MutationCtx,
  signalDay: number,
  viewerKey = "viewer"
) {
  return ctx.db.insert("learningPopularityViewerSignals", {
    ...identity,
    signalDay,
    viewedAt: signalDay,
    viewerKey,
  });
}

/** Seeds one daily contribution consumed by the window's maintenance. */
function insertSignal(ctx: MutationCtx, signalDay: number) {
  return ctx.db.insert("learningPopularitySignals", {
    ...identity,
    applied: { d7: 1 },
    route: "material/vector",
    signalDay,
    sourcePath: "material/vector",
    title: "Vector",
    updatedAt: signalDay,
    viewCount: 1,
  });
}

/** Seeds the ranked counter of the window the pipeline maintains. */
async function insertCounter(ctx: MutationCtx) {
  const counterId = await ctx.db.insert("learningPopularityCounters", {
    ...identity,
    latestDay: DAY,
    route: "material/vector",
    score: 3,
    sourcePath: "material/vector",
    title: "Vector",
    updatedAt: DAY,
    windowKey: POPULARITY_WINDOW,
  });
  const counter = await ctx.db.get(counterId);
  assert.ok(counter, "Expected one ranked popularity counter fixture.");
  await learningPopularityRankings.insert(ctx, counter);
}

describe("contents/metrics/retention", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(DAY);
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });
  it("expires only consumed inputs and still drops a delayed old view", async () => {
    const target = convexTest(schema, convexModules);
    registerLearningPopularityAggregate(target);
    const queueId = await target.mutation(async (ctx) => {
      await completeWindow(ctx);
      await insertViewer(ctx, DAY - POPULARITY_DAY_MS);
      await insertViewer(ctx, DAY);
      await insertViewer(ctx, DAY + POPULARITY_DAY_MS);
      await insertSignal(ctx, EXPIRED);
      await insertSignal(ctx, EXPIRED + POPULARITY_DAY_MS);
      await ctx.db.insert("contentAnalyticsPartitions", {
        partition: 0,
        leaseVersion: 1,
        leaseExpiresAt: DAY + POPULARITY_DAY_MS,
      });
      return await ctx.db.insert("learningEngagementQueue", {
        ...identity,
        insertedAt: EXPIRED,
        partition: 0,
        route: "material/vector",
        sourcePath: "material/vector",
        title: "Vector",
        viewedAt: EXPIRED,
        viewerKey: "viewer",
      });
    });
    expect(await target.mutation(prune, {})).toEqual({
      hasMore: false,
      signalsDeleted: 1,
      viewersDeleted: 1,
      waitingForMaintenance: false,
    });
    expect(await target.query((ctx) => ctx.db.get(queueId))).not.toBeNull();
    expect(
      await target.mutation(
        internal.contents.mutations.analytics.processContentAnalyticsPartition,
        {
          partition: 0,
          leaseVersion: 1,
        }
      )
    ).toMatchObject({
      processed: 1,
      skipped: false,
    });
    expect(await target.query((ctx) => ctx.db.get(queueId))).toBeNull();
    const state = await target.query(async (ctx) => ({
      counters: await ctx.db.query("learningPopularityCounters").take(10),
      signals: await ctx.db.query("learningPopularitySignals").take(10),
      viewers: await ctx.db.query("learningPopularityViewerSignals").take(10),
    }));
    expect(state.counters).toEqual([]);
    expect(Arr.map(state.signals, ({ signalDay }) => signalDay)).toEqual([
      EXPIRED + POPULARITY_DAY_MS,
    ]);
    expect(Arr.map(state.viewers, ({ signalDay }) => signalDay)).toEqual([
      DAY,
      DAY + POPULARITY_DAY_MS,
    ]);
    expect(await target.mutation(prune, {})).toMatchObject({
      hasMore: false,
      signalsDeleted: 0,
      viewersDeleted: 0,
    });
  });
  it.each(["missing", "incomplete", "stale"] as const)(
    "retains daily inputs with a %s maintenance cycle without blocking viewer expiry",
    async (state) => {
      const target = convexTest(schema, convexModules);
      await target.mutation(async (ctx) => {
        const cycleId = await completeWindow(ctx);
        if (state === "missing") {
          await ctx.db.delete(cycleId);
        } else {
          await ctx.db.patch(cycleId, {
            completedDay:
              state === "incomplete" ? undefined : DAY - POPULARITY_DAY_MS,
          });
        }
        await insertSignal(ctx, EXPIRED);
        await insertViewer(ctx, DAY - POPULARITY_DAY_MS);
      });
      expect(await target.mutation(prune, {})).toEqual({
        hasMore: false,
        signalsDeleted: 0,
        viewersDeleted: 1,
        waitingForMaintenance: true,
      });
      expect(
        await target.query((ctx) =>
          ctx.db.query("learningPopularitySignals").take(10)
        )
      ).toHaveLength(1);
    }
  );
  it.each(["viewers", "signals"] as const)(
    "drains multiple %s pages and stops without a stored checkpoint",
    async (kind) => {
      const target = convexTest(schema, convexModules);
      await target.mutation(async (ctx) => {
        await completeWindow(ctx);
        for (let index = 0; index < 150; index += 1) {
          if (kind === "viewers") {
            await insertViewer(ctx, EXPIRED, `viewer-${index}`);
          } else {
            await insertSignal(ctx, EXPIRED - index * POPULARITY_DAY_MS);
          }
        }
      });
      expect(await target.mutation(prune, {})).toMatchObject({
        hasMore: true,
      });
      await target.finishAllScheduledFunctions(vi.runAllTimers);
      const remaining = await target.query(async (ctx) => ({
        viewers: await ctx.db.query("learningPopularityViewerSignals").take(1),
        signals: await ctx.db.query("learningPopularitySignals").take(1),
      }));
      expect(remaining).toEqual({
        signals: [],
        viewers: [],
      });
      expect(await target.mutation(prune, {})).toMatchObject({
        hasMore: false,
      });
    }
  );
  it("rechecks maintenance when a continuation crosses midnight", async () => {
    const target = convexTest(schema, convexModules);
    await target.mutation(async (ctx) => {
      await completeWindow(ctx);
      for (let index = 0; index < 150; index += 1) {
        await insertSignal(ctx, EXPIRED - index * POPULARITY_DAY_MS);
      }
    });
    await target.mutation(prune, {});
    vi.setSystemTime(DAY + POPULARITY_DAY_MS);
    await target.finishAllScheduledFunctions(vi.runAllTimers);
    expect(
      await target.query((ctx) =>
        ctx.db.query("learningPopularitySignals").take(150)
      )
    ).toHaveLength(22);
  });
  it("reads no document on an hourly pass with nothing left to prune", async () => {
    const target = convexTest(schema, convexModules);
    registerLearningPopularityAggregate(target);
    await target.mutation(async (ctx) => {
      await completeWindow(ctx);
      await insertCounter(ctx);
      await insertViewer(ctx, DAY);
      await insertSignal(ctx, DAY - POPULARITY_DAY_MS);
    });

    const idle = await target.mutation(async (ctx) => ({
      receipt: await ctx.runMutation(prune, {}),
      metrics: await ctx.meta.getTransactionMetrics(),
    }));

    expect(idle.receipt).toEqual({
      hasMore: false,
      signalsDeleted: 0,
      viewersDeleted: 0,
      waitingForMaintenance: false,
    });
    expect(idle.metrics.documentsRead.used).toBe(0);
    expect(idle.metrics.documentsWritten.used).toBe(0);
  });
  it("rolls back deletions if continuation scheduling fails", async () => {
    const target = convexTest(schema, convexModules);
    await target.mutation(async (ctx) => {
      for (let index = 0; index < 150; index += 1) {
        await insertViewer(ctx, EXPIRED, `viewer-${index}`);
      }
    });
    await expect(
      target.mutation(async (ctx) => {
        vi.spyOn(ctx.scheduler, "runAfter").mockRejectedValueOnce(
          new Error("Unavailable")
        );
        await Effect.runPromise(
          pruneLearningPopularity().pipe(
            Effect.provide(
              RegisteredConvexFunction.mutationLayer(confectSchema, ctx)
            )
          )
        );
      })
    ).rejects.toMatchObject({
      code: "CONTENT_ANALYTICS_IO_FAILED",
    });
    expect(
      await target.query((ctx) =>
        ctx.db.query("learningPopularityViewerSignals").take(200)
      )
    ).toHaveLength(150);
  });
  it("reports storage failures through the typed analytics error", async () => {
    const target = convexTest(schema, convexModules);
    const error = await target.mutation(async (ctx) => {
      await insertViewer(ctx, EXPIRED);
      vi.spyOn(ctx.db, "delete").mockRejectedValueOnce(
        new Error("Unavailable")
      );
      return await Effect.runPromise(
        pruneLearningPopularity().pipe(
          Effect.match({
            onFailure: (failure) => ({
              ...failure,
            }),
            onSuccess: () => null,
          }),
          Effect.provide(
            RegisteredConvexFunction.mutationLayer(confectSchema, ctx)
          )
        )
      );
    });
    expect(error).toMatchObject({
      _tag: "ContentAnalyticsIoError",
      code: "CONTENT_ANALYTICS_IO_FAILED",
    });
  });
});
