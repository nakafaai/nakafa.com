import { afterEach, describe, expect, it } from "@effect/vitest";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import {
  buildMetricsBatch,
  type PopularityCounterDelta,
} from "@repo/backend/convex/contents/metrics/batch";
import { applyPopularityCounter } from "@repo/backend/convex/contents/metrics/counter";
import { learningPopularityRankings } from "@repo/backend/convex/contents/rankings";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import schema from "@repo/backend/convex/schema";
import { convexModules } from "@repo/backend/convex/test.setup";
import { testMaterialGraph } from "@repo/backend/test/content/material";
import { convexTest } from "convex-test";
import { Effect } from "effect";

const NOW = Date.parse("2026-01-01T00:00:00.000Z");
const ROUTE = "material/lesson/mathematics/vector/addition";
const graph = (() => {
  const value = testMaterialGraph("vector", "addition", "en", "mathematics");
  return { ...value, content_id: value.assetId };
})();

/** Inserts one current counter for a deliberate uniqueness violation. */
function insertCounter(
  ctx: MutationCtx,
  contextKey: string,
  windowKey: PopularityCounterDelta["windowKey"]
) {
  return ctx.db.insert("learningPopularityCounters", {
    ...graph,
    contextKey,
    contextMode: "canonical",
    description: "Subject description",
    latestDay: NOW,
    locale: "en",
    materialDomain: "mathematics",
    route: ROUTE,
    score: 1,
    section: "material",
    scopeMode: "global",
    sourcePath: ROUTE,
    title: "Vector Addition",
    updatedAt: NOW,
    windowKey,
  });
}

/** Inserts one new view used to advance every configured counter. */
function insertQueue(ctx: MutationCtx, contextKey: string, suffix: string) {
  return ctx.db.insert("learningEngagementQueue", {
    ...graph,
    contextKey,
    contextMode: "canonical",
    description: "Newest subject description",
    insertedAt: NOW,
    locale: "en",
    materialDomain: "mathematics",
    partition: 0,
    route: "material/newest-vector",
    section: "material",
    scopeMode: "global",
    sourcePath: ROUTE,
    title: "Newest Vector Addition",
    viewerKey: `device:${suffix}`,
    viewedAt: NOW,
  });
}

/** Converts one counter Effect result into a Convex-serializable failure. */
function captureCounter(ctx: MutationCtx, counter: PopularityCounterDelta) {
  return runConvexProgram(
    applyPopularityCounter(ctx, { ...counter, updatedAt: NOW }).pipe(
      Effect.match({
        onFailure: ({ _tag, code, message }) => ({ _tag, code, message }),
        onSuccess: () => null,
      })
    )
  );
}

describe("contents/metrics/counter", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("rolls back the counter when its transactional ranking write fails", async () => {
    const target = convexTest(schema, convexModules);
    vi.spyOn(learningPopularityRankings, "insert").mockRejectedValueOnce(
      new Error("Ranking unavailable")
    );

    await expect(
      target.mutation(async (ctx) => {
        const queueId = await insertQueue(ctx, "rollback", "rollback");
        const queueItem = await ctx.db.get("learningEngagementQueue", queueId);
        if (!queueItem) {
          throw new Error("Expected the ranking rollback queue fixture.");
        }
        const counter = [
          ...buildMetricsBatch({
            queueItems: [queueItem],
            updatedAt: NOW,
          }).counters.values(),
        ][0];
        if (!counter) {
          throw new Error("Expected the ranking rollback counter delta.");
        }
        await runConvexProgram(
          applyPopularityCounter(ctx, { ...counter, updatedAt: NOW })
        );
      })
    ).rejects.toThrow("CONTENT_ANALYTICS_IO_FAILED");

    const counters = await target.query((ctx) =>
      ctx.db.query("learningPopularityCounters").take(1)
    );
    expect(counters).toEqual([]);
  });

  it("maps a duplicate indexed counter read into the typed IO failure", async () => {
    const target = convexTest(schema, convexModules);

    const failure = await target.mutation(async (ctx) => {
      await insertCounter(ctx, "duplicate", "lifetime");
      await insertCounter(ctx, "duplicate", "lifetime");
      const queueId = await insertQueue(ctx, "duplicate", "duplicate");
      const queueItem = await ctx.db.get(queueId);
      if (!queueItem) {
        throw new Error("Expected the duplicate-counter queue fixture.");
      }
      const counter = [
        ...buildMetricsBatch({
          queueItems: [queueItem],
          updatedAt: NOW,
        }).counters.values(),
      ].find(({ windowKey }) => windowKey === "lifetime");
      if (!counter) {
        throw new Error("Expected the duplicate counter delta fixture.");
      }
      return await captureCounter(ctx, counter);
    });

    expect(failure).toMatchObject({
      _tag: "ContentAnalyticsIoError",
      code: "CONTENT_ANALYTICS_IO_FAILED",
      message: expect.any(String),
    });
  });
});
