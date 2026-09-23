import { afterEach, beforeEach, describe, expect, it } from "@effect/vitest";
import { internal } from "@repo/backend/convex/_generated/api";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import { pruneLearningPopularity } from "@repo/backend/convex/contents/metrics/retention";
import {
  learningPopularityFiniteWindowValues,
  learningPopularityScopeValues,
  POPULARITY_DAY_MS,
} from "@repo/backend/convex/contents/popularity";
import { learningPopularityRankings } from "@repo/backend/convex/contents/rankings";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import schema from "@repo/backend/convex/schema";
import { registerLearningPopularityAggregate } from "@repo/backend/convex/test.helpers";
import { convexModules } from "@repo/backend/convex/test.setup";
import { testMaterialGraph } from "@repo/backend/test/content/material";
import { convexTest } from "convex-test";
import { Effect } from "effect";

const DAY = Date.parse("2026-09-23T00:00:00Z");
const EXPIRED = DAY - 365 * POPULARITY_DAY_MS;
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

/** Seeds the maintenance state that owns finite-window expiration. */
async function completeWindows(ctx: MutationCtx, completedDay = DAY) {
  for (const scopeMode of learningPopularityScopeValues) {
    for (const windowKey of learningPopularityFiniteWindowValues) {
      await ctx.db.insert("learningPopularityCycles", {
        completedDay,
        mode: "expiry",
        scopeMode,
        startedDay: completedDay,
        windowKey,
      });
    }
  }
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

/** Seeds one daily contribution consumed by finite-window maintenance. */
function insertSignal(ctx: MutationCtx, signalDay: number) {
  return ctx.db.insert("learningPopularitySignals", {
    ...identity,
    applied: { d1: 1, d7: 1, d14: 1, d30: 1, d90: 1, d180: 1, d365: 1 },
    route: "material/vector",
    signalDay,
    sourcePath: "material/vector",
    title: "Vector",
    updatedAt: signalDay,
    viewCount: 1,
  });
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

  it("expires only consumed inputs and preserves delayed lifetime work", async () => {
    const target = convexTest(schema, convexModules);
    registerLearningPopularityAggregate(target);
    const queueId = await target.mutation(async (ctx) => {
      await completeWindows(ctx);
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
      const counterId = await ctx.db.insert("learningPopularityCounters", {
        ...identity,
        latestDay: EXPIRED,
        route: "material/vector",
        score: 41,
        sourcePath: "material/vector",
        title: "Vector",
        updatedAt: EXPIRED,
        windowKey: "lifetime",
      });
      const counter = await ctx.db.get(counterId);
      expect(counter).not.toBeNull();
      if (counter) {
        await learningPopularityRankings.insert(ctx, counter);
      }
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
        { partition: 0, leaseVersion: 1 }
      )
    ).toMatchObject({ processed: 1, skipped: false });
    expect(await target.query((ctx) => ctx.db.get(queueId))).toBeNull();
    const state = await target.query(async (ctx) => ({
      counters: await ctx.db.query("learningPopularityCounters").take(10),
      ranking: await learningPopularityRankings.paginate(ctx, {
        namespace: ["material", "en", "global", "lifetime"],
        pageSize: 10,
      }),
      signals: await ctx.db.query("learningPopularitySignals").take(10),
      viewers: await ctx.db.query("learningPopularityViewerSignals").take(10),
    }));
    expect(state.counters).toMatchObject([
      { score: 42, windowKey: "lifetime" },
    ]);
    expect(state.ranking.page.map(({ key }) => key)).toEqual([
      [-42, graph.assetId],
    ]);
    expect(state.signals.map(({ signalDay }) => signalDay)).toEqual([
      EXPIRED + POPULARITY_DAY_MS,
    ]);
    expect(state.viewers.map(({ signalDay }) => signalDay)).toEqual([
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
        await completeWindows(ctx);
        const cycle = await ctx.db.query("learningPopularityCycles").first();
        if (cycle) {
          if (state === "missing") {
            await ctx.db.delete(cycle._id);
          } else {
            await ctx.db.patch(cycle._id, {
              completedDay:
                state === "incomplete" ? undefined : DAY - POPULARITY_DAY_MS,
            });
          }
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
        await completeWindows(ctx);
        for (let index = 0; index < 150; index += 1) {
          if (kind === "viewers") {
            await insertViewer(ctx, EXPIRED, `viewer-${index}`);
          } else {
            await insertSignal(ctx, EXPIRED - index * POPULARITY_DAY_MS);
          }
        }
      });
      expect(await target.mutation(prune, {})).toMatchObject({ hasMore: true });
      await target.finishAllScheduledFunctions(vi.runAllTimers);
      const remaining = await target.query(async (ctx) => ({
        viewers: await ctx.db.query("learningPopularityViewerSignals").take(1),
        signals: await ctx.db.query("learningPopularitySignals").take(1),
      }));
      expect(remaining).toEqual({ signals: [], viewers: [] });
      expect(await target.mutation(prune, {})).toMatchObject({
        hasMore: false,
      });
    }
  );

  it("rechecks maintenance when a continuation crosses midnight", async () => {
    const target = convexTest(schema, convexModules);
    await target.mutation(async (ctx) => {
      await completeWindows(ctx);
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
        await runConvexProgram(pruneLearningPopularity(ctx, prune));
      })
    ).rejects.toThrow("CONTENT_ANALYTICS_IO_FAILED");
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
      return await runConvexProgram(
        pruneLearningPopularity(ctx, prune).pipe(
          Effect.match({
            onFailure: (failure) => ({ ...failure }),
            onSuccess: () => null,
          })
        )
      );
    });
    expect(error).toMatchObject({
      _tag: "ContentAnalyticsIoError",
      code: "CONTENT_ANALYTICS_IO_FAILED",
    });
  });
});
