import { afterEach, beforeEach, describe, expect, it } from "@effect/vitest";
import { internal } from "@repo/backend/convex/_generated/api";
import { CONTENT_ANALYTICS_LEASE_DURATION_MS } from "@repo/backend/convex/contents/constants";
import { getPopularityCyclePage } from "@repo/backend/convex/contents/metrics/cycle";
import { POPULARITY_DAY_MS } from "@repo/backend/convex/contents/popularity";
import { learningPopularityRankings } from "@repo/backend/convex/contents/rankings";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import schema from "@repo/backend/convex/schema";
import { registerLearningPopularityAggregate } from "@repo/backend/convex/test.helpers";
import { convexModules } from "@repo/backend/convex/test.setup";
import { testMaterialGraph } from "@repo/backend/test/content/material";
import { convexTest } from "convex-test";

const DAY = Date.parse("2026-01-08T00:00:00.000Z");

/** Builds a test deployment with the production ranking component. */
function createTarget() {
  const target = convexTest(schema, convexModules);
  registerLearningPopularityAggregate(target);
  return target;
}

/** Applies one queued view through the production drain and ranking triggers. */
async function applyView(
  target: ReturnType<typeof createTarget>,
  viewedAt: number,
  leaseVersion: number
) {
  await target.mutation(async (ctx) => {
    const graph = testMaterialGraph("vector", "addition", "en", "mathematics");
    await ctx.db.insert("learningEngagementQueue", {
      ...graph,
      content_id: graph.assetId,
      contextKey: "canonical",
      contextMode: "canonical",
      insertedAt: viewedAt,
      locale: "en",
      materialDomain: "mathematics",
      partition: 0,
      route: "material/lesson/mathematics/vector/addition",
      scopeMode: "global",
      section: "material",
      sourcePath: "material/lesson/mathematics/vector/addition",
      title: "Vector addition",
      viewedAt,
      viewerKey: `device:rollover-${leaseVersion}`,
    });
    const partition = await ctx.db.query("contentAnalyticsPartitions").unique();
    const lease = {
      leaseExpiresAt: viewedAt + CONTENT_ANALYTICS_LEASE_DURATION_MS,
      leaseVersion,
      partition: 0,
    };
    if (partition) {
      await ctx.db.patch(partition._id, lease);
    } else {
      await ctx.db.insert("contentAnalyticsPartitions", lease);
    }
  });
  await target.mutation(
    internal.contents.mutations.analytics.processContentAnalyticsPartition,
    { leaseVersion, partition: 0 }
  );
}

