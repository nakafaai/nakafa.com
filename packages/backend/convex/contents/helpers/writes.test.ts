import type { Doc } from "@repo/backend/convex/_generated/dataModel";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import { applyContentAnalyticsBatch } from "@repo/backend/convex/contents/helpers/writes";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import schema from "@repo/backend/convex/schema";
import { getTrendingBucketStart } from "@repo/backend/convex/subjectSections/utils";
import { convexModules } from "@repo/backend/convex/test.setup";
import { createLearningGraphIdentityFromRoute } from "@repo/contents/_types/learning-graph";
import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";

const NOW = Date.parse("2026-01-01T00:00:00.000Z");
const ARTICLE_ROUTE = "articles/politics/analytics-writes";
const SUBJECT_ROUTE = "subject/high-school/10/mathematics/vector/addition";
const EXISTING_EXERCISE_ROUTE =
  "exercises/high-school/snbt/quantitative-knowledge/try-out/2026/set-1";
const NEW_EXERCISE_ROUTE =
  "exercises/high-school/snbt/quantitative-knowledge/try-out/2026/set-2";

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

      await ctx.db.insert("articlePopularity", {
        ...article,
        updatedAt: NOW - 1,
        viewCount: 3,
      });
      await ctx.db.insert("subjectPopularity", {
        ...subject,
        updatedAt: NOW - 1,
        viewCount: 4,
      });
      await ctx.db.insert("subjectTrendingBuckets", {
        ...subject,
        bucketStart,
        locale: "en",
        updatedAt: NOW - 1,
        viewCount: 5,
      });
      await ctx.db.insert("exercisePopularity", {
        ...existingExercise,
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
        section: "subject",
      });
      await enqueueView(ctx, {
        ...existingExercise,
        route: EXISTING_EXERCISE_ROUTE,
        section: "exercises",
      });
      await enqueueView(
        ctx,
        {
          ...existingExercise,
          route: EXISTING_EXERCISE_ROUTE,
          section: "exercises",
        },
        1
      );
      await enqueueView(ctx, {
        ...newExercise,
        route: NEW_EXERCISE_ROUTE,
        section: "exercises",
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
      articlePopularity: await ctx.db
        .query("articlePopularity")
        .withIndex("by_content_id", (q) =>
          q.eq("content_id", ids.article.content_id)
        )
        .unique(),
      existingExercisePopularity: await ctx.db
        .query("exercisePopularity")
        .withIndex("by_content_id", (q) =>
          q.eq("content_id", ids.existingExercise.content_id)
        )
        .unique(),
      newExercisePopularity: await ctx.db
        .query("exercisePopularity")
        .withIndex("by_content_id", (q) =>
          q.eq("content_id", ids.newExercise.content_id)
        )
        .unique(),
      subjectPopularity: await ctx.db
        .query("subjectPopularity")
        .withIndex("by_content_id", (q) =>
          q.eq("content_id", ids.subject.content_id)
        )
        .unique(),
      subjectTrendingBucket: await ctx.db
        .query("subjectTrendingBuckets")
        .withIndex("by_locale_and_bucketStart_and_content_id", (q) =>
          q
            .eq("locale", "en")
            .eq("bucketStart", getTrendingBucketStart(NOW))
            .eq("content_id", ids.subject.content_id)
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
