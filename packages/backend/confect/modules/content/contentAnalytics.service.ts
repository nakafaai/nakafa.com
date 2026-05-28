import type { Id } from "@repo/backend/confect/_generated/dataModel";
import refs from "@repo/backend/confect/_generated/refs";
import {
  DatabaseReader,
  DatabaseWriter,
  Scheduler,
} from "@repo/backend/confect/_generated/services";
import {
  CONTENT_ANALYTICS_BATCH_SIZE,
  CONTENT_ANALYTICS_LEASE_DURATION_MS,
  CONTENT_ANALYTICS_PARTITION_COUNT,
  CONTENT_ANALYTICS_PARTITIONS,
} from "@repo/backend/confect/modules/content/constants";
import type { ContentViewAnalyticsQueue } from "@repo/backend/confect/modules/content/contents.tables";
import { getTrendingBucketStart } from "@repo/backend/confect/modules/content/trending/time";
import { Clock, Duration, Effect, Option, Schema } from "effect";

export class InvalidContentAnalyticsPartition extends Schema.TaggedError<InvalidContentAnalyticsPartition>()(
  "InvalidContentAnalyticsPartition",
  { message: Schema.String }
) {}

type QueueItem = typeof ContentViewAnalyticsQueue.Doc.Type;

/** Returns whether a content analytics partition is inside the configured range. */
function isContentAnalyticsPartition(partition: number) {
  return partition >= 0 && partition < CONTENT_ANALYTICS_PARTITION_COUNT;
}

/** Fails when a content analytics partition is outside the configured range. */
function validateContentAnalyticsPartition(partition: number) {
  if (isContentAnalyticsPartition(partition)) {
    return Effect.succeed(partition);
  }

  return Effect.fail(
    new InvalidContentAnalyticsPartition({
      message: "Content analytics partition is out of range.",
    })
  );
}

/** Increments a numeric count in a map. */
function incrementCount<Key>(map: Map<Key, number>, key: Key) {
  map.set(key, (map.get(key) ?? 0) + 1);
}

/** Builds grouped popularity and trending deltas from queued view events. */
function buildContentAnalyticsBatch(queueItems: readonly QueueItem[]) {
  const articleViewCounts = new Map<Id<"articleContents">, number>();
  const exerciseViewCounts = new Map<Id<"exerciseSets">, number>();
  const subjectViewCounts = new Map<Id<"subjectSections">, number>();
  const subjectTrendingBuckets = new Map<
    string,
    {
      bucketStart: number;
      contentId: Id<"subjectSections">;
      locale: QueueItem["locale"];
      viewCount: number;
    }
  >();

  for (const queueItem of queueItems) {
    if (queueItem.contentRef.type === "article") {
      incrementCount(articleViewCounts, queueItem.contentRef.id);
      continue;
    }

    if (queueItem.contentRef.type === "exercise") {
      incrementCount(exerciseViewCounts, queueItem.contentRef.id);
      continue;
    }

    const bucketStart = getTrendingBucketStart(queueItem.viewedAt);
    const bucketKey = `${queueItem.locale}:${bucketStart}:${queueItem.contentRef.id}`;
    const existingBucket = subjectTrendingBuckets.get(bucketKey);
    incrementCount(subjectViewCounts, queueItem.contentRef.id);

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
  }

  return {
    articleViewCounts,
    exerciseViewCounts,
    subjectTrendingBuckets,
    subjectViewCounts,
  };
}

/** Applies one article popularity delta. */
const applyArticlePopularityDelta = Effect.fn(
  "contentAnalytics.applyArticlePopularityDelta"
)(function* (args: {
  contentId: Id<"articleContents">;
  updatedAt: number;
  viewCount: number;
}) {
  const reader = yield* DatabaseReader;
  const writer = yield* DatabaseWriter;
  const currentRowOption = yield* reader
    .table("articlePopularity")
    .index("by_contentId", (query) => query.eq("contentId", args.contentId))
    .first();
  const currentRow = Option.getOrNull(currentRowOption);

  if (!currentRow) {
    yield* writer.table("articlePopularity").insert(args);
    return;
  }

  yield* writer.table("articlePopularity").patch(currentRow._id, {
    updatedAt: args.updatedAt,
    viewCount: currentRow.viewCount + args.viewCount,
  });
});

