import type { Doc, Id } from "@repo/backend/convex/_generated/dataModel";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import {
  MAX_AUDIO_QUEUE_POPULAR_ITEMS_PER_TYPE,
  MIN_VIEW_THRESHOLD,
} from "@repo/backend/convex/audioStudies/constants";
import { audioContentRefValidator } from "@repo/backend/convex/lib/validators/audio";
import type { Locale } from "@repo/backend/convex/lib/validators/contents";
import { getTrendingBucketStart } from "@repo/backend/convex/subjectSections/utils";
import type { Infer } from "convex/values";
import { v } from "convex/values";

/** Number of analytics queue rows processed per mutation. */
export const CONTENT_VIEW_ANALYTICS_BATCH_SIZE = 250;

/** Ranked content candidate used when filling the audio generation queue. */
export const popularAudioContentItemValidator = v.object({
  ref: audioContentRefValidator,
  viewCount: v.number(),
});

export type PopularAudioContentItem = Infer<
  typeof popularAudioContentItemValidator
>;

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

function incrementCount<TKey extends string>(
  map: Map<TKey, number>,
  key: TKey
) {
  map.set(key, (map.get(key) ?? 0) + 1);
}

/** Applies one article popularity delta to the derived table. */
async function applyArticlePopularityDelta(
  ctx: MutationCtx,
  {
    contentId,
    viewCount,
  }: {
    contentId: Id<"articleContents">;
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
      updatedAt: Date.now(),
      viewCount,
    });
    return;
  }

  await ctx.db.patch("articlePopularity", currentRow._id, {
    updatedAt: Date.now(),
    viewCount: currentRow.viewCount + viewCount,
  });
}

/** Applies one subject popularity delta to the derived table. */
async function applySubjectPopularityDelta(
  ctx: MutationCtx,
  {
    contentId,
    viewCount,
  }: {
    contentId: Id<"subjectSections">;
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
      updatedAt: Date.now(),
      viewCount,
    });
    return;
  }

  await ctx.db.patch("subjectPopularity", currentRow._id, {
    updatedAt: Date.now(),
    viewCount: currentRow.viewCount + viewCount,
  });
}

/** Applies one exercise popularity delta to the derived table. */
async function applyExercisePopularityDelta(
  ctx: MutationCtx,
  {
    contentId,
    viewCount,
  }: {
    contentId: Id<"exerciseSets">;
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
      updatedAt: Date.now(),
      viewCount,
    });
    return;
  }

  await ctx.db.patch("exercisePopularity", currentRow._id, {
    updatedAt: Date.now(),
    viewCount: currentRow.viewCount + viewCount,
  });
}

/** Applies one locale/day subject trending delta to the derived table. */
async function applySubjectTrendingBucketDelta(
  ctx: MutationCtx,
  bucketDelta: SubjectTrendingBucketDelta
) {
  const currentRow = await ctx.db
    .query("subjectTrendingBuckets")
    .withIndex("by_locale_and_bucketStart_and_contentId", (q) =>
      q
        .eq("locale", bucketDelta.locale)
        .eq("bucketStart", bucketDelta.bucketStart)
        .eq("contentId", bucketDelta.contentId)
    )
    .unique();

  if (!currentRow) {
    await ctx.db.insert("subjectTrendingBuckets", {
      bucketStart: bucketDelta.bucketStart,
      contentId: bucketDelta.contentId,
      locale: bucketDelta.locale,
      updatedAt: Date.now(),
      viewCount: bucketDelta.viewCount,
    });
    return;
  }

  await ctx.db.patch("subjectTrendingBuckets", currentRow._id, {
    updatedAt: Date.now(),
    viewCount: currentRow.viewCount + bucketDelta.viewCount,
  });
}

/** Folds queued unique views into derived popularity tables. */
export async function applyContentAnalyticsBatch(
  ctx: MutationCtx,
  analyticsBatch: ContentAnalyticsBatch
) {
  for (const [contentId, viewCount] of analyticsBatch.articleViewCounts) {
    await applyArticlePopularityDelta(ctx, { contentId, viewCount });
  }

  for (const [contentId, viewCount] of analyticsBatch.subjectViewCounts) {
    await applySubjectPopularityDelta(ctx, { contentId, viewCount });
  }

  for (const [contentId, viewCount] of analyticsBatch.exerciseViewCounts) {
    await applyExercisePopularityDelta(ctx, { contentId, viewCount });
  }

  for (const bucketDelta of analyticsBatch.subjectTrendingBuckets.values()) {
    await applySubjectTrendingBucketDelta(ctx, bucketDelta);
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

/** Deduplicates and ranks popularity rows for audio queue consumption. */
export function mergePopularAudioContentItems(
  items: PopularAudioContentItem[]
) {
  const mergedItems = new Map<string, PopularAudioContentItem>();

  for (const item of items) {
    const key = `${item.ref.type}:${item.ref.id}`;
    const existingItem = mergedItems.get(key);

    if (!existingItem) {
      mergedItems.set(key, {
        ref: item.ref,
        viewCount: item.viewCount,
      });
      continue;
    }

    existingItem.viewCount += item.viewCount;
  }

  return Array.from(mergedItems.values())
    .filter((item) => item.viewCount >= MIN_VIEW_THRESHOLD)
    .sort((left, right) => right.viewCount - left.viewCount)
    .slice(0, MAX_AUDIO_QUEUE_POPULAR_ITEMS_PER_TYPE * 2);
}
