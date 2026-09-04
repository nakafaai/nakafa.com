import { describe, expect, it } from "@effect/vitest";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import { applyContentAnalyticsBatch } from "@repo/backend/convex/contents/metrics/apply";
import {
  getDefaultPopularityWindow,
  getLifetimePopularityWindow,
  getPopularitySignalDay,
  POPULARITY_DAY_MS,
} from "@repo/backend/convex/contents/popularity";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import schema from "@repo/backend/convex/schema";
import { convexModules } from "@repo/backend/convex/test.setup";
import { testMaterialGraph } from "@repo/backend/test/content/material";
import { testArticleGraph } from "@repo/backend/test/content/release";
import { convexTest, type TestConvex } from "convex-test";

const NOW = Date.parse("2026-01-01T00:00:00.000Z");
const ARTICLE_ROUTE = "articles/politics/dynastic-politics-asian-values";
const SUBJECT_ROUTE = "material/lesson/mathematics/vector/addition";
const canonicalContext = {
  contextKey: "canonical",
  contextMode: "canonical",
} as const;

/** Adds the persisted content ID alias to one current graph identity. */
function withContentId(graph: ReturnType<typeof testArticleGraph>) {
  return { ...graph, content_id: graph.assetId };
}

/** Inserts one queue item consumed by the metrics application capability. */
async function insertQueueItem(
  ctx: MutationCtx,
  input: {
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
    description: material ? "Subject description" : "Article description",
    insertedAt: NOW,
    locale: "en",
    ...(material ? { materialDomain: "mathematics" as const } : {}),
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
    await runConvexProgram(
      applyContentAnalyticsBatch(ctx, { queueItems, updatedAt: NOW })
    );
    for (const item of queueItems) {
      await ctx.db.delete(item._id);
    }
  });
}

