import { RegisteredConvexFunction } from "@confect/server";
import { describe, expect, it } from "@effect/vitest";
import confectSchema from "@repo/backend/confect/_generated/schema";
import { applyContentAnalyticsBatch } from "@repo/backend/confect/contents/metrics/apply";
import {
  getPopularitySignalDay,
  POPULARITY_DAY_MS,
  POPULARITY_SCOPE,
  POPULARITY_SECTION,
  POPULARITY_WINDOW,
} from "@repo/backend/confect/contents/popularity";
import { learningPopularityRankings } from "@repo/backend/confect/contents/rankings";
import { registerLearningPopularityAggregate } from "@repo/backend/confect/test.helpers";
import { convexModules } from "@repo/backend/confect/test.setup";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import schema from "@repo/backend/convex/schema";
import { testMaterialGraph } from "@repo/backend/test/content/material";
import { testArticleGraph } from "@repo/backend/test/content/release";
import { getOrThrow } from "convex-helpers/server/relationships";
import { convexTest, type TestConvex } from "convex-test";
import { Array as Arr, Effect } from "effect";

const NOW = Date.parse("2026-01-01T00:00:00.000Z");
const ARTICLE_ROUTE = "articles/politics/dynastic-politics-asian-values";
const SUBJECT_ROUTE = "material/lesson/mathematics/vector/addition";
const canonicalContext = {
  contextKey: "canonical",
  contextMode: "canonical",
} as const;

/** Adds the persisted content ID alias to one current graph identity. */
function withContentId(graph: ReturnType<typeof testArticleGraph>) {
  return {
    ...graph,
    content_id: graph.assetId,
  };
}

/** Inserts one queue item consumed by the metrics application capability. */
async function insertQueueItem(
  ctx: MutationCtx,
  input: {
    readonly bare?: boolean;
    readonly contextMode?: "canonical" | "placement";
    readonly kind: "article" | "material";
    readonly route?: string;
    readonly suffix: string;
    readonly title?: string;
    readonly viewedAt?: number;
  }
) {
  const material = input.kind === "material";
  const graph = material
    ? withContentId(
        testMaterialGraph("vector", "addition", "en", "mathematics")
      )
    : withContentId(testArticleGraph("dynastic-politics-asian-values"));
  const route = material ? SUBJECT_ROUTE : ARTICLE_ROUTE;
  return await ctx.db.insert("learningEngagementQueue", {
    ...graph,
    ...canonicalContext,
    contextMode: input.contextMode ?? canonicalContext.contextMode,
    ...(input.bare
      ? {}
      : {
          description: material ? "Subject description" : "Article description",
        }),
    insertedAt: NOW,
    locale: "en",
    ...(material && !input.bare
      ? {
          materialDomain: "mathematics" as const,
        }
      : {}),
    partition: 0,
    route: input.route ?? route,
    section: material ? "material" : "articles",
    scopeMode: "global",
    sourcePath: route,
    title: input.title ?? (material ? "Vector Addition" : "Dynastic Politics"),
    viewerKey: `device:${input.suffix}`,
    viewedAt: input.viewedAt ?? NOW,
  });
}

/** Applies every queued fixture row to the derived metric tables. */
function applyQueue(target: TestConvex<typeof schema>) {
  return target.mutation(async (ctx) => {
    const queueItems = await ctx.db.query("learningEngagementQueue").collect();
    await Effect.runPromise(
      applyContentAnalyticsBatch({
        queueItems,
        updatedAt: NOW,
      }).pipe(
        Effect.provide(
          RegisteredConvexFunction.mutationLayer(confectSchema, ctx)
        )
      )
    );
    for (const item of queueItems) {
      await ctx.db.delete(item._id);
    }
  });
}

/** Reads the ranked counters of the maintained window as comparable rows. */
async function readRankedCounters(target: TestConvex<typeof schema>) {
  const counters = await target.query(
    async (ctx) => await ctx.db.query("learningPopularityCounters").collect()
  );
  return Arr.map(
    counters,
    ({ contextMode, latestDay, route, score, title, windowKey }) => ({
      contextMode,
      latestDay,
      route,
      score,
      title,
      windowKey,
    })
  );
}