/** Applies one subject popularity delta. */
const applySubjectPopularityDelta = Effect.fn(
  "contentAnalytics.applySubjectPopularityDelta"
)(function* (args: {
  contentId: Id<"subjectSections">;
  updatedAt: number;
  viewCount: number;
}) {
  const reader = yield* DatabaseReader;
  const writer = yield* DatabaseWriter;
  const currentRowOption = yield* reader
    .table("subjectPopularity")
    .index("by_contentId", (query) => query.eq("contentId", args.contentId))
    .first();
  const currentRow = Option.getOrNull(currentRowOption);

  if (!currentRow) {
    yield* writer.table("subjectPopularity").insert(args);
    return;
  }

  yield* writer.table("subjectPopularity").patch(currentRow._id, {
    updatedAt: args.updatedAt,
    viewCount: currentRow.viewCount + args.viewCount,
  });
});

/** Applies one exercise popularity delta. */
const applyExercisePopularityDelta = Effect.fn(
  "contentAnalytics.applyExercisePopularityDelta"
)(function* (args: {
  contentId: Id<"exerciseSets">;
  updatedAt: number;
  viewCount: number;
}) {
  const reader = yield* DatabaseReader;
  const writer = yield* DatabaseWriter;
  const currentRowOption = yield* reader
    .table("exercisePopularity")
    .index("by_contentId", (query) => query.eq("contentId", args.contentId))
    .first();
  const currentRow = Option.getOrNull(currentRowOption);

  if (!currentRow) {
    yield* writer.table("exercisePopularity").insert(args);
    return;
  }

  yield* writer.table("exercisePopularity").patch(currentRow._id, {
    updatedAt: args.updatedAt,
    viewCount: currentRow.viewCount + args.viewCount,
  });
});

/** Applies one subject trending bucket delta. */
const applySubjectTrendingBucketDelta = Effect.fn(
  "contentAnalytics.applySubjectTrendingBucketDelta"
)(function* (args: {
  bucketStart: number;
  contentId: Id<"subjectSections">;
  locale: QueueItem["locale"];
  updatedAt: number;
  viewCount: number;
}) {
  const reader = yield* DatabaseReader;
  const writer = yield* DatabaseWriter;
  const currentRowOption = yield* reader
    .table("subjectTrendingBuckets")
    .index("by_locale_and_bucketStart_and_contentId", (query) =>
      query
        .eq("locale", args.locale)
        .eq("bucketStart", args.bucketStart)
        .eq("contentId", args.contentId)
    )
    .first();
  const currentRow = Option.getOrNull(currentRowOption);

  if (!currentRow) {
    yield* writer.table("subjectTrendingBuckets").insert({
      bucketStart: args.bucketStart,
      contentId: args.contentId,
      locale: args.locale,
      updatedAt: args.updatedAt,
      viewCount: args.viewCount,
    });
    return;
  }

  yield* writer.table("subjectTrendingBuckets").patch(currentRow._id, {
    updatedAt: args.updatedAt,
    viewCount: currentRow.viewCount + args.viewCount,
  });
});

/** Applies a queued content analytics batch to popularity read models. */
const applyContentAnalyticsBatch = Effect.fn(
  "contentAnalytics.applyContentAnalyticsBatch"
)(function* (queueItems: readonly QueueItem[]) {
  const analyticsBatch = buildContentAnalyticsBatch(queueItems);
  const updatedAt = yield* Clock.currentTimeMillis;

  for (const [contentId, viewCount] of analyticsBatch.articleViewCounts) {
    yield* applyArticlePopularityDelta({ contentId, updatedAt, viewCount });
  }

  for (const [contentId, viewCount] of analyticsBatch.subjectViewCounts) {
    yield* applySubjectPopularityDelta({ contentId, updatedAt, viewCount });
  }

  for (const [contentId, viewCount] of analyticsBatch.exerciseViewCounts) {
    yield* applyExercisePopularityDelta({ contentId, updatedAt, viewCount });
  }

  for (const bucketDelta of analyticsBatch.subjectTrendingBuckets.values()) {
    yield* applySubjectTrendingBucketDelta({ ...bucketDelta, updatedAt });
  }
});

/** Schedules processing for every content analytics partition. */
export const scheduleContentAnalyticsPartitions = Effect.fn(
  "contentAnalytics.scheduleContentAnalyticsPartitions"
)(function* () {
  const scheduler = yield* Scheduler;

  for (const partition of CONTENT_ANALYTICS_PARTITIONS) {
    yield* scheduler.runAfter(
      Duration.millis(0),
      refs.internal.contents.mutations.analytics
        .scheduleContentAnalyticsPartition,
      { partition }
    );
  }

  return { enqueuedPartitions: CONTENT_ANALYTICS_PARTITIONS.length };
});

