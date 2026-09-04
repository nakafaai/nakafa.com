import { afterEach, beforeEach, describe, expect, it } from "@effect/vitest";
import { internal } from "@repo/backend/convex/_generated/api";
import { getPopularityCyclePage } from "@repo/backend/convex/contents/metrics/cycle";
import { POPULARITY_DAY_MS } from "@repo/backend/convex/contents/popularity";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import schema from "@repo/backend/convex/schema";
import { registerLearningPopularityAggregate } from "@repo/backend/convex/test.helpers";
import { convexModules } from "@repo/backend/convex/test.setup";
import { convexTest } from "convex-test";

const DAY = Date.parse("2026-01-08T00:00:00.000Z");

/** Builds a test deployment with the production ranking component. */
function createTarget() {
  const target = convexTest(schema, convexModules);
  registerLearningPopularityAggregate(target);
  return target;
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

  it("rejects invalid windows and pages superseded by a newer cycle", async () => {
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

    const invalid = await target.mutation(
      internal.contents.mutations.popularity.expireLearningPopularityWindowPage,
      { day: DAY, scopeMode: "global", windowKey: "lifetime" }
    );
    const superseded = await target.mutation(
      internal.contents.mutations.popularity.expireLearningPopularityWindowPage,
      { day: DAY, scopeMode: "global", windowKey: "7d" }
    );
    const invalidRepair = await target.mutation(
      internal.contents.mutations.popularity
        .refreshLearningPopularityWindowPage,
      {
        cursor: "invalid",
        day: DAY,
        scopeMode: "global",
        windowKey: "lifetime",
      }
    );
    const invalidRepairFromStart = await target.mutation(
      internal.contents.mutations.popularity
        .refreshLearningPopularityWindowPage,
      { day: DAY, scopeMode: "global", windowKey: "lifetime" }
    );
    const supersededRepair = await target.mutation(
      internal.contents.mutations.popularity
        .refreshLearningPopularityWindowPage,
      { day: DAY, scopeMode: "global", windowKey: "7d" }
    );

    expect(completion).toMatchObject({ current: false });
    expect(invalid).toMatchObject({ skipped: true });
    expect(superseded).toMatchObject({ skipped: true });
    expect(invalidRepair).toMatchObject({
      continueCursor: "invalid",
      skipped: true,
    });
    expect(invalidRepairFromStart).toMatchObject({
      continueCursor: "",
      skipped: true,
    });
    expect(supersededRepair).toMatchObject({
      continueCursor: "",
      skipped: true,
    });
  });
});
