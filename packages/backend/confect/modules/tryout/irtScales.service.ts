import type { Id } from "@repo/backend/confect/_generated/dataModel";
import refs from "@repo/backend/confect/_generated/refs";
import {
  DatabaseReader,
  DatabaseWriter,
  Scheduler,
} from "@repo/backend/confect/_generated/services";
import {
  IRT_SCALE_PUBLICATION_QUEUE_BATCH_SIZE,
  IRT_SCALE_QUALITY_REFRESH_QUEUE_BATCH_SIZE,
} from "@repo/backend/confect/modules/tryout/irt.policy";
import { enqueueScaleQualityRefresh } from "@repo/backend/confect/modules/tryout/irtQueueHelpers.service";
import { publishTryoutScaleVersionIfNeeded } from "@repo/backend/confect/modules/tryout/irtScalePublish.service";
import { refreshTryoutScaleQualityCheck } from "@repo/backend/confect/modules/tryout/irtScaleQuality.service";
import { Clock, Duration, Effect, Option } from "effect";

const SCALE_QUALITY_REBUILD_BATCH_SIZE = 100;

/** Schedules a scale quality queue drain. */
function scheduleScaleQualityDrain() {
  return Effect.gen(function* () {
    const scheduler = yield* Scheduler;

    return yield* scheduler.runAfter(
      Duration.millis(0),
      refs.internal.irt.mutations.internalFunctions.scales
        .drainScaleQualityRefreshQueue,
      {}
    );
  });
}

/** Refreshes one tryout quality check and requeues rows when the refresh fails. */
export const refreshScaleQualityCheck = Effect.fnUntraced(function* (args: {
  readonly tryoutId: Id<"tryouts">;
}) {
  const reader = yield* DatabaseReader;
  const writer = yield* DatabaseWriter;
  const queueEntries = yield* reader
    .table("irtScaleQualityRefreshQueue")
    .index("by_tryoutId", (query) => query.eq("tryoutId", args.tryoutId))
    .take(IRT_SCALE_QUALITY_REFRESH_QUEUE_BATCH_SIZE);

  yield* refreshTryoutScaleQualityCheck(args.tryoutId).pipe(
    Effect.flatMap(() =>
      Effect.gen(function* () {
        for (const queueEntry of queueEntries) {
          yield* writer
            .table("irtScaleQualityRefreshQueue")
            .delete(queueEntry._id);
        }

        return null;
      })
    ),
    Effect.catchAllCause(() =>
      Effect.gen(function* () {
        const requeuedAt = yield* Clock.currentTimeMillis;

        for (const queueEntry of queueEntries) {
          yield* writer
            .table("irtScaleQualityRefreshQueue")
            .replace(queueEntry._id, {
              enqueuedAt: requeuedAt,
              tryoutId: queueEntry.tryoutId,
            });
        }

        return null;
      })
    )
  );

  return null;
});

/** Enqueues scale-quality refresh rows for every tryout through paginated batches. */
export const rebuildScaleQualityChecksPage = Effect.fnUntraced(
  function* (args: { readonly cursor?: string }) {
    const reader = yield* DatabaseReader;
    const scheduler = yield* Scheduler;
    const enqueuedAt = yield* Clock.currentTimeMillis;
    let enqueuedAny = false;
    const page = yield* reader
      .table("tryouts")
      .index("by_syncedAt")
      .paginate({
        cursor: args.cursor ?? null,
        numItems: SCALE_QUALITY_REBUILD_BATCH_SIZE,
      });

    for (const tryout of page.page) {
      const pendingScalePublication = yield* reader
        .table("irtScalePublicationQueue")
        .index("by_tryoutId_and_enqueuedAt", (query) =>
          query.eq("tryoutId", tryout._id)
        )
        .first();

      if (Option.isSome(pendingScalePublication)) {
        continue;
      }

      const enqueued = yield* enqueueScaleQualityRefresh({
        enqueuedAt,
        tryoutId: tryout._id,
      });
      enqueuedAny = enqueuedAny || enqueued;
    }

    if (!page.isDone) {
      yield* scheduler.runAfter(
        Duration.millis(0),
        refs.internal.irt.mutations.internalFunctions.scales
          .rebuildScaleQualityChecksPage,
        { cursor: page.continueCursor }
      );
    }

    if (page.isDone && (args.cursor !== undefined || enqueuedAny)) {
      yield* scheduleScaleQualityDrain();
    }

    return {
      isDone: page.isDone,
      processedCount: page.page.length,
    };
  }
);

/** Claims scale-quality refresh rows and schedules per-tryout refresh mutations. */
export const drainScaleQualityRefreshQueue = Effect.fnUntraced(function* () {
  const reader = yield* DatabaseReader;
  const writer = yield* DatabaseWriter;
  const scheduler = yield* Scheduler;
  const processingStartedAt = yield* Clock.currentTimeMillis;
  const queueEntries = yield* reader
    .table("irtScaleQualityRefreshQueue")
    .index("by_processingStartedAt_and_enqueuedAt", (query) =>
      query.eq("processingStartedAt", undefined)
    )
    .take(IRT_SCALE_QUALITY_REFRESH_QUEUE_BATCH_SIZE);

  if (queueEntries.length === 0) {
    return {
      processedCount: 0,
      scheduledCount: 0,
    };
  }

  const tryoutIds = [...new Set(queueEntries.map((entry) => entry.tryoutId))];

  for (const queueEntry of queueEntries) {
    yield* writer.table("irtScaleQualityRefreshQueue").patch(queueEntry._id, {
      processingStartedAt,
    });
  }

  for (const tryoutId of tryoutIds) {
    yield* scheduler.runAfter(
      Duration.millis(0),
      refs.internal.irt.mutations.internalFunctions.scales
        .refreshScaleQualityCheck,
      { tryoutId }
    );
  }

  if (queueEntries.length === IRT_SCALE_QUALITY_REFRESH_QUEUE_BATCH_SIZE) {
    yield* scheduleScaleQualityDrain();
  }

  return {
    processedCount: queueEntries.length,
    scheduledCount: tryoutIds.length,
  };
});

/** Publishes pending scales and schedules quality refresh cleanup. */
export const drainScalePublicationQueue = Effect.fnUntraced(function* () {
  const reader = yield* DatabaseReader;
  const scheduler = yield* Scheduler;
  const enqueuedAt = yield* Clock.currentTimeMillis;
  const queueEntries = yield* reader
    .table("irtScalePublicationQueue")
    .index("by_enqueuedAt")
    .take(IRT_SCALE_PUBLICATION_QUEUE_BATCH_SIZE);
  const distinctTryoutIds = [
    ...new Set(queueEntries.map((entry) => entry.tryoutId)),
  ];

  for (const tryoutId of distinctTryoutIds) {
    yield* publishTryoutScaleVersionIfNeeded(tryoutId);
    yield* enqueueScaleQualityRefresh({ enqueuedAt, tryoutId });
    yield* scheduler.runAfter(
      Duration.millis(0),
      refs.internal.irt.mutations.internalFunctions.queue
        .cleanupScalePublicationQueueEntries,
      { tryoutId }
    );
  }

  if (distinctTryoutIds.length > 0) {
    yield* scheduleScaleQualityDrain();
  }

  return null;
});
