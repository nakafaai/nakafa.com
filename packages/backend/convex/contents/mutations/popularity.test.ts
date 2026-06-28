import { internal } from "@repo/backend/convex/_generated/api";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import {
  getPopularitySignalDay,
  POPULARITY_DAY_MS,
} from "@repo/backend/convex/contents/popularity";
import { learningPopularityRankings } from "@repo/backend/convex/contents/rankings";
import schema from "@repo/backend/convex/schema";
import { registerLearningPopularityAggregate } from "@repo/backend/convex/test.helpers";
import { convexModules } from "@repo/backend/convex/test.setup";
import { createLearningGraphIdentityFromRoute } from "@repo/contents/_types/learning-graph";
import { convexTest } from "convex-test";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const NOW = Date.parse("2026-01-08T12:00:00.000Z");
const ARTICLE_ROUTE = "articles/politics/dynastic-politics-asian-values";
const SUBJECT_ROUTE = "material/lesson/mathematics/vector/addition";

/** Builds a Convex test instance with production popularity triggers enabled. */
function createPopularityConvexTest() {
  const t = convexTest(schema, convexModules);
  registerLearningPopularityAggregate(t);
  return t;
}

/** Builds a graph identity fixture and fails fast when the route is invalid. */
function getGraph(route: string) {
  const graph = createLearningGraphIdentityFromRoute({
    locale: "en",
    route,
  });

  if (!graph) {
    throw new Error(`Expected graph identity for ${route}.`);
  }

  return {
    ...graph,
    content_id: graph.assetId,
  };
}

/** Inserts the stale and current popularity rows used by refresh behavior tests. */
async function insertPopularityRefreshRows(ctx: MutationCtx) {
  const article = getGraph(ARTICLE_ROUTE);
  const subject = getGraph(SUBJECT_ROUTE);
  const currentSignalDay = getPopularitySignalDay(NOW);
  const expiredSignalDay = currentSignalDay - 8 * POPULARITY_DAY_MS;

  const subjectCounterId = await ctx.db.insert("learningPopularityCounters", {
    ...subject,
    contextKey: "canonical",
    contextMode: "canonical",
    description: "Stale subject description",
    locale: "en",
    materialDomain: "mathematics",
    route: SUBJECT_ROUTE,
    score: 99,
    section: "material",
    scopeMode: "global",
    sourcePath: SUBJECT_ROUTE,
    title: "Stale Vector Addition",
    updatedAt: NOW - POPULARITY_DAY_MS,
    windowKey: "7d",
  });
  const articleCounterId = await ctx.db.insert("learningPopularityCounters", {
    ...article,
    contextKey: "canonical",
    contextMode: "canonical",
    description: "Expired article description",
    locale: "en",
    route: ARTICLE_ROUTE,
    score: 5,
    section: "articles",
    scopeMode: "global",
    sourcePath: ARTICLE_ROUTE,
    title: "Expired Dynastic Politics",
    updatedAt: NOW - POPULARITY_DAY_MS,
    windowKey: "7d",
  });
  const subjectCounter = await ctx.db.get(subjectCounterId);
  const articleCounter = await ctx.db.get(articleCounterId);

  if (!(subjectCounter && articleCounter)) {
    throw new Error(
      "Expected popularity counters to exist for aggregate setup."
    );
  }

  await learningPopularityRankings.insert(ctx, subjectCounter);
  await learningPopularityRankings.insert(ctx, articleCounter);

  await ctx.db.insert("learningPopularitySignals", {
    ...subject,
    contextKey: "canonical",
    contextMode: "canonical",
    description: "Current subject description",
    locale: "en",
    materialDomain: "mathematics",
    route: SUBJECT_ROUTE,
    scopeMode: "global",
    section: "material",
    signalDay: currentSignalDay,
    sourcePath: SUBJECT_ROUTE,
    title: "Current Vector Addition",
    updatedAt: NOW,
    viewCount: 2,
  });
  await ctx.db.insert("learningPopularitySignals", {
    ...article,
    contextKey: "canonical",
    contextMode: "canonical",
    description: "Old article description",
    locale: "en",
    route: ARTICLE_ROUTE,
    scopeMode: "global",
    section: "articles",
    signalDay: expiredSignalDay,
    sourcePath: ARTICLE_ROUTE,
    title: "Old Dynastic Politics",
    updatedAt: NOW - 8 * POPULARITY_DAY_MS,
    viewCount: 5,
  });
}

describe("contents/mutations/popularity", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(NOW));
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("rebuilds finite windows from daily signals and removes expired counters", async () => {
    const t = createPopularityConvexTest();

    await t.mutation(insertPopularityRefreshRows);

    const result = await t.mutation(
      internal.contents.mutations.popularity
        .refreshLearningPopularityWindowPage,
      {
        scopeMode: "global",
        windowKey: "7d",
      }
    );
    const counters = await t.query(
      async (ctx) => await ctx.db.query("learningPopularityCounters").collect()
    );

    expect(result).toEqual({
      continueCursor: expect.any(String),
      isDone: true,
      refreshedCounters: 1,
      removedCounters: 1,
      skipped: false,
    });
    expect(counters).toHaveLength(1);
    expect(counters[0]).toMatchObject({
      route: SUBJECT_ROUTE,
      score: 2,
      title: "Current Vector Addition",
    });
  });
});
