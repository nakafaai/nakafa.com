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
async function insertCounter(
  ctx: MutationCtx,
  input: { readonly contextKey: string; readonly score: number }
) {
  const id = await ctx.db.insert("learningPopularityCounters", {
    ...graph(),
    contextKey: input.contextKey,
    contextMode: "canonical",
    description: "Current description",
    latestDay: DAY,
    locale: "en",
    materialDomain: "mathematics",
    route: ROUTE,
    score: input.score,
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
}

/** Inserts one daily signal with exact applied-window provenance. */
async function insertSignal(
  ctx: MutationCtx,
  input: {
    readonly applied: number;
    readonly contextKey: string;
    readonly day: number;
    readonly title?: string;
    readonly viewCount: number;
  }
) {
  await ctx.db.insert("learningPopularitySignals", {
    ...graph(),
    applied: {
      d1: 0,
      d7: input.applied,
      d14: input.applied,
      d30: input.applied,
      d90: input.applied,
      d180: input.applied,
      d365: input.applied,
    },
    contextKey: input.contextKey,
    contextMode: "canonical",
    description: "Signal description",
    locale: "en",
    materialDomain: "mathematics",
    route: ROUTE,
    scopeMode: "global",
    section: "material",
    signalDay: input.day,
    sourcePath: ROUTE,
    title: input.title ?? "Signal title",
    updatedAt: DAY,
    viewCount: input.viewCount,
  });
}

/** Claims one seven-day cycle so its page can run exactly once. */
async function insertCycle(ctx: MutationCtx, day = DAY) {
  await ctx.db.insert("learningPopularityCycles", {
    completedDay: day - POPULARITY_DAY_MS,
    mode: "expiry",
    scopeMode: "global",
    startedDay: day,
    windowKey: "7d",
  });
}

describe("contents/metrics/expiry", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(DAY));
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("deletes empty windows, skips sparse rows, and repairs corrupt deltas", async () => {
    const target = createTarget();
    const outgoingDay = DAY - 7 * POPULARITY_DAY_MS;

    await target.mutation(async (ctx) => {
      await insertCycle(ctx);

      await insertCounter(ctx, { contextKey: "delete", score: 2 });
      await insertSignal(ctx, {
        applied: 2,
        contextKey: "delete",
        day: outgoingDay,
        viewCount: 2,
      });

      await insertCounter(ctx, { contextKey: "sparse", score: 4 });
      await insertSignal(ctx, {
        applied: 4,
        contextKey: "sparse",
        day: DAY,
        viewCount: 4,
      });

      await insertCounter(ctx, { contextKey: "repair", score: 1 });
      await insertSignal(ctx, {
        applied: 2,
        contextKey: "repair",
        day: outgoingDay,
        viewCount: 2,
      });
      await insertSignal(ctx, {
        applied: 4,
        contextKey: "repair",
        day: DAY,
        title: "Repaired title",
        viewCount: 4,
      });
    });

    const result = await target.mutation(
      internal.contents.mutations.popularity.expireLearningPopularityWindowPage,
      { day: DAY, scopeMode: "global", windowKey: "7d" }
    );
    const counters = await target.query(
      async (ctx) => await ctx.db.query("learningPopularityCounters").collect()
    );

    expect(result).toEqual({
      continueCursor: expect.any(String),
      expiredCounters: 1,
      isDone: true,
      removedCounters: 1,
      repairedCounters: 1,
      skipped: false,
    });
    expect(
      counters
        .map(({ contextKey, score, title }) => ({ contextKey, score, title }))
        .sort((left, right) => left.contextKey.localeCompare(right.contextKey))
    ).toEqual([
      { contextKey: "repair", score: 4, title: "Repaired title" },
      { contextKey: "sparse", score: 4, title: "Current title" },
    ]);
  });

  it("rejects active page replays and resumes from its durable cursor", async () => {
    const target = createTarget();
    const outgoingDay = DAY - 7 * POPULARITY_DAY_MS;

    await target.mutation(async (ctx) => {
      await insertCycle(ctx);
      for (let index = 0; index < 11; index += 1) {
        const contextKey = `page:${index}`;
        await insertCounter(ctx, { contextKey, score: 1 });
        await insertSignal(ctx, {
          applied: 1,
          contextKey,
          day: outgoingDay,
          viewCount: 1,
        });
      }
    });

    const first = await target.mutation(
      internal.contents.mutations.popularity.expireLearningPopularityWindowPage,
      { day: DAY, scopeMode: "global", windowKey: "7d" }
    );
    const pending = await target.query(async (ctx) => ({
      counters: await ctx.db.query("learningPopularityCounters").collect(),
      cycle: await ctx.db.query("learningPopularityCycles").unique(),
    }));

    expect(first).toMatchObject({
      expiredCounters: 10,
      isDone: false,
      removedCounters: 10,
      repairedCounters: 0,
      skipped: false,
    });
    expect(pending.counters).toHaveLength(1);
    expect(pending.cycle?.completedDay).toBe(DAY - POPULARITY_DAY_MS);
    expect(pending.cycle?.cursor).toBe(first.continueCursor);

    const activeReplay = await target.mutation(
      internal.contents.mutations.popularity.expireLearningPopularityWindowPage,
      { day: DAY, scopeMode: "global", windowKey: "7d" }
    );
    const afterReplay = await target.query(
      async (ctx) => await ctx.db.query("learningPopularityCounters").collect()
    );
    const recovery = await target.mutation(
      internal.contents.mutations.popularity.scheduleLearningPopularityExpiries,
      {}
    );

    expect(activeReplay).toMatchObject({
      continueCursor: first.continueCursor,
      expiredCounters: 0,
      skipped: true,
    });
    expect(afterReplay).toHaveLength(1);
    expect(recovery).toEqual({
      expiryWindows: 1,
      repairWindows: 13,
      skippedWindows: 0,
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
    const replay = await target.mutation(
      internal.contents.mutations.popularity.expireLearningPopularityWindowPage,
      { day: DAY, scopeMode: "global", windowKey: "7d" }
    );

    expect(completed.counters).toEqual([]);
    expect(completed.cycle?.completedDay).toBe(DAY);
    expect(replay).toEqual({
      continueCursor: "",
      expiredCounters: 0,
      isDone: true,
      removedCounters: 0,
      repairedCounters: 0,
      skipped: true,
    });
  });

  it("repairs detected drift after an expiry completed on the same day", async () => {
    const target = createTarget();
    const outgoingDay = DAY - 7 * POPULARITY_DAY_MS;

    await target.mutation(async (ctx) => {
      await insertCycle(ctx);
      await insertCounter(ctx, { contextKey: "repair-override", score: 5 });
      const counter = await ctx.db.query("learningPopularityCounters").unique();
      if (!counter) {
        throw new Error("Expected the popularity repair fixture.");
      }
      const { _id, _creationTime, ...value } = counter;
      const lifetimeId = await ctx.db.insert("learningPopularityCounters", {
        ...value,
        windowKey: "lifetime",
      });
      const lifetime = await ctx.db.get(lifetimeId);
      if (!lifetime) {
        throw new Error("Expected the durable popularity identity fixture.");
      }
      await learningPopularityRankings.insert(ctx, lifetime);
      await insertSignal(ctx, {
        applied: 2,
        contextKey: "repair-override",
        day: outgoingDay,
        viewCount: 2,
      });
      await insertSignal(ctx, {
        applied: 4,
        contextKey: "repair-override",
        day: DAY,
        viewCount: 4,
      });
    });

    const expired = await target.mutation(
      internal.contents.mutations.popularity.expireLearningPopularityWindowPage,
      { day: DAY, scopeMode: "global", windowKey: "7d" }
    );
    const drifted = await target.query(
      async (ctx) =>
        await ctx.db
          .query("learningPopularityCounters")
          .withIndex(
            "by_windowKey_and_scopeMode_and_content_id_and_contextKey",
            (q) =>
              q
                .eq("windowKey", "7d")
                .eq("scopeMode", "global")
                .eq("content_id", graph().content_id)
                .eq("contextKey", "repair-override")
          )
          .unique()
    );
    const override = await target.mutation(
      internal.contents.mutations.popularity
        .scheduleLearningPopularityRefreshes,
      {}
    );

    await target.finishAllScheduledFunctions(vi.runAllTimers);

    const state = await target.query(async (ctx) => ({
      counter: await ctx.db
        .query("learningPopularityCounters")
        .withIndex(
          "by_windowKey_and_scopeMode_and_content_id_and_contextKey",
          (q) =>
            q
              .eq("windowKey", "7d")
              .eq("scopeMode", "global")
              .eq("content_id", graph().content_id)
              .eq("contextKey", "repair-override")
        )
        .unique(),
      cycle: await ctx.db
        .query("learningPopularityCycles")
        .withIndex("by_scopeMode_and_windowKey", (q) =>
          q.eq("scopeMode", "global").eq("windowKey", "7d")
        )
        .unique(),
    }));

    expect(expired).toMatchObject({ expiredCounters: 1, skipped: false });
    expect(drifted?.score).toBe(3);
    expect(override).toEqual({ scheduledWindows: 14 });
    expect(state.counter?.score).toBe(4);
    expect(state.cycle).toMatchObject({
      completedDay: DAY,
      mode: "repair",
    });
  });
});
