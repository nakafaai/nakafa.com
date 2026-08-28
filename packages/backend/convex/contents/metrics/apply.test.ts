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
    readonly kind: "article" | "material";
    readonly suffix: string;
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
    description: material ? "Subject description" : "Article description",
    insertedAt: NOW,
    locale: "en",
    ...(material ? { materialDomain: "mathematics" as const } : {}),
    partition: 0,
    route,
    section: material ? "material" : "articles",
    scopeMode: "global",
    sourcePath: route,
    title: material ? "Vector Addition" : "Dynastic Politics",
    viewerKey: `device:${input.suffix}`,
    viewedAt: input.viewedAt ?? NOW,
  });
}

/** Applies every queued fixture row to the derived metric tables. */
function applyQueue(target: TestConvex<typeof schema>) {
  return target.mutation(async (ctx) => {
    const queueItems = await ctx.db.query("learningEngagementQueue").collect();
    return await runConvexProgram(
      applyContentAnalyticsBatch(ctx, { queueItems, updatedAt: NOW })
    );
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
      signalDay: getPopularitySignalDay(NOW),
      updatedAt: NOW,
      viewCount: 2,
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
      signalDay: getPopularitySignalDay(staleViewedAt),
      viewCount: 1,
    });
  });
});
