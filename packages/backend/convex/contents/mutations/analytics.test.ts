import { afterEach, beforeEach, describe, expect, it } from "@effect/vitest";
import { internal } from "@repo/backend/convex/_generated/api";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import {
  CONTENT_ANALYTICS_FINALIZATION_RESERVE,
  CONTENT_ANALYTICS_GROUP_SIZE,
  CONTENT_ANALYTICS_HEADROOM,
} from "@repo/backend/convex/contents/analytics/budget";
import { CONTENT_ANALYTICS_LEASE_DURATION_MS } from "@repo/backend/convex/contents/constants";
import {
  getPopularitySignalDay,
  learningPopularityWindowValues,
  POPULARITY_DAY_MS,
} from "@repo/backend/convex/contents/popularity";
import { learningPopularityRankings } from "@repo/backend/convex/contents/rankings";
import schema from "@repo/backend/convex/schema";
import { registerLearningPopularityAggregate } from "@repo/backend/convex/test.helpers";
import { convexModules } from "@repo/backend/convex/test.setup";
import { logger } from "@repo/backend/convex/utils/logger";
import { testMaterialGraph } from "@repo/backend/test/content/material";
import type { TransactionMetrics } from "convex/server";
import { convexTest, type TestConvex } from "convex-test";

const NOW = Date.parse("2026-01-08T12:00:00.000Z");
const SIGNAL_DAY = getPopularitySignalDay(NOW);
const IDENTITY_COUNT = 64;
const SEED_CHUNK_SIZE = 4;
const METRIC_KEYS = [
  "bytesRead",
  "bytesWritten",
  "databaseQueries",
  "documentsRead",
  "documentsWritten",
  "functionsScheduled",
  "scheduledFunctionArgsBytes",
] as const satisfies readonly (keyof TransactionMetrics)[];

/** Builds a test deployment with the production aggregate component enabled. */
function createTarget() {
  const target = convexTest(schema, convexModules);
  registerLearningPopularityAggregate(target);
  return target;
}

/** Builds one unique graph identity in the same ranking namespaces. */
function identity(index: number) {
  const graph = testMaterialGraph("vector", "addition", "en", "mathematics");
  const suffix = `analytics:${index}`;
  const assetId = `${graph.assetId}:${suffix}`;
  return {
    alignmentId: `${graph.alignmentId}:${suffix}`,
    assetId,
    conceptId: `${graph.conceptId}:${suffix}`,
    content_id: assetId,
    learningObjectId: `${graph.learningObjectId}:${suffix}`,
    lensId: `${graph.lensId}:${suffix}`,
  };
}

/** Returns exact current-window provenance for one existing signal. */
function applied() {
  return {
    "1d": 1,
    "7d": 1,
    "14d": 1,
    "30d": 1,
    "90d": 1,
    "180d": 1,
    "365d": 1,
  };
}

/** Seeds one existing identity and its queued update without firing triggers. */
async function seedIdentity(
  ctx: MutationCtx,
  index: number
) {
  const graph = identity(index);
  const previous = {
    ...graph,
    contextKey: "canonical",
    contextMode: "canonical" as const,
    description: `Previous description ${index}`,
    locale: "en" as const,
    materialDomain: "mathematics" as const,
    route: `material/previous/${index}`,
    scopeMode: "global" as const,
    section: "material" as const,
    sourcePath: `material/source/${index}`,
    title: `Previous title ${index}`,
    updatedAt: NOW - POPULARITY_DAY_MS,
  };

  await ctx.db.insert("learningPopularitySignals", {
    ...previous,
    applied: applied(),
    signalDay: SIGNAL_DAY,
    viewCount: 1,
  });

  for (const windowKey of learningPopularityWindowValues) {
    const counterId = await ctx.db.insert("learningPopularityCounters", {
      ...previous,
      latestDay: SIGNAL_DAY,
      score: 1,
      windowKey,
    });
    const counter = await ctx.db.get(counterId);
    if (!counter) {
      throw new Error("Expected the popularity counter seed.");
    }
    await learningPopularityRankings.insert(ctx, counter);
  }

  const queueSize = index === 0 ? CONTENT_ANALYTICS_GROUP_SIZE : 1;
  for (let offset = 0; offset < queueSize; offset += 1) {
    await ctx.db.insert("learningEngagementQueue", {
      ...graph,
      contextKey: "canonical",
      contextMode: "canonical",
      description: `Current description ${index}`,
      insertedAt: NOW + index * CONTENT_ANALYTICS_GROUP_SIZE + offset,
      locale: "en",
      materialDomain: "mathematics",
      partition: 0,
      route: `material/current/${index}`,
      scopeMode: "global",
      section: "material",
      sourcePath: `material/source/${index}`,
      title: `Current title ${index}`,
      viewerKey: `device:analytics-${index}-${offset}`,
      viewedAt: NOW,
    });
  }
}

/** Seeds a deep aggregate in bounded setup transactions. */
async function seedDrain(target: TestConvex<typeof schema>) {
  for (let start = 0; start < IDENTITY_COUNT; start += SEED_CHUNK_SIZE) {
    await target.mutation(async (ctx) => {
      for (
        let index = start;
        index < Math.min(start + SEED_CHUNK_SIZE, IDENTITY_COUNT);
        index += 1
      ) {
        await seedIdentity(ctx, index);
      }
    });
  }

  await target.mutation(async (ctx) => {
    await ctx.db.insert("contentAnalyticsPartitions", {
      leaseExpiresAt: NOW + CONTENT_ANALYTICS_LEASE_DURATION_MS,
      leaseVersion: 1,
      partition: 0,
    });
  });
}

