import type { Doc, Id } from "@repo/backend/convex/_generated/dataModel";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import type { Locale } from "@repo/backend/convex/lib/validators/contents";
import { getTrendingBucketStart } from "@repo/backend/convex/subjectSections/utils";
import { ConvexError } from "convex/values";

interface SubjectTrendingBucketDelta {
  bucketStart: number;
  contentId: Id<"subjectSections">;
  locale: Locale;
  viewCount: number;
}

interface ContentAnalyticsBatch {
  articleViewCounts: Map<Id<"articleContents">, number>;
  exerciseViewCounts: Map<Id<"exerciseSets">, number>;
  subjectTrendingBuckets: Map<string, SubjectTrendingBucketDelta>;
  subjectViewCounts: Map<Id<"subjectSections">, number>;
}

/** Increments one aggregated counter inside a mutable batch map. */
function incrementCount<TKey extends string>(
  map: Map<TKey, number>,
  key: TKey
) {
  map.set(key, (map.get(key) ?? 0) + 1);
}

/** Loads or creates one analytics partition state row. */
export async function ensureContentAnalyticsPartitionRow(
  ctx: Pick<MutationCtx, "db">,
  partition: number
) {
  const existingRow = await ctx.db
    .query("contentAnalyticsPartitions")
    .withIndex("by_partition", (q) => q.eq("partition", partition))
    .unique();

  if (existingRow) {
    return existingRow;
  }

  const partitionRowId = await ctx.db.insert("contentAnalyticsPartitions", {
    partition,
    leaseExpiresAt: 0,
    leaseVersion: 0,
  });

  const partitionRow = await ctx.db.get(
    "contentAnalyticsPartitions",
    partitionRowId
  );

  if (!partitionRow) {
    throw new ConvexError({
      code: "CONTENT_ANALYTICS_PARTITION_NOT_FOUND",
      message: "Content analytics partition row was not created.",
    });
  }

  return partitionRow;
}

/** Returns whether a partition currently has queued analytics rows. */
export async function hasContentAnalyticsBacklog(
  ctx: Pick<MutationCtx, "db">,
  partition: number
) {
  const queueRows = await ctx.db
    .query("contentViewAnalyticsQueue")
    .withIndex("by_partition", (q) => q.eq("partition", partition))
    .take(1);

  return queueRows.length > 0;
}

/** Loads one bounded queue batch for a single analytics partition. */
export async function loadContentAnalyticsQueueBatch(
  ctx: Pick<MutationCtx, "db">,
  {
    batchSize,
    partition,
  }: {
    batchSize: number;
    partition: number;
  }
) {
  return await ctx.db
    .query("contentViewAnalyticsQueue")
    .withIndex("by_partition", (q) => q.eq("partition", partition))
    .take(batchSize);
}

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

/** Builds one analytics batch from append-only queued unique views. */
export function buildContentAnalyticsBatch(
  queueItems: Doc<"contentViewAnalyticsQueue">[]
): ContentAnalyticsBatch {
  const articleViewCounts = new Map<Id<"articleContents">, number>();
  const exerciseViewCounts = new Map<Id<"exerciseSets">, number>();
  const subjectViewCounts = new Map<Id<"subjectSections">, number>();
  const subjectTrendingBuckets = new Map<string, SubjectTrendingBucketDelta>();

  for (const queueItem of queueItems) {
    switch (queueItem.contentRef.type) {
      case "article": {
        incrementCount(articleViewCounts, queueItem.contentRef.id);
        break;
      }

      case "subject": {
        incrementCount(subjectViewCounts, queueItem.contentRef.id);

        const bucketStart = getTrendingBucketStart(queueItem.viewedAt);
        const bucketKey = `${queueItem.locale}:${bucketStart}:${queueItem.contentRef.id}`;
        const existingBucket = subjectTrendingBuckets.get(bucketKey);

        if (existingBucket) {
          existingBucket.viewCount += 1;
          break;
        }

        subjectTrendingBuckets.set(bucketKey, {
          bucketStart,
          contentId: queueItem.contentRef.id,
          locale: queueItem.locale,
          viewCount: 1,
        });
        break;
      }

      case "exercise": {
        incrementCount(exerciseViewCounts, queueItem.contentRef.id);
        break;
      }

      default: {
        break;
      }
    }
  }

  return {
    articleViewCounts,
    exerciseViewCounts,
    subjectViewCounts,
    subjectTrendingBuckets,
  };
}