describe("contents/metrics/cycle", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(DAY));
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("resumes active schedules and skips only completed work", async () => {
    const target = createTarget();

    const rollout = await target.mutation(
      internal.contents.mutations.popularity.scheduleLearningPopularityExpiries,
      {}
    );
    const duplicate = await target.mutation(
      internal.contents.mutations.popularity.scheduleLearningPopularityExpiries,
      {}
    );

    expect(rollout).toEqual({
      expiryWindows: 0,
      repairWindows: 14,
      skippedWindows: 0,
    });
    expect(duplicate).toEqual({
      expiryWindows: 0,
      repairWindows: 14,
      skippedWindows: 0,
    });

    await target.finishAllScheduledFunctions(vi.runAllTimers);
    vi.setSystemTime(new Date(DAY + POPULARITY_DAY_MS));

    const daily = await target.mutation(
      internal.contents.mutations.popularity.scheduleLearningPopularityExpiries,
      {}
    );
    expect(daily).toEqual({
      expiryWindows: 14,
      repairWindows: 0,
      skippedWindows: 0,
    });
    const duplicateDaily = await target.mutation(
      internal.contents.mutations.popularity.scheduleLearningPopularityExpiries,
      {}
    );
    expect(duplicateDaily).toEqual({
      expiryWindows: 14,
      repairWindows: 0,
      skippedWindows: 0,
    });

    await target.finishAllScheduledFunctions(vi.runAllTimers);
    vi.setSystemTime(new Date(DAY + 2 * POPULARITY_DAY_MS));

    const weekly = await target.mutation(
      internal.contents.mutations.popularity
        .scheduleLearningPopularityRefreshes,
      {}
    );
    const duplicateWeekly = await target.mutation(
      internal.contents.mutations.popularity
        .scheduleLearningPopularityRefreshes,
      {}
    );
    expect(weekly).toEqual({ scheduledWindows: 14 });
    expect(duplicateWeekly).toEqual({ scheduledWindows: 14 });

    await target.finishAllScheduledFunctions(vi.runAllTimers);
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
          .scheduleLearningPopularityExpiries,
        {}
      )
    ).resolves.toEqual({
      expiryWindows: 0,
      repairWindows: 0,
      skippedWindows: 14,
    });
  });

  it("rejects pages superseded by a newer cycle", async () => {
    const target = createTarget();
    const completion = await target.mutation(async (ctx) => {
      const cycleId = await ctx.db.insert("learningPopularityCycles", {
        completedDay: DAY - POPULARITY_DAY_MS,
        mode: "expiry",
        scopeMode: "global",
        startedDay: DAY + POPULARITY_DAY_MS,
        windowKey: "7d",
      });
      const cycle = await ctx.db.get(cycleId);
      if (!cycle) {
        throw new Error("Expected the popularity cycle fixture.");
      }
      return await runConvexProgram(
        getPopularityCyclePage(ctx, {
          day: DAY,
          mode: "expiry",
          scopeMode: "global",
          windowKey: "7d",
        })
      );
    });

    const superseded = await target.mutation(
      internal.contents.mutations.popularity.expireLearningPopularityWindowPage,
      { day: DAY, scopeMode: "global", windowKey: "7d" }
    );
    const supersededRepair = await target.mutation(
      internal.contents.mutations.popularity
        .refreshLearningPopularityWindowPage,
      { day: DAY, scopeMode: "global", windowKey: "7d" }
    );

    expect(completion).toMatchObject({ current: false });
    expect(superseded).toMatchObject({ skipped: true });
    expect(supersededRepair).toMatchObject({
      continueCursor: "",
      skipped: true,
    });
  });

  it("preserves new-day views when a repair page crosses UTC midnight", async () => {
    const target = createTarget();
    await applyView(target, DAY, 1);
    await target.mutation(
      internal.contents.mutations.popularity
        .scheduleLearningPopularityRefreshes,
      {}
    );

    const nextDay = DAY + POPULARITY_DAY_MS;
    vi.setSystemTime(new Date(nextDay));
    await applyView(target, nextDay, 2);

    const delayed = await target.mutation(async (ctx) => {
      const result = await ctx.runMutation(
        internal.contents.mutations.popularity
          .refreshLearningPopularityWindowPage,
        { day: DAY, scopeMode: "global", windowKey: "1d" }
      );
      return { result, metrics: await ctx.meta.getTransactionMetrics() };
    });
    const pending = await target.query(async (ctx) => ({
      counter: await ctx.db
        .query("learningPopularityCounters")
        .withIndex(
          "by_windowKey_and_scopeMode_and_content_id_and_contextKey",
          (q) => q.eq("windowKey", "1d")
        )
        .unique(),
      cycle: await ctx.db
        .query("learningPopularityCycles")
        .withIndex("by_scopeMode_and_windowKey", (q) =>
          q.eq("scopeMode", "global").eq("windowKey", "1d")
        )
        .unique(),
    }));
    expect(delayed.result).toMatchObject({ skipped: true });
    expect(delayed.metrics.documentsWritten.used).toBe(0);
    expect(pending.counter?.score).toBe(2);
    expect(pending.cycle?.completedDay).toBeUndefined();

    const recovery = await target.mutation(
      internal.contents.mutations.popularity.scheduleLearningPopularityExpiries,
      {}
    );
    expect(recovery).toEqual({
      expiryWindows: 0,
      repairWindows: 14,
      skippedWindows: 0,
    });
    await target.finishAllScheduledFunctions(vi.runAllTimers);

    const completed = await target.query(async (ctx) => ({
      counters: await ctx.db.query("learningPopularityCounters").collect(),
      ranking: await learningPopularityRankings.paginate(ctx, {
        namespace: ["material", "en", "global", "1d"],
        order: "asc",
        pageSize: 10,
      }),
      cycle: await ctx.db
        .query("learningPopularityCycles")
        .withIndex("by_scopeMode_and_windowKey", (q) =>
          q.eq("scopeMode", "global").eq("windowKey", "1d")
        )
        .unique(),
    }));
    expect(
      completed.counters.find(({ windowKey }) => windowKey === "1d")?.score
    ).toBe(1);
    expect(
      completed.counters
        .filter(({ windowKey }) => windowKey !== "1d")
        .map(({ score }) => score)
    ).toEqual(Array.from({ length: 7 }, () => 2));
    expect(completed.ranking.page.map(({ key }) => key[0])).toEqual([-1]);
    expect(completed.cycle).toMatchObject({
      completedDay: nextDay,
      mode: "repair",
    });
  });
});