describe("contents/metrics/apply", () => {
  it("folds repeated current views into daily signals and window counters", async () => {
    const target = convexTest(schema, convexModules);
    await target.mutation(async (ctx) => {
      await insertQueueItem(ctx, { kind: "article", suffix: "article" });
      await insertQueueItem(ctx, { kind: "material", suffix: "subject-1" });
      await insertQueueItem(ctx, { kind: "material", suffix: "subject-2" });
    });

    await applyQueue(target);

    const state = await target.query(async (ctx) => ({
      counters: await ctx.db.query("learningPopularityCounters").collect(),
      signals: await ctx.db.query("learningPopularitySignals").collect(),
    }));
    const subjectCounter = state.counters.find(
      (row) =>
        row.section === "material" &&
        row.windowKey === getDefaultPopularityWindow()
    );
    const articleCounter = state.counters.find(
      (row) =>
        row.section === "articles" &&
        row.windowKey === getDefaultPopularityWindow()
    );
    const subjectSignal = state.signals.find(
      (row) => row.section === "material"
    );

    expect(articleCounter).toMatchObject({
      locale: "en",
      score: 1,
      section: "articles",
      scopeMode: "global",
      updatedAt: NOW,
    });
    expect(subjectCounter).toMatchObject({
      locale: "en",
      materialDomain: "mathematics",
      score: 2,
      section: "material",
      scopeMode: "global",
      updatedAt: NOW,
    });
    expect(subjectSignal).toMatchObject({
      applied: {
        d1: 2,
        d7: 2,
        d14: 2,
        d30: 2,
        d90: 2,
        d180: 2,
        d365: 2,
      },
      signalDay: getPopularitySignalDay(NOW),
      updatedAt: NOW,
      viewCount: 2,
    });

    await target.mutation((ctx) =>
      insertQueueItem(ctx, { kind: "material", suffix: "subject-3" })
    );
    await applyQueue(target);

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
      applied: {
        d1: 3,
        d7: 3,
        d14: 3,
        d30: 3,
        d90: 3,
        d180: 3,
        d365: 3,
      },
      viewCount: 3,
    });
  });

  it("keeps stale views out of finite windows while preserving lifetime", async () => {
    const target = convexTest(schema, convexModules);
    const staleViewedAt = NOW - 8 * POPULARITY_DAY_MS;
    await target.mutation((ctx) =>
      insertQueueItem(ctx, {
        kind: "material",
        suffix: "stale-subject",
        viewedAt: staleViewedAt,
      })
    );

    await applyQueue(target);

    const state = await target.query(async (ctx) => ({
      counters: await ctx.db.query("learningPopularityCounters").collect(),
      signal: await ctx.db.query("learningPopularitySignals").unique(),
    }));
    expect(
      state.counters.find(
        (row) => row.windowKey === getDefaultPopularityWindow()
      )
    ).toBeUndefined();
    expect(
      state.counters.find(
        (row) => row.windowKey === getLifetimePopularityWindow()
      )
    ).toMatchObject({ score: 1 });
    expect(state.signal).toMatchObject({
      applied: {
        d1: 0,
        d7: 0,
        d14: 1,
        d30: 1,
        d90: 1,
        d180: 1,
        d365: 1,
      },
      signalDay: getPopularitySignalDay(staleViewedAt),
      viewCount: 1,
    });
  });

  it("projects the newest payload from an out-of-order queue batch", async () => {
    const target = convexTest(schema, convexModules);
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

    const counters = await target.query(
      async (ctx) => await ctx.db.query("learningPopularityCounters").collect()
    );
    expect(
      counters
        .filter(
          ({ windowKey }) => windowKey === "7d" || windowKey === "lifetime"
        )
        .map(({ contextMode, latestDay, route, score, title, windowKey }) => ({
          contextMode,
          latestDay,
          route,
          score,
          title,
          windowKey,
        }))
    ).toEqual([
      {
        contextMode: "canonical",
        latestDay: NOW,
        route: "material/newest-vector",
        score: 2,
        title: "Newest Vector Addition",
        windowKey: "7d",
      },
      {
        contextMode: "canonical",
        latestDay: NOW,
        route: "material/newest-vector",
        score: 2,
        title: "Newest Vector Addition",
        windowKey: "lifetime",
      },
    ]);
  });

  it("preserves newer finite and lifetime payloads while accepting late events", async () => {
    const target = convexTest(schema, convexModules);
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
        applied: {
          d1: 5,
          d7: 5,
          d14: 5,
          d30: 5,
          d90: 5,
          d180: 5,
          d365: 5,
        },
        signalDay: NOW,
        viewCount: 5,
      });
      await ctx.db.insert("learningPopularitySignals", {
        ...base,
        applied: {
          d1: 0,
          d7: 1,
          d14: 1,
          d30: 1,
          d90: 1,
          d180: 1,
          d365: 1,
        },
        route: "material/older-vector",
        signalDay: lateDay,
        title: "Older Vector Addition",
        viewCount: 1,
      });
      for (const windowKey of ["7d", "lifetime"] as const) {
        await ctx.db.insert("learningPopularityCounters", {
          ...base,
          latestDay: NOW,
          score: 6,
          windowKey,
        });
      }
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

    const repaired = await target.query(
      async (ctx) => await ctx.db.query("learningPopularityCounters").collect()
    );
    expect(
      repaired
        .filter(
          ({ windowKey }) => windowKey === "7d" || windowKey === "lifetime"
        )
        .map(({ contextMode, latestDay, route, score, title, windowKey }) => ({
          contextMode,
          latestDay,
          route,
          score,
          title,
          windowKey,
        }))
    ).toEqual([
      {
        contextMode: "canonical",
        latestDay: NOW,
        route: "material/current-vector",
        score: 7,
        title: "Newest Vector Addition",
        windowKey: "7d",
      },
      {
        contextMode: "canonical",
        latestDay: NOW,
        route: "material/current-vector",
        score: 7,
        title: "Newest Vector Addition",
        windowKey: "lifetime",
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

    const stable = await target.query(
      async (ctx) => await ctx.db.query("learningPopularityCounters").collect()
    );
    expect(
      stable
        .filter(
          ({ windowKey }) => windowKey === "7d" || windowKey === "lifetime"
        )
        .map(({ contextMode, latestDay, route, score, title, windowKey }) => ({
          contextMode,
          latestDay,
          route,
          score,
          title,
          windowKey,
        }))
    ).toEqual([
      {
        contextMode: "canonical",
        latestDay: NOW,
        route: "material/current-vector",
        score: 8,
        title: "Newest Vector Addition",
        windowKey: "7d",
      },
      {
        contextMode: "canonical",
        latestDay: NOW,
        route: "material/current-vector",
        score: 8,
        title: "Newest Vector Addition",
        windowKey: "lifetime",
      },
    ]);
  });
});
