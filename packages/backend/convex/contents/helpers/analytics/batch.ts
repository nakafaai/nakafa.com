import type { Doc, Id } from "@repo/backend/convex/_generated/dataModel";
import type { Locale } from "@repo/backend/convex/lib/validators/contents";
import { getTrendingBucketStart } from "@repo/backend/convex/subjectSections/utils";

export interface SubjectTrendingBucketDelta {
  bucketStart: number;
  contentId: Id<"subjectSections">;
  locale: Locale;
  viewCount: number;
}

export interface ContentAnalyticsBatch {
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
