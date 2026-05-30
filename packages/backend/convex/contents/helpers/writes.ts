import type { Doc, Id } from "@repo/backend/convex/_generated/dataModel";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import {
  type ContentAnalyticsIoError,
  toContentAnalyticsIoError,
} from "@repo/backend/convex/contents/analytics/spec";
import type { Locale } from "@repo/backend/convex/lib/validators/contents";
import { getTrendingBucketStart } from "@repo/backend/convex/subjectSections/utils";
import { Effect } from "effect";

/** Increments one aggregated counter inside a mutable batch map. */
function incrementCount<TKey extends string>(
  map: Map<TKey, number>,
  key: TKey
) {
  map.set(key, (map.get(key) ?? 0) + 1);
}

/** Builds one analytics batch from append-only queued unique views. */
function buildContentAnalyticsBatch(
  queueItems: readonly Doc<"contentViewAnalyticsQueue">[]
) {
  const articleViewCounts = new Map<Id<"articleContents">, number>();
  const exerciseViewCounts = new Map<Id<"exerciseSets">, number>();
  const subjectViewCounts = new Map<Id<"subjectSections">, number>();
  const subjectTrendingBuckets = new Map<
    string,
    {
      bucketStart: number;
      contentId: Id<"subjectSections">;
      locale: Locale;
      viewCount: number;
    }
  >();

  for (const queueItem of queueItems) {
    if (queueItem.contentRef.type === "article") {
      incrementCount(articleViewCounts, queueItem.contentRef.id);
      continue;
    }

    if (queueItem.contentRef.type === "subject") {
      incrementCount(subjectViewCounts, queueItem.contentRef.id);

      const bucketStart = getTrendingBucketStart(queueItem.viewedAt);
      const bucketKey = `${queueItem.locale}:${bucketStart}:${queueItem.contentRef.id}`;
      const existingBucket = subjectTrendingBuckets.get(bucketKey);

      if (existingBucket) {
        existingBucket.viewCount += 1;
        continue;
      }

      subjectTrendingBuckets.set(bucketKey, {
        bucketStart,
        contentId: queueItem.contentRef.id,
        locale: queueItem.locale,
        viewCount: 1,
      });
      continue;
    }

    incrementCount(exerciseViewCounts, queueItem.contentRef.id);
  }

  return {
    articleViewCounts,
    exerciseViewCounts,
    subjectViewCounts,
    subjectTrendingBuckets,
  };
}

/** Applies one article popularity delta to the derived table. */
const applyArticlePopularityDelta = Effect.fn(
  "contents.analytics.applyArticlePopularityDelta"
)(function* (
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
  const currentRow = yield* Effect.tryPromise({
    try: () =>
      ctx.db
        .query("articlePopularity")
        .withIndex("by_contentId", (q) => q.eq("contentId", contentId))
        .unique(),
    catch: toContentAnalyticsIoError,
  });

  if (!currentRow) {
    yield* Effect.tryPromise({
      try: () =>
        ctx.db.insert("articlePopularity", {
          contentId,
          updatedAt,
          viewCount,
        }),
      catch: toContentAnalyticsIoError,
    });
    return;
  }

  yield* Effect.tryPromise({
    try: () =>
      ctx.db.patch("articlePopularity", currentRow._id, {
        updatedAt,
        viewCount: currentRow.viewCount + viewCount,
      }),
    catch: toContentAnalyticsIoError,
  });
});

/** Applies one subject popularity delta to the derived table. */
const applySubjectPopularityDelta = Effect.fn(
  "contents.analytics.applySubjectPopularityDelta"
)(function* (
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
  const currentRow = yield* Effect.tryPromise({
    try: () =>
      ctx.db
        .query("subjectPopularity")
        .withIndex("by_contentId", (q) => q.eq("contentId", contentId))
        .unique(),
    catch: toContentAnalyticsIoError,
  });

  if (!currentRow) {
    yield* Effect.tryPromise({
      try: () =>
        ctx.db.insert("subjectPopularity", {
          contentId,
          updatedAt,
          viewCount,
        }),
      catch: toContentAnalyticsIoError,
    });
    return;
  }

  yield* Effect.tryPromise({
    try: () =>
      ctx.db.patch("subjectPopularity", currentRow._id, {
        updatedAt,
        viewCount: currentRow.viewCount + viewCount,
      }),
    catch: toContentAnalyticsIoError,
  });
});

