import { afterEach, beforeEach, describe, expect, it } from "@effect/vitest";
import {
  getPopularitySignalDay,
  POPULARITY_DAY_MS,
  POPULARITY_SCOPE,
  POPULARITY_WINDOW,
  POPULARITY_WINDOW_DAYS,
} from "@repo/backend/confect/contents/popularity";
import { learningPopularityRankings } from "@repo/backend/confect/contents/rankings";
import { registerLearningPopularityAggregate } from "@repo/backend/confect/test.helpers";
import { convexModules } from "@repo/backend/confect/test.setup";
import { internal } from "@repo/backend/convex/_generated/api";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import schema from "@repo/backend/convex/schema";
import { testMaterialGraph } from "@repo/backend/test/content/material";
import { convexTest, type TestConvex } from "convex-test";
import { Array as Arr } from "effect";

const NOW = Date.parse("2026-01-08T12:00:00.000Z");
const SUBJECT_ROUTE = "material/lesson/mathematics/vector/addition";
const OUTGOING_OFFSET = POPULARITY_WINDOW_DAYS;

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
  day: number
) {
  return await target.mutation(async (ctx) => {
    const result = await ctx.runMutation(
      internal.contents.mutations.popularity
        .refreshLearningPopularityWindowPage,
      {
        day,
        scopeMode: POPULARITY_SCOPE,
        windowKey: POPULARITY_WINDOW,
      }
    );
    const metrics = await ctx.meta.getTransactionMetrics();

    return { metrics, result };
  });
}

/** Runs one incremental expiry page and exposes its transaction cost. */
async function runExpiry(
  target: ReturnType<typeof createPopularityConvexTest>,
  day: number
) {
  return await target.mutation(async (ctx) => {
    const result = await ctx.runMutation(
      internal.contents.mutations.popularity.expireLearningPopularityWindowPage,
      {
        day,
        scopeMode: POPULARITY_SCOPE,
        windowKey: POPULARITY_WINDOW,
      }
    );
    const metrics = await ctx.meta.getTransactionMetrics();

    return { metrics, result };
  });
}

/**
 * Seeds one identity with a signal for every day of the window and for the day
 * leaving it, immediately before the requested maintenance. The outgoing day
 * was processed late: two views, only one of them applied to the counter.
 */
async function insertBoundedHistory(
  ctx: MutationCtx,
  day: number,
  mode: "expiry" | "repair"
) {
  const subject = withContentId(
    testMaterialGraph("vector", "addition", "en", "mathematics")
  );
  let score = 0;

  for (let offset = 0; offset <= OUTGOING_OFFSET; offset += 1) {
    const viewCount = offset === OUTGOING_OFFSET ? 2 : 1;
    const applied = offset === OUTGOING_OFFSET ? 1 : viewCount;
    score += applied;
    await ctx.db.insert("learningPopularitySignals", {
      ...subject,
      applied: { d7: applied },
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

  const id = await ctx.db.insert("learningPopularityCounters", {
    ...subject,
    contextKey: "canonical",
    contextMode: "canonical",
    description: "Current subject description",
    latestDay: day,
    locale: "en",
    materialDomain: "mathematics",
    route: SUBJECT_ROUTE,
    score,
    section: "material",
    scopeMode: "global",
    sourcePath: SUBJECT_ROUTE,
    title: "Current Vector Addition",
    updatedAt: day - POPULARITY_DAY_MS,
    windowKey: POPULARITY_WINDOW,
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
    windowKey: POPULARITY_WINDOW,
  });
}

/** Reads the counter and its aggregate sort key without database-specific IDs. */
async function readBoundedState(target: TestConvex<typeof schema>) {
  return await target.query(async (ctx) => {
    const counters = await ctx.db.query("learningPopularityCounters").collect();
    const ranking = await learningPopularityRankings.paginate(ctx, {
      namespace: ["material", "en", "global", POPULARITY_WINDOW],
      order: "asc",
      pageSize: 10,
    });

    return {
      counters: Arr.map(
        counters,
        ({ _creationTime, _id, ...counter }) => counter
      ),
      ranking: Arr.map(ranking.page, (item) => item.key),
    };
  });
}

describe("contents/metrics/refresh", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("matches full payload repair after one bounded late-event read", async () => {
    const expiry = createPopularityConvexTest();
    const repair = createPopularityConvexTest();
    const day = getPopularitySignalDay(NOW);

    await expiry.mutation((ctx) => insertBoundedHistory(ctx, day, "expiry"));
    await repair.mutation((ctx) => insertBoundedHistory(ctx, day, "repair"));

    const expired = await runExpiry(expiry, day);
    const rebuilt = await runRefresh(repair, day);

    expect(await readBoundedState(expiry)).toEqual(
      await readBoundedState(repair)
    );
    // Aggregate 0.3 checks its async queue once per synchronous counter write.
    // Domain-owned ranking updates reuse loaded counters, removing two reads
    // per write that the generic trigger previously needed. Completing the
    // page only updates the cycle watermark. The same fixture with seven
    // windows and a 366 day history read 105 documents to expire and 792 to
    // repair.
    expect({
      databaseQueries: expired.metrics.databaseQueries.used,
      documentsRead: expired.metrics.documentsRead.used,
      documentsWritten: expired.metrics.documentsWritten.used,
    }).toEqual({
      databaseQueries: 12,
      documentsRead: 15,
      documentsWritten: 4,
    });
    expect({
      databaseQueries: rebuilt.metrics.databaseQueries.used,
      documentsRead: rebuilt.metrics.documentsRead.used,
      documentsWritten: rebuilt.metrics.documentsWritten.used,
    }).toEqual({
      databaseQueries: 12,
      documentsRead: 21,
      documentsWritten: 4,
    });
  });
});