/** Runs the actual custom internal mutation and captures shared transaction use. */
async function runDrainPage(target: TestConvex<typeof schema>) {
  return await target.mutation(async (ctx) => {
    const result = await ctx.runMutation(
      internal.contents.mutations.analytics.processContentAnalyticsPartition,
      { leaseVersion: 1, partition: 0 }
    );
    const metrics = await ctx.meta.getTransactionMetrics();
    return { metrics, result };
  });
}

/** Reads exact counter, signal, queue, lease, and ranking state. */
async function readDrainState(target: TestConvex<typeof schema>) {
  return await target.query(async (ctx) => {
    const rankings = await Promise.all(
      learningPopularityWindowValues.map(async (windowKey) => {
        const page = await learningPopularityRankings.paginate(ctx, {
          namespace: ["material", "en", "global", windowKey],
          order: "asc",
          pageSize: IDENTITY_COUNT,
        });
        return page.page.map((item) => item.key);
      })
    );

    return {
      counters: await ctx.db.query("learningPopularityCounters").collect(),
      partition: await ctx.db.query("contentAnalyticsPartitions").unique(),
      queue: await ctx.db.query("learningEngagementQueue").collect(),
      rankings,
      signals: await ctx.db.query("learningPopularitySignals").collect(),
    };
  });
}

describe("contents/mutations/analytics", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(NOW));
    vi.spyOn(logger, "info").mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("drains 64 dense identities through bounded production pages", async () => {
      const target = createTarget();
      await seedDrain(target);
      const pages: Awaited<ReturnType<typeof runDrainPage>>[] = [];

      while (true) {
        const page = await runDrainPage(target);
        pages.push(page);
        if (!page.result.hasMore) {
          break;
        }
        if (pages.length >= IDENTITY_COUNT) {
          throw new Error("Expected the bounded drain to converge.");
        }
      }

      expect(pages.length).toBeGreaterThan(1);
      expect(
        pages.reduce((total, page) => total + page.result.processed, 0)
      ).toBe(IDENTITY_COUNT + CONTENT_ANALYTICS_GROUP_SIZE - 1);
      for (const { metrics, result } of pages) {
        expect(result).toMatchObject({ partition: 0, skipped: false });
        for (const key of METRIC_KEYS) {
          expect(metrics[key].remaining).toBeGreaterThanOrEqual(
            CONTENT_ANALYTICS_FINALIZATION_RESERVE[key]
          );
        }
      }

      const scheduled = await target.query(
        async (ctx) => await ctx.db.system.query("_scheduled_functions").collect()
      );
      expect(scheduled).toHaveLength(pages.length - 1);
      expect(scheduled.map((job) => job.args[0])).toEqual(
        Array.from({ length: pages.length - 1 }, () => ({
          leaseVersion: 1,
          partition: 0,
        }))
      );

      await target.finishAllScheduledFunctions(vi.runAllTimers);

      const state = await readDrainState(target);
      expect(state.queue).toEqual([]);
      expect(state.partition).toMatchObject({
        lastProcessedAt: NOW,
        leaseExpiresAt: 0,
        leaseVersion: 1,
      });
      expect(state.signals).toHaveLength(IDENTITY_COUNT);
      expect(
        state.signals.filter(
          (signal) =>
            signal.viewCount === CONTENT_ANALYTICS_GROUP_SIZE + 1 &&
            signal.applied["1d"] === CONTENT_ANALYTICS_GROUP_SIZE + 1 &&
            signal.applied["365d"] === CONTENT_ANALYTICS_GROUP_SIZE + 1
        )
      ).toHaveLength(1);
      expect(
        state.signals.filter(
          (signal) =>
            signal.viewCount === 2 &&
            signal.applied["1d"] === 2 &&
            signal.applied["365d"] === 2
        )
      ).toHaveLength(IDENTITY_COUNT - 1);
      expect(
        state.signals.every((signal) =>
          signal.title.startsWith("Current title ")
        )
      ).toBe(true);
      expect(state.counters).toHaveLength(
        IDENTITY_COUNT * learningPopularityWindowValues.length
      );
      expect(
        state.counters.filter(
          (counter) =>
            counter.score === CONTENT_ANALYTICS_GROUP_SIZE + 1 &&
            counter.latestDay === SIGNAL_DAY
        )
      ).toHaveLength(learningPopularityWindowValues.length);
      expect(
        state.counters.filter(
          (counter) => counter.score === 2 && counter.latestDay === SIGNAL_DAY
        )
      ).toHaveLength(
        (IDENTITY_COUNT - 1) * learningPopularityWindowValues.length
      );
      expect(
        state.counters.every((counter) =>
          counter.title.startsWith("Current title ")
        )
      ).toBe(true);
      expect(
        state.rankings.every(
          (ranking) =>
            ranking.length === IDENTITY_COUNT &&
            ranking.filter(
              ([score]) => score === -(CONTENT_ANALYTICS_GROUP_SIZE + 1)
            ).length === 1 &&
            ranking.filter(([score]) => score === -2).length ===
              IDENTITY_COUNT - 1
        )
      ).toBe(true);

      const minimumRemaining = Object.fromEntries(
        METRIC_KEYS.map((key) => [
          key,
          Math.min(...pages.map((page) => page.metrics[key].remaining)),
        ])
      );
      for (const key of METRIC_KEYS) {
        expect(minimumRemaining[key]).toBeGreaterThanOrEqual(
          CONTENT_ANALYTICS_FINALIZATION_RESERVE[key]
        );
        expect(CONTENT_ANALYTICS_HEADROOM[key]).toBeGreaterThan(
          CONTENT_ANALYTICS_FINALIZATION_RESERVE[key]
        );
      }
    }, 15_000);
});
