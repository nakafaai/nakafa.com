import { afterEach, beforeEach, describe, expect, it } from "@effect/vitest";
import { internal } from "@repo/backend/convex/_generated/api";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import { POPULARITY_DAY_MS } from "@repo/backend/convex/contents/popularity";
import { learningPopularityRankings } from "@repo/backend/convex/contents/rankings";
import schema from "@repo/backend/convex/schema";
import { registerLearningPopularityAggregate } from "@repo/backend/convex/test.helpers";
import { convexModules } from "@repo/backend/convex/test.setup";
import { testMaterialGraph } from "@repo/backend/test/content/material";
import { convexTest } from "convex-test";

const DAY = Date.parse("2026-01-08T00:00:00.000Z");
const ROUTE = "material/lesson/mathematics/vector/addition";

/** Builds a test deployment with the production ranking trigger component. */
function createTarget() {
  const target = convexTest(schema, convexModules);
  registerLearningPopularityAggregate(target);
  return target;
}

/** Adds the persisted content ID alias to the current material graph. */
function graph() {
  const value = testMaterialGraph("vector", "addition", "en", "mathematics");
  return { ...value, content_id: value.assetId };
}

/** Inserts one ranked seven-day counter for an isolated context identity. */
async function insertCounter(ctx: MutationCtx, contextKey: string) {
  const id = await ctx.db.insert("learningPopularityCounters", {
    ...graph(),
    contextKey,
    contextMode: "canonical",
    description: "Current description",
    latestDay: DAY,
    locale: "en",
    materialDomain: "mathematics",
    route: ROUTE,
    score: 1,
    section: "material",
    scopeMode: "global",
    sourcePath: ROUTE,
    title: "Current title",
    updatedAt: DAY - POPULARITY_DAY_MS,
    windowKey: "7d",
  });
  const counter = await ctx.db.get(id);
  if (!counter) {
    throw new Error("Expected the popularity counter fixture.");
  }
  await learningPopularityRankings.insert(ctx, counter);
  return counter;
}

/** Inserts one current daily signal with exact window provenance. */
async function insertSignal(
  ctx: MutationCtx,
  input: {
    readonly contextKey: string;
    readonly sparse?: boolean;
    readonly title?: string;
    readonly viewCount: number;
  }
) {
  await ctx.db.insert("learningPopularitySignals", {
    ...graph(),
    applied: {
      d1: input.viewCount,
      d7: input.viewCount,
      d14: input.viewCount,
      d30: input.viewCount,
      d90: input.viewCount,
      d180: input.viewCount,
      d365: input.viewCount,
    },
    contextKey: input.contextKey,
    contextMode: "canonical",
    ...(input.sparse ? {} : { description: "Signal description" }),
    locale: "en",
    ...(input.sparse ? {} : { materialDomain: "mathematics" as const }),
    route: ROUTE,
    scopeMode: "global",
    section: "material",
    signalDay: DAY,
    sourcePath: ROUTE,
    title: input.title ?? "Signal title",
    updatedAt: DAY,
    viewCount: input.viewCount,
  });
}

/** Claims the seven-day repair cycle used by one test page chain. */
async function insertCycle(ctx: MutationCtx) {
  await ctx.db.insert("learningPopularityCycles", {
    completedDay: DAY - POPULARITY_DAY_MS,
    mode: "repair",
    scopeMode: "global",
    startedDay: DAY,
    windowKey: "7d",
  });
}

describe("contents/metrics/repair", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(DAY));
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("completes every repair page before advancing its watermark", async () => {
    const target = createTarget();

    await target.mutation(async (ctx) => {
      await insertCycle(ctx);
      for (let index = 0; index < 11; index += 1) {
        await insertCounter(ctx, `repair-page:${index}`);
      }
    });

    const first = await target.mutation(
      internal.contents.mutations.popularity
        .refreshLearningPopularityWindowPage,
      { day: DAY, scopeMode: "global", windowKey: "7d" }
    );
    const pending = await target.query(async (ctx) => ({
      counters: await ctx.db.query("learningPopularityCounters").collect(),
      cycle: await ctx.db.query("learningPopularityCycles").unique(),
    }));

    expect(first).toMatchObject({
      isDone: false,
      refreshedCounters: 0,
      removedCounters: 10,
      skipped: false,
    });
    expect(pending.counters).toHaveLength(1);
    expect(pending.cycle?.completedDay).toBe(DAY - POPULARITY_DAY_MS);

    const recovery = await target.mutation(
      internal.contents.mutations.popularity
        .scheduleLearningPopularityRefreshes,
      {}
    );
    const recoveryJobs = await target.query(
      async (ctx) => await ctx.db.system.query("_scheduled_functions").collect()
    );

    expect(recovery).toEqual({ scheduledWindows: 14 });
    expect(recoveryJobs.map(({ args }) => args[0])).toContainEqual({
      cursor: first.continueCursor,
      day: DAY,
      scopeMode: "global",
      windowKey: "7d",
    });

    await target.finishAllScheduledFunctions(vi.runAllTimers);

    const completed = await target.query(async (ctx) => ({
      counters: await ctx.db.query("learningPopularityCounters").collect(),
      cycle: await ctx.db
        .query("learningPopularityCycles")
        .withIndex("by_scopeMode_and_windowKey", (q) =>
          q.eq("scopeMode", "global").eq("windowKey", "7d")
        )
        .unique(),
    }));
    expect(completed.counters).toEqual([]);
    expect(completed.cycle?.completedDay).toBe(DAY);
  });

  it("preserves optional payload and deletes corrupt nonpositive repair", async () => {
    const target = createTarget();

    await target.mutation(async (ctx) => {
      await insertCycle(ctx);
      const sparseCounter = await insertCounter(ctx, "sparse-repair");
      await ctx.db.patch(sparseCounter._id, {
        contextMaterialKey: "kept-material",
        contextNodeKey: "kept-node",
        contextParentPath: "kept/parent",
        contextProgramKey: "kept-program",
        contextPublicPath: "kept/public",
        contextSourcePath: "kept/source",
        description: "Kept description",
        materialDomain: "mathematics",
      });
      await insertSignal(ctx, {
        contextKey: "sparse-repair",
        sparse: true,
        title: "New required payload",
        viewCount: 3,
      });

      await insertCounter(ctx, "negative-repair");
      await insertSignal(ctx, {
        contextKey: "negative-repair",
        viewCount: -1,
      });
    });

    const result = await target.mutation(
      internal.contents.mutations.popularity
        .refreshLearningPopularityWindowPage,
      { day: DAY, scopeMode: "global", windowKey: "7d" }
    );
    const counters = await target.query(
      async (ctx) => await ctx.db.query("learningPopularityCounters").collect()
    );

    expect(result).toMatchObject({
      refreshedCounters: 1,
      removedCounters: 1,
      skipped: false,
    });
    expect(counters).toHaveLength(1);
    expect(counters[0]).toMatchObject({
      contextMaterialKey: "kept-material",
      contextNodeKey: "kept-node",
      contextParentPath: "kept/parent",
      contextProgramKey: "kept-program",
      contextPublicPath: "kept/public",
      contextSourcePath: "kept/source",
      description: "Kept description",
      latestDay: DAY,
      materialDomain: "mathematics",
      score: 3,
      title: "New required payload",
    });
  });
});
