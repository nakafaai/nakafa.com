import { afterEach, beforeEach, describe, expect, it } from "@effect/vitest";
import { internal } from "@repo/backend/convex/_generated/api";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import {
  getPopularitySignalDay,
  type LearningPopularityFiniteWindow,
  POPULARITY_DAY_MS,
} from "@repo/backend/convex/contents/popularity";
import { learningPopularityRankings } from "@repo/backend/convex/contents/rankings";
import schema from "@repo/backend/convex/schema";
import { registerLearningPopularityAggregate } from "@repo/backend/convex/test.helpers";
import { convexModules } from "@repo/backend/convex/test.setup";
import { testMaterialGraph } from "@repo/backend/test/content/material";
import { testArticleGraph } from "@repo/backend/test/content/release";
import { convexTest } from "convex-test";

const NOW = Date.parse("2026-01-08T12:00:00.000Z");
const ARTICLE_ROUTE = "articles/politics/dynastic-politics-asian-values";
const SUBJECT_ROUTE = "material/lesson/mathematics/vector/addition";

/** Models one late outgoing view without charging a window that excluded it. */
function appliedAt(offset: number, viewCount: number) {
  const count = (days: number) => {
    if (offset < days) {
      return viewCount;
    }
    return offset === days ? 1 : 0;
  };
  return {
    d1: count(1),
    d7: count(7),
    d14: count(14),
    d30: count(30),
    d90: count(90),
    d180: count(180),
    d365: count(365),
  };
}

/** Builds a Convex test instance with production popularity triggers enabled. */
function createPopularityConvexTest() {
  const t = convexTest(schema, convexModules);
  registerLearningPopularityAggregate(t);
  return t;
}

/** Adds the persisted content ID alias to one current graph identity. */
function withContentId(graph: ReturnType<typeof testArticleGraph>) {
  return {
    ...graph,
    content_id: graph.assetId,
  };
}

