import { api } from "@repo/backend/convex/_generated/api";
import type { Id } from "@repo/backend/convex/_generated/dataModel";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import type { Locale } from "@repo/backend/convex/lib/validators/contents";
import schema from "@repo/backend/convex/schema";
import {
  invalidTrendingRangeCode,
  maxTrendingRangeDays,
} from "@repo/backend/convex/subjectSections/trending/spec";
import { TRENDING_BUCKET_MS } from "@repo/backend/convex/subjectSections/utils";
import { convexModules } from "@repo/backend/convex/test.setup";
import { createLearningGraphIdentityFromRoute } from "@repo/contents/_types/learning-graph";
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

/** Inserts the graph route projection for one synced subject section. */
async function insertSubjectRoute(ctx: MutationCtx, suffix: string) {
  const route = `subject/high-school/10/mathematics/topic-${suffix}/section-${suffix}`;
  const identity = createLearningGraphIdentityFromRoute({
    locale: "en",
    route,
  });

  if (!identity) {
    throw new Error(`Expected subject graph identity for ${route}.`);
  }

  await ctx.db.insert("contentRoutes", {
    ...identity,
    authors: [{ name: "Nakafa Author" }],
    contentHash: `subject-hash-${suffix}`,
    content_id: identity.assetId,
    date: NOW,
    description: `Description ${suffix}`,
    kind: "subject-section",
    locale: "en",
    markdown: true,
    route,
    section: "subject",
    syncedAt: NOW,
    title: `Subject ${suffix}`,
  });

  return identity;
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
    locale?: Locale;
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
    const { firstRef, firstSubjectId, secondRef } = await t.mutation(
      async (ctx) => {
        const firstSubjectId = await insertSubject(ctx, "first");
        const secondSubjectId = await insertSubject(ctx, "second");
        const firstRef = await insertSubjectRoute(ctx, "first");
        const secondRef = await insertSubjectRoute(ctx, "second");

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

        return { firstRef, firstSubjectId, secondRef };
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
        assetId: secondRef.assetId,
        content_id: secondRef.assetId,
        route: "subject/high-school/10/mathematics/topic-second/section-second",
        title: "Subject second",
        url: "https://nakafa.com/en/subject/high-school/10/mathematics/topic-second/section-second",
        viewCount: 10,
      }),
      expect.objectContaining({
        assetId: firstRef.assetId,
        content_id: firstRef.assetId,
        route: "subject/high-school/10/mathematics/topic-first/section-first",
        title: "Subject first",
        url: "https://nakafa.com/en/subject/high-school/10/mathematics/topic-first/section-first",
        viewCount: 7,
      }),
    ]);
    expect(results[0]).not.toHaveProperty("id");
    expect(results[0]).not.toHaveProperty("slug");
    expect(firstSubjectId).not.toBe(firstRef.assetId);
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

  it("drops bucket rows whose subject lacks a graph route projection", async () => {
    const t = convexTest(schema, convexModules);

    await t.mutation(async (ctx) => {
      const subjectId = await insertSubject(ctx, "missing-route");
      await insertTrendingBucket(ctx, subjectId, {
        bucketStart: NOW,
        viewCount: 10,
      });
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
