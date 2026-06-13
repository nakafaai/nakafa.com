import type { Doc } from "@repo/backend/convex/_generated/dataModel";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import {
  type ContentAnalyticsIoError,
  toContentAnalyticsIoError,
} from "@repo/backend/convex/contents/analytics/spec";
import type { Locale } from "@repo/backend/convex/lib/validators/contents";
import { getTrendingBucketStart } from "@repo/backend/convex/subjectSections/utils";
import { Effect } from "effect";

type QueuedContentView = Doc<"contentViewAnalyticsQueue">;
type AnalyticsGraphRef = Pick<
  QueuedContentView,
  | "alignmentId"
  | "assetId"
  | "conceptId"
  | "content_id"
  | "learningObjectId"
  | "lensId"
>;

interface AnalyticsCount {
  readonly ref: AnalyticsGraphRef;
  viewCount: number;
}

function getAnalyticsGraphRef(item: QueuedContentView): AnalyticsGraphRef {
  return {
    alignmentId: item.alignmentId,
    assetId: item.assetId,
    conceptId: item.conceptId,
    content_id: item.content_id,
    learningObjectId: item.learningObjectId,
    lensId: item.lensId,
  };
}

/** Increments one aggregated counter inside a mutable batch map. */
function incrementCount(
  map: Map<string, AnalyticsCount>,
  item: QueuedContentView
) {
  const existing = map.get(item.content_id);

  if (existing) {
    existing.viewCount += 1;
    return;
  }

  map.set(item.content_id, {
    ref: getAnalyticsGraphRef(item),
    viewCount: 1,
  });
}

/** Builds one analytics batch from append-only queued unique views. */
function buildContentAnalyticsBatch(queueItems: readonly QueuedContentView[]) {
  const articleViewCounts = new Map<string, AnalyticsCount>();
  const exerciseViewCounts = new Map<string, AnalyticsCount>();
  const subjectViewCounts = new Map<string, AnalyticsCount>();
  const subjectTrendingBuckets = new Map<
    string,
    {
      ref: AnalyticsGraphRef;
      bucketStart: number;
      locale: Locale;
      viewCount: number;
    }
  >();

  for (const queueItem of queueItems) {
    if (queueItem.section === "articles") {
      incrementCount(articleViewCounts, queueItem);
      continue;
    }

    if (queueItem.section === "subject") {
      incrementCount(subjectViewCounts, queueItem);

      const bucketStart = getTrendingBucketStart(queueItem.viewedAt);
      const bucketKey = `${queueItem.locale}:${bucketStart}:${queueItem.content_id}`;
      const existingBucket = subjectTrendingBuckets.get(bucketKey);

      if (existingBucket) {
        existingBucket.viewCount += 1;
        continue;
      }

      subjectTrendingBuckets.set(bucketKey, {
        ref: getAnalyticsGraphRef(queueItem),
        bucketStart,
        locale: queueItem.locale,
        viewCount: 1,
      });
      continue;
    }

    if (queueItem.section === "exercises") {
      incrementCount(exerciseViewCounts, queueItem);
    }
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
    ref,
    updatedAt,
    viewCount,
  }: {
    ref: AnalyticsGraphRef;
    updatedAt: number;
    viewCount: number;
  }
) {
  const currentRow = yield* Effect.tryPromise({
    try: () =>
      ctx.db
        .query("articlePopularity")
        .withIndex("by_content_id", (q) => q.eq("content_id", ref.content_id))
        .unique(),
    catch: toContentAnalyticsIoError,
  });

  if (!currentRow) {
    yield* Effect.tryPromise({
      try: () =>
        ctx.db.insert("articlePopularity", {
          ...ref,
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
        ...ref,
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
    ref,
    updatedAt,
    viewCount,
  }: {
    ref: AnalyticsGraphRef;
    updatedAt: number;
    viewCount: number;
  }
) {
  const currentRow = yield* Effect.tryPromise({
    try: () =>
      ctx.db
        .query("subjectPopularity")
        .withIndex("by_content_id", (q) => q.eq("content_id", ref.content_id))
        .unique(),
    catch: toContentAnalyticsIoError,
  });

  if (!currentRow) {
    yield* Effect.tryPromise({
      try: () =>
        ctx.db.insert("subjectPopularity", {
          ...ref,
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
        ...ref,
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
    ref,
    updatedAt,
    viewCount,
  }: {
    ref: AnalyticsGraphRef;
    updatedAt: number;
    viewCount: number;
  }
) {
  const currentRow = yield* Effect.tryPromise({
    try: () =>
      ctx.db
        .query("exercisePopularity")
        .withIndex("by_content_id", (q) => q.eq("content_id", ref.content_id))
        .unique(),
    catch: toContentAnalyticsIoError,
  });

  if (!currentRow) {
    yield* Effect.tryPromise({
      try: () =>
        ctx.db.insert("exercisePopularity", {
          ...ref,
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
        ...ref,
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
    locale,
    ref,
    updatedAt,
    viewCount,
  }: {
    bucketStart: number;
    locale: Locale;
    ref: AnalyticsGraphRef;
    updatedAt: number;
    viewCount: number;
  }
) {
  const currentRow = yield* Effect.tryPromise({
    try: () =>
      ctx.db
        .query("subjectTrendingBuckets")
        .withIndex("by_locale_and_bucketStart_and_content_id", (q) =>
          q
            .eq("locale", locale)
            .eq("bucketStart", bucketStart)
            .eq("content_id", ref.content_id)
        )
        .unique(),
    catch: toContentAnalyticsIoError,
  });

  if (!currentRow) {
    yield* Effect.tryPromise({
      try: () =>
        ctx.db.insert("subjectTrendingBuckets", {
          ...ref,
          bucketStart,
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
        ...ref,
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

  for (const { ref, viewCount } of analyticsBatch.articleViewCounts.values()) {
    yield* applyArticlePopularityDelta(ctx, {
      ref,
      updatedAt,
      viewCount,
    });
  }

  for (const { ref, viewCount } of analyticsBatch.subjectViewCounts.values()) {
    yield* applySubjectPopularityDelta(ctx, {
      ref,
      updatedAt,
      viewCount,
    });
  }

  for (const { ref, viewCount } of analyticsBatch.exerciseViewCounts.values()) {
    yield* applyExercisePopularityDelta(ctx, {
      ref,
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