describe("contents/metrics/apply", () => {
  it("folds repeated current views into one daily signal and one counter", async () => {
    const target = convexTest(schema, convexModules);
    registerLearningPopularityAggregate(target);
    await target.mutation(async (ctx) => {
      await insertQueueItem(ctx, {
        kind: "material",
        suffix: "subject-1",
      });
      await insertQueueItem(ctx, {
        kind: "material",
        suffix: "subject-2",
      });
    });
    await applyQueue(target);
    const state = await target.query(async (ctx) => ({
      counters: await ctx.db.query("learningPopularityCounters").collect(),
      signals: await ctx.db.query("learningPopularitySignals").collect(),
    }));
    const [subjectCounter] = state.counters;
    const [subjectSignal] = state.signals;
    expect(state.counters).toHaveLength(1);
    expect(subjectCounter).toMatchObject({
      locale: "en",
      materialDomain: "mathematics",
      score: 2,
      section: POPULARITY_SECTION,
      scopeMode: POPULARITY_SCOPE,
      updatedAt: NOW,
      windowKey: POPULARITY_WINDOW,
    });
    expect(state.signals).toHaveLength(1);
    expect(subjectSignal).toMatchObject({
      applied: { d7: 2 },
      signalDay: getPopularitySignalDay(NOW),
      updatedAt: NOW,
      viewCount: 2,
    });
    expect(subjectSignal?.applied).toEqual({ d7: 2 });
    const initialRanking = await target.query((ctx) =>
      learningPopularityRankings.paginate(ctx, {
        namespace: ["material", "en", "global", POPULARITY_WINDOW],
        pageSize: 10,
      })
    );
    expect(Arr.map(initialRanking.page, ({ key }) => key)).toEqual([
      [-2, subjectCounter?.content_id],
    ]);
    await target.mutation((ctx) =>
      insertQueueItem(ctx, {
        kind: "material",
        suffix: "subject-3",
      })
    );
    await applyQueue(target);
    const updatedRanking = await target.query((ctx) =>
      learningPopularityRankings.paginate(ctx, {
        namespace: ["material", "en", "global", POPULARITY_WINDOW],
        pageSize: 10,
      })
    );
    expect(Arr.map(updatedRanking.page, ({ key }) => key)).toEqual([
      [-3, subjectCounter?.content_id],
    ]);
    const accumulated = await target.query(
      async (ctx) =>
        await ctx.db
          .query("learningPopularitySignals")
          .withIndex(
            "by_scopeMode_and_signalDay_and_content_id_and_contextKey",
            (q) =>
              q
                .eq("scopeMode", "global")
                .eq("signalDay", NOW)
                .eq("content_id", subjectSignal?.content_id ?? "missing")
                .eq("contextKey", "canonical")
          )
          .unique()
    );
    expect(accumulated).toMatchObject({
      applied: { d7: 3 },
      viewCount: 3,
    });
  });
  it("stores only the optional payload a view carries", async () => {
    const target = convexTest(schema, convexModules);
    registerLearningPopularityAggregate(target);
    await target.mutation((ctx) =>
      insertQueueItem(ctx, {
        bare: true,
        kind: "material",
        suffix: "bare",
      })
    );
    await applyQueue(target);

    const state = await target.query(async (ctx) => ({
      counter: await ctx.db.query("learningPopularityCounters").unique(),
      signal: await ctx.db.query("learningPopularitySignals").unique(),
    }));

    expect(state.counter).toMatchObject({ score: 1 });
    expect(state.signal).toMatchObject({ viewCount: 1 });
    for (const row of [state.counter, state.signal]) {
      expect(row).not.toHaveProperty("description");
      expect(row).not.toHaveProperty("materialDomain");
    }
  });
  it("writes nothing for an article view", async () => {
    const target = convexTest(schema, convexModules);
    registerLearningPopularityAggregate(target);
    await target.mutation((ctx) =>
      insertQueueItem(ctx, {
        kind: "article",
        suffix: "article",
      })
    );
    await applyQueue(target);

    const state = await target.query(async (ctx) => ({
      counters: await ctx.db.query("learningPopularityCounters").collect(),
      signals: await ctx.db.query("learningPopularitySignals").collect(),
    }));

    expect(state).toEqual({ counters: [], signals: [] });
  });
  it("applies one more view to a known identity with one counter and one signal", async () => {
    const target = convexTest(schema, convexModules);
    registerLearningPopularityAggregate(target);
    await target.mutation((ctx) =>
      insertQueueItem(ctx, {
        kind: "material",
        suffix: "first",
      })
    );
    await applyQueue(target);

    const update = await target.mutation(async (ctx) => {
      await insertQueueItem(ctx, {
        kind: "material",
        suffix: "second",
      });
      const queueItems = await ctx.db
        .query("learningEngagementQueue")
        .collect();
      await Effect.runPromise(
        applyContentAnalyticsBatch({ queueItems, updatedAt: NOW }).pipe(
          Effect.provide(
            RegisteredConvexFunction.mutationLayer(confectSchema, ctx)
          )
        )
      );
      return await ctx.meta.getTransactionMetrics();
    });

    // One signal and one counter, each replaced in place together with its
    // ranking entry. On one lesson the same update used to touch the signal and
    // eight counters: 101 documents read and 27 written.
    expect(update.documentsRead.used).toBe(16);
    expect(update.documentsWritten.used).toBe(5);
    expect(update.bytesRead.used).toBeLessThan(10_000);
  });
  it("drops a view older than the window instead of counting it", async () => {
    const target = convexTest(schema, convexModules);
    registerLearningPopularityAggregate(target);
    await target.mutation((ctx) =>
      insertQueueItem(ctx, {
        kind: "material",
        suffix: "stale-subject",
        viewedAt: NOW - 8 * POPULARITY_DAY_MS,
      })
    );
    await applyQueue(target);
    const state = await target.query(async (ctx) => ({
      counters: await ctx.db.query("learningPopularityCounters").collect(),
      signals: await ctx.db.query("learningPopularitySignals").collect(),
    }));
    expect(state).toEqual({ counters: [], signals: [] });
  });
  it("projects the newest payload from an out-of-order queue batch", async () => {
    const target = convexTest(schema, convexModules);
    registerLearningPopularityAggregate(target);
    await target.mutation(async (ctx) => {
      await insertQueueItem(ctx, {
        kind: "material",
        route: "material/newest-vector",
        suffix: "newest",
        title: "Newest Vector Addition",
      });
      await insertQueueItem(ctx, {
        contextMode: "placement",
        kind: "material",
        route: "material/older-vector",
        suffix: "older",
        title: "Older Vector Addition",
        viewedAt: NOW - 3 * POPULARITY_DAY_MS,
      });
    });
    await applyQueue(target);
    expect(await readRankedCounters(target)).toEqual([
      {
        contextMode: "canonical",
        latestDay: NOW,
        route: "material/newest-vector",
        score: 2,
        title: "Newest Vector Addition",
        windowKey: "7d",
      },
    ]);
  });
  it("preserves a newer payload while accepting late events", async () => {
    const target = convexTest(schema, convexModules);
    registerLearningPopularityAggregate(target);
    const subject = withContentId(
      testMaterialGraph("vector", "addition", "en", "mathematics")
    );
    const lateDay = NOW - 3 * POPULARITY_DAY_MS;
    await target.mutation(async (ctx) => {
      const base = {
        ...subject,
        contextKey: "canonical",
        contextMode: "canonical" as const,
        description: "Current subject description",
        locale: "en" as const,
        materialDomain: "mathematics" as const,
        route: "material/current-vector",
        scopeMode: "global" as const,
        section: "material" as const,
        sourcePath: SUBJECT_ROUTE,
        title: "Newest Vector Addition",
        updatedAt: NOW - POPULARITY_DAY_MS,
      };
      await ctx.db.insert("learningPopularitySignals", {
        ...base,
        applied: { d7: 5 },
        signalDay: NOW,
        viewCount: 5,
      });
      await ctx.db.insert("learningPopularitySignals", {
        ...base,
        applied: { d7: 1 },
        route: "material/older-vector",
        signalDay: lateDay,
        title: "Older Vector Addition",
        viewCount: 1,
      });
      const counterId = await ctx.db.insert("learningPopularityCounters", {
        ...base,
        latestDay: NOW,
        score: 6,
        windowKey: POPULARITY_WINDOW,
      });
      await learningPopularityRankings.insert(
        ctx,
        await getOrThrow(ctx, "learningPopularityCounters", counterId)
      );
      await insertQueueItem(ctx, {
        contextMode: "placement",
        kind: "material",
        route: "material/late-vector",
        suffix: "late-rollout-1",
        title: "Late Vector Addition",
        viewedAt: lateDay,
      });
    });
    await applyQueue(target);
    expect(await readRankedCounters(target)).toEqual([
      {
        contextMode: "canonical",
        latestDay: NOW,
        route: "material/current-vector",
        score: 7,
        title: "Newest Vector Addition",
        windowKey: "7d",
      },
    ]);
    await target.mutation((ctx) =>
      insertQueueItem(ctx, {
        contextMode: "placement",
        kind: "material",
        route: "material/later-processed-vector",
        suffix: "late-rollout-2",
        title: "Later Processed Vector Addition",
        viewedAt: lateDay,
      })
    );
    await applyQueue(target);
    expect(await readRankedCounters(target)).toEqual([
      {
        contextMode: "canonical",
        latestDay: NOW,
        route: "material/current-vector",
        score: 8,
        title: "Newest Vector Addition",
        windowKey: "7d",
      },
    ]);
  });
});
