import { describe, expect, it } from "@effect/vitest";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import {
  buildMetricsBatch,
  groupMetricsQueueItems,
} from "@repo/backend/convex/contents/metrics/batch";
import {
  learningPopularityWindowValues,
  POPULARITY_DAY_MS,
} from "@repo/backend/convex/contents/popularity";
import schema from "@repo/backend/convex/schema";
import { convexModules } from "@repo/backend/convex/test.setup";
import { testMaterialGraph } from "@repo/backend/test/content/material";
import { convexTest } from "convex-test";

const NOW = Date.parse("2026-01-01T00:00:00.000Z");
const SHORT_ID = "asset:en:material:lesson";
const LONG_ID = `${SHORT_ID}:placement:program`;

/** Inserts one valid queue row from a deliberately delimiter-colliding tuple. */
async function insertQueueItem(
  ctx: MutationCtx,
  input: {
    readonly contentId: string;
    readonly contextKey: string;
    readonly index: number;
    readonly viewedAt?: number;
  }
) {
  const graph = testMaterialGraph("vector", "addition", "en", "mathematics");
  await ctx.db.insert("learningEngagementQueue", {
    ...graph,
    content_id: input.contentId,
    contextKey: input.contextKey,
    contextMode: input.contextKey === "canonical" ? "canonical" : "placement",
    description: "Subject description",
    insertedAt: NOW + input.index,
    locale: "en",
    materialDomain: "mathematics",
    partition: 0,
    route: `material/vector/${input.index}`,
    section: "material",
    scopeMode: "global",
    sourcePath: "material/lesson/mathematics/vector/addition",
    title: `Vector ${input.index}`,
    viewerKey: `device:${input.index}`,
    viewedAt: input.viewedAt ?? NOW,
  });
}

describe("contents/metrics/batch", () => {
  it("keeps delimiter-colliding identities separate and bounds their groups", async () => {
    const target = convexTest(schema, convexModules);
    await target.mutation(async (ctx) => {
      await insertQueueItem(ctx, {
        contentId: LONG_ID,
        contextKey: "canonical",
        index: 0,
      });
      await insertQueueItem(ctx, {
        contentId: SHORT_ID,
        contextKey: "placement:program:canonical",
        index: 1,
      });
      await insertQueueItem(ctx, {
        contentId: LONG_ID,
        contextKey: "canonical",
        index: 2,
      });
      await insertQueueItem(ctx, {
        contentId: LONG_ID,
        contextKey: "canonical",
        index: 3,
      });
    });

    const queueItems = await target.query(
      async (ctx) => await ctx.db.query("learningEngagementQueue").collect()
    );
    const batch = buildMetricsBatch({ queueItems, updatedAt: NOW });
    const groups = groupMetricsQueueItems(queueItems, 2);

    expect(groups.map((group) => group.length)).toEqual([2, 1, 1]);
    expect(batch.signals).toHaveProperty("size", 2);
    expect(batch.counters).toHaveProperty(
      "size",
      2 * learningPopularityWindowValues.length
    );
    expect(
      [...batch.signals.values()]
        .map(({ ref, viewCount }) => ({
          contentId: ref.content_id,
          viewCount,
        }))
        .sort((left, right) => left.contentId.localeCompare(right.contentId))
    ).toEqual([
      { contentId: SHORT_ID, viewCount: 1 },
      { contentId: LONG_ID, viewCount: 3 },
    ]);
  });

  it("retains the repair boundary and applies older events only to lifetime", async () => {
    const target = convexTest(schema, convexModules);
    await target.mutation(async (ctx) => {
      await insertQueueItem(ctx, {
        contentId: "retained",
        contextKey: "canonical",
        index: 0,
        viewedAt: NOW - 364 * POPULARITY_DAY_MS,
      });
      await insertQueueItem(ctx, {
        contentId: "expired",
        contextKey: "canonical",
        index: 1,
        viewedAt: NOW - 365 * POPULARITY_DAY_MS,
      });
    });

    const queueItems = await target.query(
      async (ctx) => await ctx.db.query("learningEngagementQueue").collect()
    );
    const batch = buildMetricsBatch({ queueItems, updatedAt: NOW });

    expect(
      [...batch.signals.values()].map((signal) => signal.ref.content_id)
    ).toEqual(["retained"]);
    expect(
      [...batch.counters.values()].map(({ ref, windowKey }) => ({
        contentId: ref.content_id,
        windowKey,
      }))
    ).toEqual([
      { contentId: "retained", windowKey: "365d" },
      { contentId: "retained", windowKey: "lifetime" },
      { contentId: "expired", windowKey: "lifetime" },
    ]);
  });
});
