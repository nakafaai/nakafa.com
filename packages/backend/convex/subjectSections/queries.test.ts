import { api } from "@repo/backend/convex/_generated/api";
import type { Id } from "@repo/backend/convex/_generated/dataModel";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import schema from "@repo/backend/convex/schema";
import {
  invalidTrendingRangeCode,
  maxTrendingRangeDays,
} from "@repo/backend/convex/subjectSections/trending/spec";
import { TRENDING_BUCKET_MS } from "@repo/backend/convex/subjectSections/utils";
import { convexModules } from "@repo/backend/convex/test.setup";
import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";

const NOW = Date.parse("2026-01-01T00:00:00.000Z");

/** Inserts one subject section for trending query tests. */
async function insertSubject(ctx: MutationCtx, suffix: string) {
  const topicId = await ctx.db.insert("subjectTopics", {
    category: "high-school",
    grade: "10",
    locale: "en",
    material: "mathematics",
    order: 0,
    sectionCount: 1,
    slug: `subject/high-school/10/mathematics/topic-${suffix}`,
    syncedAt: NOW,
    title: `Topic ${suffix}`,
    topic: `topic-${suffix}`,
  });

  return await ctx.db.insert("subjectSections", {
    body: "Subject body",
    category: "high-school",
    contentHash: `subject-hash-${suffix}`,
    date: NOW,
    description: `Description ${suffix}`,
    grade: "10",
    locale: "en",
    material: "mathematics",
    order: 0,
    section: `section-${suffix}`,
    slug: `subject/high-school/10/mathematics/topic-${suffix}/section-${suffix}`,
    subject: `Topic ${suffix}`,
    syncedAt: NOW,
    title: `Subject ${suffix}`,
    topic: `topic-${suffix}`,
    topicId,
  });
}

/** Inserts one derived trending bucket row. */
async function insertTrendingBucket(
  ctx: MutationCtx,
  contentId: Id<"subjectSections">,
  {
    bucketStart,
    locale = "en",
    viewCount,
  }: {
    bucketStart: number;
    locale?: "en" | "id";
    viewCount: number;
  }
) {
  await ctx.db.insert("subjectTrendingBuckets", {
    bucketStart,
    contentId,
    locale,
    updatedAt: NOW,
    viewCount,
  });
}

function getConvexErrorData(error: unknown) {
  if (typeof error !== "object" || error === null || !("data" in error)) {
    throw new Error("Expected a ConvexError with data.");
  }

  return error.data;
}

describe("subjectSections/queries", () => {
  it("returns sorted subjects aggregated across bounded daily buckets", async () => {
    const t = convexTest(schema, convexModules);
    const { firstSubjectId, secondSubjectId } = await t.mutation(
      async (ctx) => {
        const firstSubjectId = await insertSubject(ctx, "first");
        const secondSubjectId = await insertSubject(ctx, "second");

        await insertTrendingBucket(ctx, firstSubjectId, {
          bucketStart: NOW,
          viewCount: 3,
        });
        await insertTrendingBucket(ctx, firstSubjectId, {
          bucketStart: NOW + TRENDING_BUCKET_MS,
          viewCount: 4,
        });
        await insertTrendingBucket(ctx, secondSubjectId, {
          bucketStart: NOW,
          viewCount: 10,
        });
        await insertTrendingBucket(ctx, secondSubjectId, {
          bucketStart: NOW,
          locale: "id",
          viewCount: 100,
        });

        return { firstSubjectId, secondSubjectId };
      }
    );

    const results = await t.query(
      api.subjectSections.queries.getTrendingSubjects,
      {
        locale: "en",
        since: NOW,
        until: NOW + 2 * TRENDING_BUCKET_MS,
        limit: 2,
        minViews: 5,
      }
    );

    expect(results).toEqual([
      expect.objectContaining({
        id: secondSubjectId,
        title: "Subject second",
        viewCount: 10,
      }),
      expect.objectContaining({
        id: firstSubjectId,
        title: "Subject first",
        viewCount: 7,
      }),
    ]);
  });

  it("returns an empty list for empty or zero-limit ranges", async () => {
    const t = convexTest(schema, convexModules);

    const emptyRange = await t.query(
      api.subjectSections.queries.getTrendingSubjects,
      {
        locale: "en",
        since: NOW,
        until: NOW,
      }
    );
    const zeroLimit = await t.query(
      api.subjectSections.queries.getTrendingSubjects,
      {
        locale: "en",
        since: NOW,
        until: NOW + TRENDING_BUCKET_MS,
        limit: 0,
      }
    );

    expect(emptyRange).toEqual([]);
    expect(zeroLimit).toEqual([]);
  });

  it("drops bucket rows whose subject document was deleted", async () => {
    const t = convexTest(schema, convexModules);

    await t.mutation(async (ctx) => {
      const subjectId = await insertSubject(ctx, "deleted");
      await insertTrendingBucket(ctx, subjectId, {
        bucketStart: NOW,
        viewCount: 10,
      });
      await ctx.db.delete("subjectSections", subjectId);
    });

    const results = await t.query(
      api.subjectSections.queries.getTrendingSubjects,
      {
        locale: "en",
        since: NOW,
        until: NOW + TRENDING_BUCKET_MS,
      }
    );

    expect(results).toEqual([]);
  });

  it("rejects ranges wider than the supported trending window", async () => {
    const t = convexTest(schema, convexModules);

    const error = await t
      .query(api.subjectSections.queries.getTrendingSubjects, {
        locale: "en",
        since: NOW,
        until: NOW + (maxTrendingRangeDays + 1) * TRENDING_BUCKET_MS,
      })
      .catch((error: unknown) => error);

    expect(getConvexErrorData(error)).toEqual({
      code: invalidTrendingRangeCode,
      message: `Trending range cannot exceed ${maxTrendingRangeDays} days.`,
    });
  });
});
