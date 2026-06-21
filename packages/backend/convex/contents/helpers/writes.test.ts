import type { Doc } from "@repo/backend/convex/_generated/dataModel";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import { applyContentAnalyticsBatch } from "@repo/backend/convex/contents/helpers/writes";
import { getTrendingBucketStart } from "@repo/backend/convex/curriculumLessons/utils";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import schema from "@repo/backend/convex/schema";
import { convexModules } from "@repo/backend/convex/test.setup";
import { createLearningGraphIdentityFromRoute } from "@repo/contents/_types/learning-graph";
import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";

const NOW = Date.parse("2026-01-01T00:00:00.000Z");
const ARTICLE_ROUTE = "articles/politics/analytics-writes";
const SUBJECT_ROUTE = "material/lesson/mathematics/vector/addition";
const EXISTING_EXERCISE_ROUTE =
  "material/practice/assessment/snbt/quantitative-knowledge/try-out-2026/set-1";
const NEW_EXERCISE_ROUTE =
  "material/practice/assessment/snbt/quantitative-knowledge/try-out-2026/set-2";

function getGraph(route: string) {
  const graph = createLearningGraphIdentityFromRoute({
    locale: "en",
    route,
  });

  if (!graph) {
    throw new Error(`Expected graph identity for ${route}.`);
  }

  return {
    ...graph,
    content_id: graph.assetId,
  };
}

/** Enqueues one analytics row for the supplied graph content reference. */
async function enqueueView(
  ctx: MutationCtx,
  input: ReturnType<typeof getGraph> & {
    readonly route: string;
    readonly section: Doc<"contentViewAnalyticsQueue">["section"];
  },
  offsetMs = 0
) {
  await ctx.db.insert("contentViewAnalyticsQueue", {
    ...input,
    locale: "en",
    partition: 0,
    viewedAt: NOW + offsetMs,
  });
}

describe("contents/helpers/writes", () => {
  it("folds queued view deltas into existing and new popularity rows", async () => {
    const t = convexTest(schema, convexModules);

    const ids = await t.mutation(async (ctx) => {
      const article = getGraph(ARTICLE_ROUTE);
      const subject = getGraph(SUBJECT_ROUTE);
      const existingExercise = getGraph(EXISTING_EXERCISE_ROUTE);
      const newExercise = getGraph(NEW_EXERCISE_ROUTE);
      const bucketStart = getTrendingBucketStart(NOW);

      await ctx.db.insert("learningPopularity", {
        ...article,
        locale: "en",
        section: "articles",
        updatedAt: NOW - 1,
        viewCount: 3,
      });
      await ctx.db.insert("learningPopularity", {
        ...subject,
        locale: "en",
        section: "material",
        updatedAt: NOW - 1,
        viewCount: 4,
      });
      await ctx.db.insert("learningTrendingBuckets", {
        ...subject,
        bucketStart,
        locale: "en",
        section: "material",
        updatedAt: NOW - 1,
        viewCount: 5,
      });
      await ctx.db.insert("learningPopularity", {
        ...existingExercise,
        locale: "en",
        section: "material",
        updatedAt: NOW - 1,
        viewCount: 6,
      });

      await enqueueView(ctx, {
        ...article,
        route: ARTICLE_ROUTE,
        section: "articles",
      });
      await enqueueView(ctx, {
        ...subject,
        route: SUBJECT_ROUTE,
        section: "material",
      });
      await enqueueView(ctx, {
        ...existingExercise,
        route: EXISTING_EXERCISE_ROUTE,
        section: "material",
      });
      await enqueueView(
        ctx,
        {
          ...existingExercise,
          route: EXISTING_EXERCISE_ROUTE,
          section: "material",
        },
        1
      );
      await enqueueView(ctx, {
        ...newExercise,
        route: NEW_EXERCISE_ROUTE,
        section: "material",
      });

      const queueItems = await ctx.db
        .query("contentViewAnalyticsQueue")
        .collect();

      await runConvexProgram(
        applyContentAnalyticsBatch(ctx, { queueItems, updatedAt: NOW })
      );

      return { article, existingExercise, newExercise, subject };
    });

    const state = await t.query(async (ctx) => ({
      articleLearningPopularity: await ctx.db
        .query("learningPopularity")
        .withIndex("by_content_id", (q) =>
          q.eq("content_id", ids.article.content_id)
        )
        .unique(),
      existingExercisePopularity: await ctx.db
        .query("learningPopularity")
        .withIndex("by_content_id", (q) =>
          q.eq("content_id", ids.existingExercise.content_id)
        )
        .unique(),
      newExercisePopularity: await ctx.db
        .query("learningPopularity")
        .withIndex("by_content_id", (q) =>
          q.eq("content_id", ids.newExercise.content_id)
        )
        .unique(),
      subjectLearningPopularity: await ctx.db
        .query("learningPopularity")
        .withIndex("by_content_id", (q) =>
          q.eq("content_id", ids.subject.content_id)
        )
        .unique(),
      subjectTrendingBucket: await ctx.db
        .query("learningTrendingBuckets")
        .withIndex(
          "by_section_and_locale_and_bucketStart_and_content_id",
          (q) =>
            q
              .eq("section", "material")
              .eq("locale", "en")
              .eq("bucketStart", getTrendingBucketStart(NOW))
              .eq("content_id", ids.subject.content_id)
        )
        .unique(),
    }));

    expect(state.articleLearningPopularity).toMatchObject({
      locale: "en",
      section: "articles",
      updatedAt: NOW,
      viewCount: 4,
    });
    expect(state.subjectLearningPopularity).toMatchObject({
      locale: "en",
      section: "material",
      updatedAt: NOW,
      viewCount: 5,
    });
    expect(state.subjectTrendingBucket).toMatchObject({
      updatedAt: NOW,
      viewCount: 6,
    });
    expect(state.existingExercisePopularity).toMatchObject({
      locale: "en",
      section: "material",
      updatedAt: NOW,
      viewCount: 8,
    });
    expect(state.newExercisePopularity).toMatchObject({
      locale: "en",
      section: "material",
      updatedAt: NOW,
      viewCount: 1,
    });
  });
});
