import type { Doc } from "@repo/backend/convex/_generated/dataModel";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import { toContentAnalyticsIoError } from "@repo/backend/convex/contents/analytics/spec";
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

/** Aggregated graph-view delta for one content asset and locale. */
interface AnalyticsCount {
  readonly locale: Locale;
  readonly ref: AnalyticsGraphRef;
  readonly section: QueuedContentView["section"];
  viewCount: number;
}

/** Extracts persisted graph identity fields from one queued content view. */
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
    locale: item.locale,
    ref: getAnalyticsGraphRef(item),
    section: item.section,
    viewCount: 1,
  });
}

/** Builds one analytics batch from append-only queued unique views. */
function buildContentAnalyticsBatch(queueItems: readonly QueuedContentView[]) {
  const learningPopularity = new Map<string, AnalyticsCount>();
  const learningTrendingBuckets = new Map<
    string,
    {
      ref: AnalyticsGraphRef;
      bucketStart: number;
      locale: Locale;
      section: QueuedContentView["section"];
      viewCount: number;
    }
  >();

  for (const queueItem of queueItems) {
    incrementCount(learningPopularity, queueItem);

    if (queueItem.section === "subject") {
      const bucketStart = getTrendingBucketStart(queueItem.viewedAt);
      const bucketKey = `${queueItem.locale}:${bucketStart}:${queueItem.content_id}`;
      const existingBucket = learningTrendingBuckets.get(bucketKey);

      if (existingBucket) {
        existingBucket.viewCount += 1;
        continue;
      }

      learningTrendingBuckets.set(bucketKey, {
        ref: getAnalyticsGraphRef(queueItem),
        bucketStart,
        locale: queueItem.locale,
        section: queueItem.section,
        viewCount: 1,
      });
    }
  }

  return {
    learningPopularity,
    learningTrendingBuckets,
  };
}

/** Applies one graph-backed popularity delta to the learning read model. */
const applyLearningPopularityDelta = Effect.fn(
  "contents.analytics.applyLearningPopularityDelta"
)(function* (
  ctx: MutationCtx,
  {
    locale,
    ref,
    section,
    updatedAt,
    viewCount,
  }: {
    locale: Locale;
    ref: AnalyticsGraphRef;
    section: QueuedContentView["section"];
    updatedAt: number;
    viewCount: number;
  }
) {
  const currentRow = yield* Effect.tryPromise({
    try: () =>
      ctx.db
        .query("learningPopularity")
        .withIndex("by_content_id", (q) => q.eq("content_id", ref.content_id))
        .unique(),
    catch: toContentAnalyticsIoError,
  });

  if (!currentRow) {
    yield* Effect.tryPromise({
      try: () =>
        ctx.db.insert("learningPopularity", {
          ...ref,
          locale,
          section,
          updatedAt,
          viewCount,
        }),
      catch: toContentAnalyticsIoError,
    });
    return;
  }

  yield* Effect.tryPromise({
    try: () =>
      ctx.db.patch("learningPopularity", currentRow._id, {
        ...ref,
        locale,
        section,
        updatedAt,
        viewCount: currentRow.viewCount + viewCount,
      }),
    catch: toContentAnalyticsIoError,
  });
});

/** Applies one locale/day learning trend delta to the derived table. */
const applyLearningTrendingBucketDelta = Effect.fn(
  "contents.analytics.applyLearningTrendingBucketDelta"
)(function* (
  ctx: MutationCtx,
  {
    bucketStart,
    locale,
    ref,
    section,
    updatedAt,
    viewCount,
  }: {
    bucketStart: number;
    locale: Locale;
    ref: AnalyticsGraphRef;
    section: QueuedContentView["section"];
    updatedAt: number;
    viewCount: number;
  }
) {
  const currentRow = yield* Effect.tryPromise({
    try: () =>
      ctx.db
        .query("learningTrendingBuckets")
        .withIndex(
          "by_section_and_locale_and_bucketStart_and_content_id",
          (q) =>
            q
              .eq("section", section)
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
        ctx.db.insert("learningTrendingBuckets", {
          ...ref,
          bucketStart,
          locale,
          section,
          updatedAt,
          viewCount,
        }),
      catch: toContentAnalyticsIoError,
    });
    return;
  }

  yield* Effect.tryPromise({
    try: () =>
      ctx.db.patch("learningTrendingBuckets", currentRow._id, {
        ...ref,
        bucketStart,
        locale,
        section,
        updatedAt,
        viewCount: currentRow.viewCount + viewCount,
      }),
    catch: toContentAnalyticsIoError,
  });
});

/** Folds queued unique views into derived popularity tables. */
export const applyContentAnalyticsBatch = Effect.fn(
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

  for (const popularityDelta of analyticsBatch.learningPopularity.values()) {
    yield* applyLearningPopularityDelta(ctx, {
      ...popularityDelta,
      updatedAt,
    });
  }

  for (const bucketDelta of analyticsBatch.learningTrendingBuckets.values()) {
    yield* applyLearningTrendingBucketDelta(ctx, {
      ...bucketDelta,
      updatedAt,
    });
  }
});