/** Acquires a partition lease and schedules batch processing. */
export const scheduleContentAnalyticsPartition = Effect.fn(
  "contentAnalytics.scheduleContentAnalyticsPartition"
)(function* (args: { partition: number }) {
  const reader = yield* DatabaseReader;
  const writer = yield* DatabaseWriter;
  const scheduler = yield* Scheduler;
  const partition = yield* validateContentAnalyticsPartition(args.partition);
  const partitionRowOption = yield* reader
    .table("contentAnalyticsPartitions")
    .index("by_partition", (query) => query.eq("partition", partition))
    .first();
  const partitionRow = Option.getOrNull(partitionRowOption);
  const now = yield* Clock.currentTimeMillis;
  const partitionRowId =
    partitionRow?._id ??
    (yield* writer.table("contentAnalyticsPartitions").insert({
      leaseExpiresAt: 0,
      leaseVersion: 0,
      partition,
    }));
  const leaseExpiresAt = partitionRow?.leaseExpiresAt ?? 0;
  let leaseVersion = partitionRow?.leaseVersion ?? 0;

  if (leaseExpiresAt > now) {
    return { createdPartition: !partitionRow, scheduled: false };
  }

  leaseVersion += 1;
  yield* writer.table("contentAnalyticsPartitions").patch(partitionRowId, {
    leaseExpiresAt: now + CONTENT_ANALYTICS_LEASE_DURATION_MS,
    leaseVersion,
  });
  yield* scheduler.runAfter(
    Duration.millis(0),
    refs.internal.contents.mutations.analytics.processContentAnalyticsPartition,
    { leaseVersion, partition }
  );

  return { createdPartition: !partitionRow, scheduled: true };
});

/** Processes one leased partition batch and reschedules when more rows remain. */
export const processContentAnalyticsPartition = Effect.fn(
  "contentAnalytics.processContentAnalyticsPartition"
)(function* (args: { leaseVersion: number; partition: number }) {
  const reader = yield* DatabaseReader;
  const writer = yield* DatabaseWriter;
  const scheduler = yield* Scheduler;
  const partition = yield* validateContentAnalyticsPartition(args.partition);
  const now = yield* Clock.currentTimeMillis;
  const partitionRowOption = yield* reader
    .table("contentAnalyticsPartitions")
    .index("by_partition", (query) => query.eq("partition", partition))
    .first();
  const partitionRow = Option.getOrNull(partitionRowOption);

  if (
    !partitionRow ||
    partitionRow.leaseVersion !== args.leaseVersion ||
    partitionRow.leaseExpiresAt < now
  ) {
    return { hasMore: false, partition, processed: 0, skipped: true };
  }

  const queueItems = yield* reader
    .table("contentViewAnalyticsQueue")
    .index("by_partition", (query) => query.eq("partition", partition))
    .take(CONTENT_ANALYTICS_BATCH_SIZE);

  if (queueItems.length === 0) {
    yield* writer.table("contentAnalyticsPartitions").patch(partitionRow._id, {
      lastProcessedAt: now,
      leaseExpiresAt: 0,
    });
    return { hasMore: false, partition, processed: 0, skipped: false };
  }

  yield* applyContentAnalyticsBatch(queueItems);

  for (const queueItem of queueItems) {
    yield* writer.table("contentViewAnalyticsQueue").delete(queueItem._id);
  }

  const hasMore = queueItems.length === CONTENT_ANALYTICS_BATCH_SIZE;
  const leaseExpiresAt = hasMore
    ? now + CONTENT_ANALYTICS_LEASE_DURATION_MS
    : 0;

  yield* writer.table("contentAnalyticsPartitions").patch(partitionRow._id, {
    lastProcessedAt: now,
    leaseExpiresAt,
  });

  if (hasMore) {
    yield* scheduler.runAfter(
      Duration.millis(0),
      refs.internal.contents.mutations.analytics
        .processContentAnalyticsPartition,
      args
    );
  }

  yield* Effect.logInfo("Processed content analytics partition batch", {
    hasMore,
    partition,
    processed: queueItems.length,
  });

  return {
    hasMore,
    partition,
    processed: queueItems.length,
    skipped: false,
  };
});