/** Applies one exercise popularity delta to the derived table. */
const applyExercisePopularityDelta = Effect.fn(
  "contents.analytics.applyExercisePopularityDelta"
)(function* (
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
  const currentRow = yield* Effect.tryPromise({
    try: () =>
      ctx.db
        .query("exercisePopularity")
        .withIndex("by_contentId", (q) => q.eq("contentId", contentId))
        .unique(),
    catch: toContentAnalyticsIoError,
  });

  if (!currentRow) {
    yield* Effect.tryPromise({
      try: () =>
        ctx.db.insert("exercisePopularity", {
          contentId,
          updatedAt,
          viewCount,
        }),
      catch: toContentAnalyticsIoError,
    });
    return;
  }

  yield* Effect.tryPromise({
    try: () =>
      ctx.db.patch("exercisePopularity", currentRow._id, {
        updatedAt,
        viewCount: currentRow.viewCount + viewCount,
      }),
    catch: toContentAnalyticsIoError,
  });
});

/** Applies one locale/day subject trending delta to the derived table. */
const applySubjectTrendingBucketDelta = Effect.fn(
  "contents.analytics.applySubjectTrendingBucketDelta"
)(function* (
  ctx: MutationCtx,
  {
    bucketStart,
    contentId,
    locale,
    updatedAt,
    viewCount,
  }: {
    bucketStart: number;
    contentId: Id<"subjectSections">;
    locale: Locale;
    updatedAt: number;
    viewCount: number;
  }
) {
  const currentRow = yield* Effect.tryPromise({
    try: () =>
      ctx.db
        .query("subjectTrendingBuckets")
        .withIndex("by_locale_and_bucketStart_and_contentId", (q) =>
          q
            .eq("locale", locale)
            .eq("bucketStart", bucketStart)
            .eq("contentId", contentId)
        )
        .unique(),
    catch: toContentAnalyticsIoError,
  });

  if (!currentRow) {
    yield* Effect.tryPromise({
      try: () =>
        ctx.db.insert("subjectTrendingBuckets", {
          bucketStart,
          contentId,
          locale,
          updatedAt,
          viewCount,
        }),
      catch: toContentAnalyticsIoError,
    });
    return;
  }

  yield* Effect.tryPromise({
    try: () =>
      ctx.db.patch("subjectTrendingBuckets", currentRow._id, {
        updatedAt,
        viewCount: currentRow.viewCount + viewCount,
      }),
    catch: toContentAnalyticsIoError,
  });
});

/** Folds queued unique views into derived popularity tables. */
export const applyContentAnalyticsBatch: (
  ctx: MutationCtx,
  input: {
    readonly queueItems: readonly Doc<"contentViewAnalyticsQueue">[];
    readonly updatedAt: number;
  }
) => Effect.Effect<void, ContentAnalyticsIoError> = Effect.fn(
  "contents.analytics.applyContentAnalyticsBatch"
)(function* (
  ctx: MutationCtx,
  {
    queueItems,
    updatedAt,
  }: {
    readonly queueItems: readonly Doc<"contentViewAnalyticsQueue">[];
    readonly updatedAt: number;
  }
) {
  const analyticsBatch = buildContentAnalyticsBatch(queueItems);

  for (const [contentId, viewCount] of analyticsBatch.articleViewCounts) {
    yield* applyArticlePopularityDelta(ctx, {
      contentId,
      updatedAt,
      viewCount,
    });
  }

  for (const [contentId, viewCount] of analyticsBatch.subjectViewCounts) {
    yield* applySubjectPopularityDelta(ctx, {
      contentId,
      updatedAt,
      viewCount,
    });
  }

  for (const [contentId, viewCount] of analyticsBatch.exerciseViewCounts) {
    yield* applyExercisePopularityDelta(ctx, {
      contentId,
      updatedAt,
      viewCount,
    });
  }

  for (const bucketDelta of analyticsBatch.subjectTrendingBuckets.values()) {
    yield* applySubjectTrendingBucketDelta(ctx, {
      ...bucketDelta,
      updatedAt,
    });
  }
});
