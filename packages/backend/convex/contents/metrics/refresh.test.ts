import { afterEach, beforeEach, describe, expect, it } from "@effect/vitest";
import { internal } from "@repo/backend/convex/_generated/api";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import { getAppliedCount } from "@repo/backend/convex/contents/metrics/signal";
import {
  getFinitePopularityWindows,
  getPopularitySignalDay,
  getPopularityWindowDayCount,
  type LearningPopularityFiniteWindow,
  POPULARITY_DAY_MS,
} from "@repo/backend/convex/contents/popularity";
import { learningPopularityRankings } from "@repo/backend/convex/contents/rankings";
import schema from "@repo/backend/convex/schema";
import { registerLearningPopularityAggregate } from "@repo/backend/convex/test.helpers";
import { convexModules } from "@repo/backend/convex/test.setup";
import { testMaterialGraph } from "@repo/backend/test/content/material";
import { convexTest, type TestConvex } from "convex-test";

const NOW = Date.parse("2026-01-08T12:00:00.000Z");
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

/** Adds the persisted content ID alias to a material graph identity. */
function withContentId(graph: ReturnType<typeof testMaterialGraph>) {
  return { ...graph, content_id: graph.assetId };
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

/** Runs one incremental expiry page and exposes its transaction cost. */
async function runExpiry(
  target: ReturnType<typeof createPopularityConvexTest>,
  day: number,
  windowKey: LearningPopularityFiniteWindow
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
  let lifetimeScore = 0;

  for (let offset = 0; offset <= 365; offset += 1) {
    const viewCount = boundaries.has(offset) ? 2 : 1;
    lifetimeScore += viewCount;
    const applied = appliedAt(offset, viewCount);
    for (const windowKey of getFinitePopularityWindows()) {
      scores[windowKey] += getAppliedCount(applied, windowKey);
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

  for (const windowKey of [
    ...getFinitePopularityWindows(),
    "lifetime",
  ] as const) {
    const id = await ctx.db.insert("learningPopularityCounters", {
      ...subject,
      contextKey: "canonical",
      contextMode: "canonical",
      description: "Current subject description",
      latestDay: day,
      locale: "en",
      materialDomain: "mathematics",
      route: SUBJECT_ROUTE,
      score: windowKey === "lifetime" ? lifetimeScore : scores[windowKey],
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
    if (windowKey === "lifetime") {
      continue;
    }
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

describe("contents/metrics/refresh", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(NOW));
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
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
      databaseQueries: 126,
      documentsRead: 153,
      documentsWritten: 28,
    });
    expect(repairMetrics).toEqual({
      databaseQueries: 133,
      documentsRead: 840,
      documentsWritten: 28,
    });
  });
});