/** Inserts the stale and current popularity rows used by refresh behavior tests. */
async function insertPopularityRefreshRows(ctx: MutationCtx) {
  const article = withContentId(
    testArticleGraph("dynastic-politics-asian-values")
  );
  const subject = withContentId(
    testMaterialGraph("vector", "addition", "en", "mathematics")
  );
  const currentSignalDay = getPopularitySignalDay(NOW);
  const expiredSignalDay = currentSignalDay - 8 * POPULARITY_DAY_MS;

  const subjectCounterId = await ctx.db.insert("learningPopularityCounters", {
    ...subject,
    alignmentId: "stale-alignment",
    assetId: "stale-asset",
    conceptId: "stale-concept",
    contextKey: "placement:mathematics:addition",
    contextMaterialKey: "stale-material",
    contextMode: "canonical",
    contextNodeKey: "stale-node",
    contextParentPath: "stale/parent",
    contextProgramKey: "stale-program",
    contextPublicPath: "stale/public",
    contextSourcePath: "stale/source",
    description: "Stale subject description",
    learningObjectId: "stale-learning-object",
    lensId: "stale-lens",
    latestDay: currentSignalDay,
    locale: "en",
    materialDomain: "physics",
    route: "stale/subject/route",
    score: 2,
    section: "material",
    scopeMode: "global",
    sourcePath: "stale/subject/source",
    title: "Stale Vector Addition",
    updatedAt: NOW - POPULARITY_DAY_MS,
    windowKey: "7d",
  });
  const articleCounterId = await ctx.db.insert("learningPopularityCounters", {
    ...article,
    contextKey: "canonical",
    contextMode: "canonical",
    description: "Expired article description",
    latestDay: expiredSignalDay,
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
  for (const counter of [subjectCounter, articleCounter]) {
    const { _id, _creationTime, ...value } = counter;
    const id = await ctx.db.insert("learningPopularityCounters", {
      ...value,
      windowKey: "lifetime",
    });
    const lifetime = await ctx.db.get(id);
    if (!lifetime) {
      throw new Error("Expected the durable popularity identity fixture.");
    }
    await learningPopularityRankings.insert(ctx, lifetime);
  }

  await ctx.db.insert("learningPopularitySignals", {
    ...subject,
    applied: appliedAt(0, 2),
    contextKey: "placement:mathematics:addition",
    contextMaterialKey: "vector-addition",
    contextMode: "placement",
    contextNodeKey: "addition",
    contextParentPath: "subjects/mathematics/vector",
    contextProgramKey: "mathematics",
    contextPublicPath: SUBJECT_ROUTE,
    contextSourcePath: "material/lesson/mathematics/vector/addition",
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
    applied: appliedAt(8, 5),
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
  await ctx.db.insert("learningPopularityCycles", {
    mode: "repair",
    scopeMode: "global",
    startedDay: currentSignalDay,
    windowKey: "7d",
  });
}

/** Reads stored counters and their aggregate ranking output together. */
async function readPopularitySnapshot(
  target: ReturnType<typeof createPopularityConvexTest>
) {
  return await target.query(async (ctx) => {
    const counters = await ctx.db.query("learningPopularityCounters").collect();
    const ranking = await learningPopularityRankings.paginate(ctx, {
      namespace: ["material", "en", "global", "7d"],
      order: "asc",
      pageSize: 10,
    });

    return {
      counters,
      ranking: ranking.page,
    };
  });
}

/** Runs the registered refresh interface and exposes its transaction cost. */
async function runRefresh(
  target: ReturnType<typeof createPopularityConvexTest>,
  input: {
    readonly day?: number;
    readonly windowKey?: LearningPopularityFiniteWindow;
  } = {}
) {
  return await target.mutation(async (ctx) => {
    const result = await ctx.runMutation(
      internal.contents.mutations.popularity
        .refreshLearningPopularityWindowPage,
      {
        day: input.day ?? getPopularitySignalDay(NOW),
        scopeMode: "global",
        windowKey: input.windowKey ?? "7d",
      }
    );
    const metrics = await ctx.meta.getTransactionMetrics();

    return { metrics, result };
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

  it("schedules every finite window for both popularity scopes", async () => {
    const t = createPopularityConvexTest();
    const day = getPopularitySignalDay(NOW);

    const result = await t.mutation(
      internal.contents.mutations.popularity
        .scheduleLearningPopularityRefreshes,
      {}
    );
    const jobs = await t.query(
      async (ctx) => await ctx.db.system.query("_scheduled_functions").collect()
    );

    expect(result).toEqual({ scheduledWindows: 14 });
    expect(jobs.map((job) => job.args)).toEqual(
      expect.arrayContaining([
        [{ day, scopeMode: "global", windowKey: "1d" }],
        [{ day, scopeMode: "global", windowKey: "365d" }],
        [{ day, scopeMode: "placement", windowKey: "1d" }],
        [{ day, scopeMode: "placement", windowKey: "365d" }],
      ])
    );
    expect(jobs).toHaveLength(14);
  });

  it("repairs finite windows from daily signals and removes expired counters", async () => {
    const t = createPopularityConvexTest();

    await t.mutation(insertPopularityRefreshRows);

    const refresh = await runRefresh(t);
    const counters = await t.query(
      async (ctx) =>
        await ctx.db
          .query("learningPopularityCounters")
          .withIndex(
            "by_windowKey_and_scopeMode_and_content_id_and_contextKey",
            (q) => q.eq("windowKey", "7d")
          )
          .collect()
    );
    const subject = withContentId(
      testMaterialGraph("vector", "addition", "en", "mathematics")
    );

    expect(refresh.result).toEqual({
      continueCursor: expect.any(String),
      isDone: true,
      refreshedCounters: 1,
      removedCounters: 1,
      skipped: false,
    });
    expect(counters).toHaveLength(1);
    expect(counters[0]).toMatchObject({
      alignmentId: subject.alignmentId,
      assetId: subject.assetId,
      conceptId: subject.conceptId,
      contextKey: "placement:mathematics:addition",
      contextMaterialKey: "vector-addition",
      contextMode: "placement",
      contextNodeKey: "addition",
      contextParentPath: "subjects/mathematics/vector",
      contextProgramKey: "mathematics",
      contextPublicPath: SUBJECT_ROUTE,
      contextSourcePath: "material/lesson/mathematics/vector/addition",
      description: "Current subject description",
      learningObjectId: subject.learningObjectId,
      lensId: subject.lensId,
      materialDomain: "mathematics",
      route: SUBJECT_ROUTE,
      score: 2,
      sourcePath: SUBJECT_ROUTE,
      title: "Current Vector Addition",
      updatedAt: NOW,
    });
  });

  it("does not rewrite or rerank an unchanged rebuilt counter", async () => {
    const t = createPopularityConvexTest();

    await t.mutation(insertPopularityRefreshRows);
    const repair = await runRefresh(t);
    const before = await readPopularitySnapshot(t);

    const nextDay = getPopularitySignalDay(NOW) + POPULARITY_DAY_MS;
    vi.setSystemTime(new Date(nextDay));
    await t.mutation(
      internal.contents.mutations.popularity
        .scheduleLearningPopularityRefreshes,
      {}
    );
    const replay = await runRefresh(t, { day: nextDay });
    const after = await readPopularitySnapshot(t);

    expect(repair.metrics.documentsWritten.used).toBeGreaterThan(0);
    expect(replay.result).toEqual({
      continueCursor: expect.any(String),
      isDone: true,
      refreshedCounters: 0,
      removedCounters: 0,
      skipped: false,
    });
    expect(replay.metrics.documentsWritten.used).toBe(1);
    expect(after).toEqual(before);
  });
});
