import { DatabaseReader, DatabaseWriter, Scheduler } from "@confect/server";
import refs from "@repo/backend/confect/_generated/refs";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import {
  CONTENT_ANALYTICS_GROUP_SIZE,
  CONTENT_ANALYTICS_PAGE_BYTES,
  hasContentAnalyticsHeadroom,
} from "@repo/backend/confect/contents/analytics/budget";
import {
  InvalidContentAnalyticsPartitionError,
  invalidContentAnalyticsPartitionCode,
  type ProcessContentAnalyticsPartitionArgs,
  toContentAnalyticsIoError,
} from "@repo/backend/confect/contents/analytics/spec";
import {
  CONTENT_ANALYTICS_BATCH_SIZE,
  CONTENT_ANALYTICS_LEASE_DURATION_MS,
} from "@repo/backend/confect/contents/constants";
import { isContentAnalyticsPartition } from "@repo/backend/confect/contents/helpers/partitions";
import { applyContentAnalyticsBatch } from "@repo/backend/confect/contents/metrics/apply";
import { groupMetricsQueueItems } from "@repo/backend/confect/contents/metrics/batch";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import { Clock, Duration, Effect, flow } from "effect";

/** Generated internal mutation reference that continues one claimed drain. */

/** Applies and acknowledges one complete popularity identity group. */
const applyQueueGroup = Effect.fn("contents.analytics.applyQueueGroup")(
  function* (
    ctx: MutationCtx,
    queueItems: Parameters<typeof groupMetricsQueueItems>[0],
    updatedAt: number
  ) {
    const writer = DatabaseWriter.make(databaseSchema, ctx.db);
    yield* applyContentAnalyticsBatch(ctx, {
      queueItems,
      updatedAt,
    });
    for (const queueItem of queueItems) {
      yield* writer.table("learningEngagementQueue").delete(queueItem._id);
    }
  },
  Effect.catchDefect(flow(toContentAnalyticsIoError, Effect.fail))
);

/** Drains bounded identity groups while preserving finalization headroom. */
export const processClaimedContentAnalyticsPartition = Effect.fn(
  "contents.analytics.processClaimedContentAnalyticsPartition"
)(
  function* (ctx: MutationCtx, args: ProcessContentAnalyticsPartitionArgs) {
    const scheduler = yield* Scheduler.Scheduler.pipe(
      Effect.provide(Scheduler.layer(ctx.scheduler))
    );
    const database = DatabaseReader.make(databaseSchema, ctx.db);
    const writer = DatabaseWriter.make(databaseSchema, ctx.db);
    if (!isContentAnalyticsPartition(args.partition)) {
      return yield* new InvalidContentAnalyticsPartitionError({
        code: invalidContentAnalyticsPartitionCode,
        message: "Content analytics partition is out of range.",
      });
    }
    const now = yield* Clock.currentTimeMillis;
    const partitionRow = yield* database
      .table("contentAnalyticsPartitions")
      .get("by_partition", args.partition)
      .pipe(
        Effect.catchTag("GetByIndexFailure", () => Effect.succeed(null)),
        Effect.orDie
      );
    if (
      !partitionRow ||
      partitionRow.leaseVersion !== args.leaseVersion ||
      partitionRow.leaseExpiresAt < now
    ) {
      return {
        hasMore: false,
        partition: args.partition,
        processed: 0,
        skipped: true,
      };
    }
    const queuePage = yield* database
      .table("learningEngagementQueue")
      .index("by_partition_and_insertedAt", (q) =>
        q.eq("partition", args.partition)
      )
      .paginate({
        cursor: null,
        maximumBytesRead: CONTENT_ANALYTICS_PAGE_BYTES,
        maximumRowsRead: CONTENT_ANALYTICS_BATCH_SIZE,
        numItems: CONTENT_ANALYTICS_BATCH_SIZE,
      })
      .pipe(Effect.orDie);
    let processed = 0;
    const groups = groupMetricsQueueItems(
      queuePage.page,
      CONTENT_ANALYTICS_GROUP_SIZE
    );
    for (const group of groups) {
      yield* applyQueueGroup(ctx, group, now);
      processed += group.length;
      const metrics = yield* Effect.tryPromise({
        try: () => ctx.meta.getTransactionMetrics(),
        catch: toContentAnalyticsIoError,
      });
      if (!hasContentAnalyticsHeadroom(metrics)) {
        break;
      }
    }
    const hasMore = processed < queuePage.page.length || !queuePage.isDone;
    const leaseExpiresAt = hasMore
      ? now + CONTENT_ANALYTICS_LEASE_DURATION_MS
      : 0;
    yield* writer
      .table("contentAnalyticsPartitions")
      .patch(partitionRow._id, {
        lastProcessedAt: now,
        leaseExpiresAt,
      })
      .pipe(Effect.orDie);
    if (hasMore) {
      yield* scheduler
        .runAfter(
          Duration.millis(0),
          refs.internal.contents.mutations.analytics
            .processContentAnalyticsPartition,
          args
        )
        .pipe(Effect.catchDefect(flow(toContentAnalyticsIoError, Effect.fail)));
    }
    yield* Effect.logInfo("Processed content analytics partition batch").pipe(
      Effect.annotateLogs({
        hasMore,
        partition: args.partition,
        processed,
      })
    );
    return {
      hasMore,
      partition: args.partition,
      processed,
      skipped: false,
    };
  },
  Effect.catchDefect(flow(toContentAnalyticsIoError, Effect.fail))
);
