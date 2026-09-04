import { afterEach, beforeEach, describe, expect, it } from "@effect/vitest";
import { internal } from "@repo/backend/convex/_generated/api";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import { LEARNING_POPULARITY_REFRESH_BATCH_SIZE } from "@repo/backend/convex/contents/constants";
import { learningPopularityRankings } from "@repo/backend/convex/contents/rankings";
import schema from "@repo/backend/convex/schema";
import { registerLearningPopularityAggregate } from "@repo/backend/convex/test.helpers";
import { convexModules } from "@repo/backend/convex/test.setup";
import { testMaterialGraph } from "@repo/backend/test/content/material";
import { convexTest } from "convex-test";

const NOW = Date.parse("2026-01-08T12:00:00.000Z");

/** Builds a Convex test instance with production popularity triggers enabled. */
function createPopularityConvexTest() {
  const target = convexTest(schema, convexModules);
  registerLearningPopularityAggregate(target);
  return target;
}

/** Adds one expired counter so pagination must delete it during refresh. */
async function insertExpiredCounter(ctx: MutationCtx, index: number) {
  const graph = testMaterialGraph(
    "vector",
    `section-${index}`,
    "en",
    "mathematics"
  );
  const id = await ctx.db.insert("learningPopularityCounters", {
    ...graph,
    content_id: graph.assetId,
    contextKey: "canonical",
    contextMode: "canonical",
    locale: "en",
    materialDomain: "mathematics",
    route: `material/${index}`,
    score: 1,
    section: "material",
    scopeMode: "global",
    sourcePath: `material/${index}`,
    title: `Material ${index}`,
    updatedAt: NOW,
    windowKey: "7d",
  });
  const counter = await ctx.db.get(id);
  if (!counter) {
    throw new Error("Expected the pagination counter to exist.");
  }
  await learningPopularityRankings.insert(ctx, counter);
}

describe("contents/metrics/refresh", () => {
  beforeEach(() => {
    vi.useFakeTimers({ now: NOW });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("schedules every finite window for both popularity scopes", async () => {
    const target = createPopularityConvexTest();
    const state = await target.mutation(async (ctx) => {
      const result = await ctx.runMutation(
        internal.contents.mutations.popularity
          .scheduleLearningPopularityRefreshes,
        {}
      );
      return {
        jobs: await ctx.db.system.query("_scheduled_functions").collect(),
        result,
      };
    });

    expect(state.result).toEqual({ scheduledWindows: 14 });
    expect(state.jobs).toHaveLength(14);
    expect(
      state.jobs.every(({ args }) => args[0]?.windowKey !== "lifetime")
    ).toBe(true);
  });

  it("skips lifetime refreshes without writes or continuation jobs", async () => {
    const target = createPopularityConvexTest();
    const state = await target.mutation(async (ctx) => {
      const result = await ctx.runMutation(
        internal.contents.mutations.popularity
          .refreshLearningPopularityWindowPage,
        { scopeMode: "global", windowKey: "lifetime" }
      );
      return {
        jobs: await ctx.db.system.query("_scheduled_functions").collect(),
        metrics: await ctx.meta.getTransactionMetrics(),
        result,
      };
    });

    expect(state.result).toEqual({
      continueCursor: "",
      isDone: true,
      refreshedCounters: 0,
      removedCounters: 0,
      skipped: true,
    });
    expect(state.metrics.documentsWritten.used).toBe(0);
    expect(state.jobs).toEqual([]);
  });

  it("bounds each page and schedules the remaining counters", async () => {
    const target = createPopularityConvexTest();
    await target.mutation(async (ctx) => {
      for (
        let index = 0;
        index < LEARNING_POPULARITY_REFRESH_BATCH_SIZE + 1;
        index += 1
      ) {
        await insertExpiredCounter(ctx, index);
      }
    });

    const state = await target.mutation(async (ctx) => {
      const result = await ctx.runMutation(
        internal.contents.mutations.popularity
          .refreshLearningPopularityWindowPage,
        { scopeMode: "global", windowKey: "7d" }
      );
      return {
        jobs: await ctx.db.system.query("_scheduled_functions").collect(),
        result,
      };
    });

    expect(state.result).toEqual({
      continueCursor: expect.any(String),
      isDone: false,
      refreshedCounters: 0,
      removedCounters: LEARNING_POPULARITY_REFRESH_BATCH_SIZE,
      skipped: false,
    });
    expect(state.jobs).toHaveLength(1);
    expect(state.jobs[0]?.args[0]).toMatchObject({
      scopeMode: "global",
      windowKey: "7d",
    });
  });
});
