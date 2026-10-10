import refs from "@repo/backend/confect/_generated/refs";
import {
  DatabaseReader,
  DatabaseWriter,
  Scheduler,
} from "@repo/backend/confect/_generated/services";
import {
  InvalidContentAnalyticsPartitionError,
  invalidContentAnalyticsPartitionCode,
  type ScheduleContentAnalyticsPartitionArgs,
  toContentAnalyticsIoError,
} from "@repo/backend/confect/contents/analytics/spec";
import {
  CONTENT_ANALYTICS_LEASE_DURATION_MS,
  CONTENT_ANALYTICS_PARTITIONS,
} from "@repo/backend/confect/contents/constants";
import { isContentAnalyticsPartition } from "@repo/backend/confect/contents/partitions";
import { Clock, Duration, Effect, flow, Option } from "effect";

/** Generated internal mutation reference that claims analytics partitions. */

/** Generated worker reference started after one partition lease is claimed. */

/** Recovers every non-empty partition through one indexed existence read. */
export const scheduleAllContentAnalyticsPartitions = Effect.fn(
  "contents.analytics.scheduleAllContentAnalyticsPartitions"
)(
  function* () {
    const scheduler = yield* Scheduler;
    const database = yield* DatabaseReader;
    let enqueuedPartitions = 0;
    for (const partition of CONTENT_ANALYTICS_PARTITIONS) {
      const queuedItem = yield* database
        .table("learningEngagementQueue")
        .index("by_partition_and_insertedAt", (q) =>
          q.eq("partition", partition)
        )
        .first()
        .pipe(Effect.map(Option.getOrNull), Effect.orDie);
      if (!queuedItem) {
        continue;
      }
      yield* scheduler
        .runAfter(
          Duration.millis(0),
          refs.internal.contents.mutations.analytics
            .scheduleContentAnalyticsPartition,
          {
            partition,
          }
        )
        .pipe(Effect.catchDefect(flow(toContentAnalyticsIoError, Effect.fail)));
      enqueuedPartitions += 1;
    }
    return {
      enqueuedPartitions,
    };
  },
  Effect.catchDefect(flow(toContentAnalyticsIoError, Effect.fail))
);

/**
 * Claims one partition lease and starts one bounded drain worker.
 *
 * The queue existence read intentionally happens before the lease write so cron
 * jobs do not create OCC contention on empty partitions.
 * @see https://docs.convex.dev/database/advanced/occ
 */
export const claimContentAnalyticsPartition = Effect.fn(
  "contents.analytics.claimContentAnalyticsPartition"
)(
  function* (args: ScheduleContentAnalyticsPartitionArgs) {
    const scheduler = yield* Scheduler;
    const database = yield* DatabaseReader;
    const writer = yield* DatabaseWriter;
    if (!isContentAnalyticsPartition(args.partition)) {
      return yield* new InvalidContentAnalyticsPartitionError({
        code: invalidContentAnalyticsPartitionCode,
        message: "Content analytics partition is out of range.",
      });
    }
    const queuedItem = yield* database
      .table("learningEngagementQueue")
      .index("by_partition_and_insertedAt", (q) =>
        q.eq("partition", args.partition)
      )
      .first()
      .pipe(Effect.map(Option.getOrNull), Effect.orDie);
    if (!queuedItem) {
      return {
        createdPartition: false,
        scheduled: false,
      };
    }
    const now = yield* Clock.currentTimeMillis;
    const partitionRow = yield* database
      .table("contentAnalyticsPartitions")
      .get("by_partition", args.partition)
      .pipe(
        Effect.catchTag("GetByIndexFailure", () => Effect.succeed(null)),
        Effect.orDie
      );
    let createdPartition = false;
    let partitionRowId = partitionRow?._id;
    const leaseExpiresAt = partitionRow?.leaseExpiresAt ?? 0;
    let leaseVersion = partitionRow?.leaseVersion ?? 0;
    if (leaseExpiresAt > now) {
      return {
        createdPartition,
        scheduled: false,
      };
    }
    if (!partitionRowId) {
      partitionRowId = yield* writer
        .table("contentAnalyticsPartitions")
        .insert({
          leaseExpiresAt: 0,
          leaseVersion: 0,
          partition: args.partition,
        })
        .pipe(Effect.orDie);
      createdPartition = true;
    }
    leaseVersion += 1;
    yield* writer
      .table("contentAnalyticsPartitions")
      .patch(partitionRowId, {
        leaseExpiresAt: now + CONTENT_ANALYTICS_LEASE_DURATION_MS,
        leaseVersion,
      })
      .pipe(Effect.orDie);
    yield* scheduler
      .runAfter(
        Duration.millis(0),
        refs.internal.contents.mutations.analytics
          .processContentAnalyticsPartition,
        {
          leaseVersion,
          partition: args.partition,
        }
      )
      .pipe(Effect.catchDefect(flow(toContentAnalyticsIoError, Effect.fail)));
    return {
      createdPartition,
      scheduled: true,
    };
  },
  Effect.catchDefect(flow(toContentAnalyticsIoError, Effect.fail))
);
