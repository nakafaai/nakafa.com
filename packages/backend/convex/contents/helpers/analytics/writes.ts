import type { Id } from "@repo/backend/convex/_generated/dataModel";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import type {
  ContentAnalyticsBatch,
  SubjectTrendingBucketDelta,
} from "@repo/backend/convex/contents/helpers/analytics/batch";

/** Applies one article popularity delta to the derived table. */
async function applyArticlePopularityDelta(
  ctx: MutationCtx,
  {
    contentId,
    updatedAt,
    viewCount,
  }: {
    contentId: Id<"articleContents">;
    updatedAt: number;
    viewCount: number;
  }
) {
  const currentRow = await ctx.db
    .query("articlePopularity")
    .withIndex("by_contentId", (q) => q.eq("contentId", contentId))
    .unique();

  if (!currentRow) {
    await ctx.db.insert("articlePopularity", {
      contentId,
      updatedAt,
      viewCount,
    });
    return;
  }

  await ctx.db.patch("articlePopularity", currentRow._id, {
    updatedAt,
    viewCount: currentRow.viewCount + viewCount,
  });
}

/** Applies one subject popularity delta to the derived table. */
async function applySubjectPopularityDelta(
  ctx: MutationCtx,
  {
    contentId,
    updatedAt,
    viewCount,
  }: {
    contentId: Id<"subjectSections">;
    updatedAt: number;
    viewCount: number;
  }
) {
  const currentRow = await ctx.db
    .query("subjectPopularity")
    .withIndex("by_contentId", (q) => q.eq("contentId", contentId))
    .unique();

  if (!currentRow) {
    await ctx.db.insert("subjectPopularity", {
      contentId,
      updatedAt,
      viewCount,
    });
    return;
  }

  await ctx.db.patch("subjectPopularity", currentRow._id, {
    updatedAt,
    viewCount: currentRow.viewCount + viewCount,
  });
}

/** Applies one exercise popularity delta to the derived table. */
async function applyExercisePopularityDelta(
  ctx: MutationCtx,
  {
    contentId,
    updatedAt,
    viewCount,
  }: {
    contentId: Id<"exerciseSets">;
    updatedAt: number;
    viewCount: number;
  }
) {
  const currentRow = await ctx.db
    .query("exercisePopularity")
    .withIndex("by_contentId", (q) => q.eq("contentId", contentId))
    .unique();

  if (!currentRow) {
    await ctx.db.insert("exercisePopularity", {
      contentId,
      updatedAt,
      viewCount,
    });
    return;
  }

  await ctx.db.patch("exercisePopularity", currentRow._id, {
    updatedAt,
    viewCount: currentRow.viewCount + viewCount,
  });
}

/** Applies one locale/day subject trending delta to the derived table. */
async function applySubjectTrendingBucketDelta(
  ctx: MutationCtx,
  {
    bucketStart,
    contentId,
    locale,
    updatedAt,
    viewCount,
  }: SubjectTrendingBucketDelta & {
    updatedAt: number;
  }
) {
  const currentRow = await ctx.db
    .query("subjectTrendingBuckets")
    .withIndex("by_locale_and_bucketStart_and_contentId", (q) =>
      q
        .eq("locale", locale)
        .eq("bucketStart", bucketStart)
        .eq("contentId", contentId)
    )
    .unique();

  if (!currentRow) {
    await ctx.db.insert("subjectTrendingBuckets", {
      bucketStart,
      contentId,
      locale,
      updatedAt,
      viewCount,
    });
    return;
  }

  await ctx.db.patch("subjectTrendingBuckets", currentRow._id, {
    updatedAt,
    viewCount: currentRow.viewCount + viewCount,
  });
}

/** Folds queued unique views into derived popularity tables. */
export async function applyContentAnalyticsBatch(
  ctx: MutationCtx,
  analyticsBatch: ContentAnalyticsBatch
) {
  const updatedAt = Date.now();

  for (const [contentId, viewCount] of analyticsBatch.articleViewCounts) {
    await applyArticlePopularityDelta(ctx, {
      contentId,
      updatedAt,
      viewCount,
    });
  }

  for (const [contentId, viewCount] of analyticsBatch.subjectViewCounts) {
    await applySubjectPopularityDelta(ctx, {
      contentId,
      updatedAt,
      viewCount,
    });
  }

  for (const [contentId, viewCount] of analyticsBatch.exerciseViewCounts) {
    await applyExercisePopularityDelta(ctx, {
      contentId,
      updatedAt,
      viewCount,
    });
  }

  for (const bucketDelta of analyticsBatch.subjectTrendingBuckets.values()) {
    await applySubjectTrendingBucketDelta(ctx, {
      ...bucketDelta,
      updatedAt,
    });
  }
}
