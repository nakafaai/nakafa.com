import { afterEach, beforeEach, describe, expect, it } from "@effect/vitest";
import { internal } from "@repo/backend/convex/_generated/api";
import type { Doc } from "@repo/backend/convex/_generated/dataModel";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import {
  getFinitePopularityWindows,
  getPopularitySignalDay,
  getPopularityWindowDayCount,
  POPULARITY_DAY_MS,
} from "@repo/backend/convex/contents/popularity";
import { learningPopularityRankings } from "@repo/backend/convex/contents/rankings";
import schema from "@repo/backend/convex/schema";
import { registerLearningPopularityAggregate } from "@repo/backend/convex/test.helpers";
import { convexModules } from "@repo/backend/convex/test.setup";
import { testMaterialGraph } from "@repo/backend/test/content/material";
import { testArticleGraph } from "@repo/backend/test/content/release";
import { convexTest, type TestConvex } from "convex-test";

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
    "1d": count(1),
    "7d": count(7),
    "14d": count(14),
    "30d": count(30),
    "90d": count(90),
    "180d": count(180),
    "365d": count(365),
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
    readonly windowKey?: Doc<"learningPopularityCounters">["windowKey"];
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

/** Runs one incremental expiry page and exposes its transaction cost. */
async function runExpiry(
  target: ReturnType<typeof createPopularityConvexTest>,
  day: number,
  windowKey: Doc<"learningPopularityCounters">["windowKey"]
) {
  return await target.mutation(async (ctx) => {
    const result = await ctx.runMutation(
      internal.contents.mutations.popularity.expireLearningPopularityWindowPage,
      {
        day,
        scopeMode: "global",
        windowKey,
      }
    );
    const metrics = await ctx.meta.getTransactionMetrics();

    return { metrics, result };
  });
}

/** Seeds one full-history identity immediately before the requested expiry. */
async function insertBoundedHistory(
  ctx: MutationCtx,
  day: number,
  mode: "expiry" | "repair"
) {
  const subject = withContentId(
    testMaterialGraph("vector", "addition", "en", "mathematics")
  );
  const scores = {
    "1d": 0,
    "7d": 0,
    "14d": 0,
    "30d": 0,
    "90d": 0,
    "180d": 0,
    "365d": 0,
  };
  const boundaries = new Set(
    getFinitePopularityWindows().map(getPopularityWindowDayCount)
  );

  for (let offset = 0; offset <= 365; offset += 1) {
    const viewCount = boundaries.has(offset) ? 2 : 1;
    const applied = appliedAt(offset, viewCount);
    for (const windowKey of getFinitePopularityWindows()) {
      scores[windowKey] += applied[windowKey];
    }
    await ctx.db.insert("learningPopularitySignals", {
      ...subject,
      applied,
      contextKey: "canonical",
      contextMode: offset === 0 ? "canonical" : "placement",
      description:
        offset === 0 ? "Current subject description" : "Earlier description",
      locale: "en",
      materialDomain: "mathematics",
      route: offset === 0 ? SUBJECT_ROUTE : "material/earlier-vector",
      scopeMode: "global",
      section: "material",
      signalDay: day - offset * POPULARITY_DAY_MS,
      sourcePath: SUBJECT_ROUTE,
      title: offset === 0 ? "Current Vector Addition" : "Earlier Vector",
      updatedAt: day,
      viewCount,
    });
  }

  for (const windowKey of getFinitePopularityWindows()) {
    const id = await ctx.db.insert("learningPopularityCounters", {
      ...subject,
      contextKey: "canonical",
      contextMode: "canonical",
      description: "Current subject description",
      latestDay: day,
      locale: "en",
      materialDomain: "mathematics",
      route: SUBJECT_ROUTE,
      score: scores[windowKey],
      section: "material",
      scopeMode: "global",
      sourcePath: SUBJECT_ROUTE,
      title: "Current Vector Addition",
      updatedAt: day - POPULARITY_DAY_MS,
      windowKey,
    });
    const counter = await ctx.db.get(id);
    if (!counter) {
      throw new Error("Expected the bounded popularity counter fixture.");
    }
    await learningPopularityRankings.insert(ctx, counter);
    await ctx.db.insert("learningPopularityCycles", {
      completedDay: day - POPULARITY_DAY_MS,
      mode,
      scopeMode: "global",
      startedDay: day,
      windowKey,
    });
  }
}

/** Reads counter values and aggregate sort keys without database-specific IDs. */
async function readBoundedState(target: TestConvex<typeof schema>) {
  return await target.query(async (ctx) => {
    const counters = await ctx.db.query("learningPopularityCounters").collect();
    const rankings = await Promise.all(
      getFinitePopularityWindows().map(async (windowKey) => {
        const ranking = await learningPopularityRankings.paginate(ctx, {
          namespace: ["material", "en", "global", windowKey],
          order: "asc",
          pageSize: 10,
        });
        return {
          keys: ranking.page.map((item) => item.key),
          windowKey,
        };
      })
    );

    return {
      counters: counters
        .map(({ _creationTime, _id, ...counter }) => counter)
        .sort((left, right) => left.windowKey.localeCompare(right.windowKey)),
      rankings,
    };
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
        [{ scopeMode: "global", windowKey: "1d" }],
        [{ scopeMode: "global", windowKey: "365d" }],
        [{ scopeMode: "placement", windowKey: "1d" }],
        [{ scopeMode: "placement", windowKey: "365d" }],
      ])
    );
    expect(jobs).toHaveLength(14);
  });

  it("repairs finite windows from daily signals and removes expired counters", async () => {
    const t = createPopularityConvexTest();

    await t.mutation(insertPopularityRefreshRows);

    const refresh = await runRefresh(t);
    const counters = await t.query(
      async (ctx) => await ctx.db.query("learningPopularityCounters").collect()
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

  it("matches full payload repair after seven bounded late-event reads", async () => {
    const expiry = createPopularityConvexTest();
    const repair = createPopularityConvexTest();
    const day = getPopularitySignalDay(NOW);

    await expiry.mutation((ctx) => insertBoundedHistory(ctx, day, "expiry"));
    await repair.mutation((ctx) => insertBoundedHistory(ctx, day, "repair"));

    const expiryMetrics = {
      databaseQueries: 0,
      documentsRead: 0,
      documentsWritten: 0,
    };
    const repairMetrics = {
      databaseQueries: 0,
      documentsRead: 0,
      documentsWritten: 0,
    };

    for (const windowKey of getFinitePopularityWindows()) {
      const expired = await runExpiry(expiry, day, windowKey);
      const rebuilt = await runRefresh(repair, { day, windowKey });

      expiryMetrics.databaseQueries += expired.metrics.databaseQueries.used;
      expiryMetrics.documentsRead += expired.metrics.documentsRead.used;
      expiryMetrics.documentsWritten += expired.metrics.documentsWritten.used;
      repairMetrics.databaseQueries += rebuilt.metrics.databaseQueries.used;
      repairMetrics.documentsRead += rebuilt.metrics.documentsRead.used;
      repairMetrics.documentsWritten += rebuilt.metrics.documentsWritten.used;
    }

    expect(await readBoundedState(expiry)).toEqual(
      await readBoundedState(repair)
    );
    expect(expiryMetrics).toEqual({
      databaseQueries: 91,
      documentsRead: 119,
      documentsWritten: 28,
    });
    expect(repairMetrics).toEqual({
      databaseQueries: 91,
      documentsRead: 799,
      documentsWritten: 28,
    });
  });
});
