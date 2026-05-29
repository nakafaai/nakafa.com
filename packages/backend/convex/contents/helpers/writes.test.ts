import type { Id } from "@repo/backend/convex/_generated/dataModel";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import { applyContentAnalyticsBatch } from "@repo/backend/convex/contents/helpers/writes";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import schema from "@repo/backend/convex/schema";
import { getTrendingBucketStart } from "@repo/backend/convex/subjectSections/utils";
import { convexModules } from "@repo/backend/convex/test.setup";
import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";

const NOW = Date.parse("2026-01-01T00:00:00.000Z");

/** Inserts one article content row for popularity write tests. */
function insertArticle(ctx: MutationCtx) {
  return ctx.db.insert("articleContents", {
    articleSlug: "analytics-writes",
    body: "Article body",
    category: "politics",
    contentHash: "article-hash",
    date: NOW,
    description: "Article description",
    locale: "en",
    slug: "articles/politics/analytics-writes",
    syncedAt: NOW,
    title: "Analytics Writes",
  });
}

/** Inserts one subject section row for popularity write tests. */
async function insertSubject(ctx: MutationCtx) {
  const topicId = await ctx.db.insert("subjectTopics", {
    category: "high-school",
    grade: "10",
    locale: "en",
    material: "mathematics",
    sectionCount: 1,
    slug: "subject/high-school/10/mathematics/vector",
    syncedAt: NOW,
    title: "Vector",
    topic: "vector",
  });

  return ctx.db.insert("subjectSections", {
    body: "Subject body",
    category: "high-school",
    contentHash: "subject-hash",
    date: NOW,
    description: "Subject description",
    grade: "10",
    locale: "en",
    material: "mathematics",
    section: "addition",
    slug: "subject/high-school/10/mathematics/vector/addition",
    subject: "Vector",
    syncedAt: NOW,
    title: "Vector Addition",
    topic: "vector",
    topicId,
  });
}

/** Inserts one exercise set row for popularity write tests. */
function insertExerciseSet(ctx: MutationCtx, suffix: string) {
  return ctx.db.insert("exerciseSets", {
    locale: "en",
    slug: `exercises/high-school/snbt/quantitative-knowledge/try-out/2026/${suffix}`,
    category: "high-school",
    type: "snbt",
    material: "quantitative-knowledge",
    exerciseType: "try-out",
    setName: suffix,
    title: `Set ${suffix}`,
    questionCount: 20,
    syncedAt: NOW,
  });
}

/** Enqueues one analytics row for the supplied content reference. */
async function enqueueView(
  ctx: MutationCtx,
  contentRef:
    | { id: Id<"articleContents">; type: "article" }
    | { id: Id<"subjectSections">; type: "subject" }
    | { id: Id<"exerciseSets">; type: "exercise" },
  offsetMs = 0
) {
  await ctx.db.insert("contentViewAnalyticsQueue", {
    contentRef,
    locale: "en",
    partition: 0,
    viewedAt: NOW + offsetMs,
  });
}

describe("contents/helpers/writes", () => {
  it("folds queued view deltas into existing and new popularity rows", async () => {
    const t = convexTest(schema, convexModules);

    const ids = await t.mutation(async (ctx) => {
      const articleId = await insertArticle(ctx);
      const subjectId = await insertSubject(ctx);
      const existingExerciseId = await insertExerciseSet(ctx, "existing");
      const newExerciseId = await insertExerciseSet(ctx, "new");
      const bucketStart = getTrendingBucketStart(NOW);

      await ctx.db.insert("articlePopularity", {
        contentId: articleId,
        updatedAt: NOW - 1,
        viewCount: 3,
      });
      await ctx.db.insert("subjectPopularity", {
        contentId: subjectId,
        updatedAt: NOW - 1,
        viewCount: 4,
      });
      await ctx.db.insert("subjectTrendingBuckets", {
        bucketStart,
        contentId: subjectId,
        locale: "en",
        updatedAt: NOW - 1,
        viewCount: 5,
      });
      await ctx.db.insert("exercisePopularity", {
        contentId: existingExerciseId,
        updatedAt: NOW - 1,
        viewCount: 6,
      });

      await enqueueView(ctx, { id: articleId, type: "article" });
      await enqueueView(ctx, { id: subjectId, type: "subject" });
      await enqueueView(ctx, { id: existingExerciseId, type: "exercise" });
      await enqueueView(ctx, { id: existingExerciseId, type: "exercise" }, 1);
      await enqueueView(ctx, { id: newExerciseId, type: "exercise" });

      const queueItems = await ctx.db
        .query("contentViewAnalyticsQueue")
        .collect();

      await runConvexProgram(
        applyContentAnalyticsBatch(ctx, { queueItems, updatedAt: NOW })
      );

      return { articleId, existingExerciseId, newExerciseId, subjectId };
    });

    const state = await t.query(async (ctx) => ({
      articlePopularity: await ctx.db
        .query("articlePopularity")
        .withIndex("by_contentId", (q) => q.eq("contentId", ids.articleId))
        .unique(),
      existingExercisePopularity: await ctx.db
        .query("exercisePopularity")
        .withIndex("by_contentId", (q) =>
          q.eq("contentId", ids.existingExerciseId)
        )
        .unique(),
      newExercisePopularity: await ctx.db
        .query("exercisePopularity")
        .withIndex("by_contentId", (q) => q.eq("contentId", ids.newExerciseId))
        .unique(),
      subjectPopularity: await ctx.db
        .query("subjectPopularity")
        .withIndex("by_contentId", (q) => q.eq("contentId", ids.subjectId))
        .unique(),
      subjectTrendingBucket: await ctx.db
        .query("subjectTrendingBuckets")
        .withIndex("by_locale_and_bucketStart_and_contentId", (q) =>
          q
            .eq("locale", "en")
            .eq("bucketStart", getTrendingBucketStart(NOW))
            .eq("contentId", ids.subjectId)
        )
        .unique(),
    }));

    expect(state.articlePopularity).toMatchObject({
      updatedAt: NOW,
      viewCount: 4,
    });
    expect(state.subjectPopularity).toMatchObject({
      updatedAt: NOW,
      viewCount: 5,
    });
    expect(state.subjectTrendingBucket).toMatchObject({
      updatedAt: NOW,
      viewCount: 6,
    });
    expect(state.existingExercisePopularity).toMatchObject({
      updatedAt: NOW,
      viewCount: 8,
    });
    expect(state.newExercisePopularity).toMatchObject({
      updatedAt: NOW,
      viewCount: 1,
    });
  });
});
