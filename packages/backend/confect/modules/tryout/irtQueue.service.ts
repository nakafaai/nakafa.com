import type { Id } from "@repo/backend/confect/_generated/dataModel";
import refs from "@repo/backend/confect/_generated/refs";
import {
  DatabaseReader,
  DatabaseWriter,
  MutationCtx,
  Scheduler,
} from "@repo/backend/confect/_generated/services";
import {
  IRT_CALIBRATION_QUEUE_BATCH_SIZE,
  IRT_MAX_CALIBRATION_STALENESS_MS,
  IRT_MIN_COMPLETED_ATTEMPTS_FOR_RECALIBRATION,
  IRT_QUEUE_CLEANUP_BATCH_SIZE,
} from "@repo/backend/confect/modules/tryout/irt.policy";
import { prepareCalibrationCacheForSet } from "@repo/backend/confect/modules/tryout/irtCache.service";
import {
  cleanupCalibrationQueueEntriesBatch,
  cleanupScalePublicationQueueEntriesBatch,
  startCalibrationRunWorkflow,
} from "@repo/backend/confect/modules/tryout/irtQueueHelpers.service";
import { Clock, Duration, Effect, Option } from "effect";

/** Enqueues one tryout for serialized scale publication. */
export const enqueueScalePublication = Effect.fnUntraced(function* (args: {
  readonly tryoutId: Id<"tryouts">;
}) {
  const reader = yield* DatabaseReader;
  const writer = yield* DatabaseWriter;
  const existingEntry = yield* reader
    .table("irtScalePublicationQueue")
    .index("by_tryoutId_and_enqueuedAt", (query) =>
      query.eq("tryoutId", args.tryoutId)
    )
    .first()
    .pipe(Effect.map(Option.getOrNull));

  if (existingEntry) {
    return null;
  }

  const enqueuedAt = yield* Clock.currentTimeMillis;
  yield* writer.table("irtScalePublicationQueue").insert({
    enqueuedAt,
    tryoutId: args.tryoutId,
  });

  return null;
});

/** Drains pending calibration queue entries and starts eligible calibration workflows. */
export const drainCalibrationQueue = Effect.fnUntraced(function* () {
  const ctx = yield* MutationCtx;
  const reader = yield* DatabaseReader;
  const scheduler = yield* Scheduler;
  const now = yield* Clock.currentTimeMillis;
  const queueEntries = yield* reader
    .table("irtCalibrationQueue")
    .index("by_enqueuedAt")
    .take(
      IRT_CALIBRATION_QUEUE_BATCH_SIZE *
        IRT_MIN_COMPLETED_ATTEMPTS_FOR_RECALIBRATION
    );
  const distinctSetIds = [
    ...new Set(queueEntries.map((entry) => entry.setId)),
  ].slice(0, IRT_CALIBRATION_QUEUE_BATCH_SIZE);

  for (const setId of distinctSetIds) {
    const cacheIsWithinLimit = yield* prepareCalibrationCacheForSet(setId);

    if (!cacheIsWithinLimit) {
      continue;
    }

    const [latestCompletedRun, latestRun] = yield* Effect.all(
      [
        reader
          .table("irtCalibrationRuns")
          .index(
            "by_setId_and_status_and_startedAt",
            (query) => query.eq("setId", setId).eq("status", "completed"),
            "desc"
          )
          .first()
          .pipe(Effect.map(Option.getOrNull)),
        reader
          .table("irtCalibrationRuns")
          .index(
            "by_setId_and_startedAt",
            (query) => query.eq("setId", setId),
            "desc"
          )
          .first()
          .pipe(Effect.map(Option.getOrNull)),
      ],
      { concurrency: "unbounded" }
    );

    if (latestRun?.status === "running") {
      continue;
    }

    const lastSuccessfulRunStartedAt = latestCompletedRun?.startedAt;
    const pendingQueueEntries = yield* reader
      .table("irtCalibrationQueue")
      .index("by_setId_and_enqueuedAt", (query) => {
        const setQuery = query.eq("setId", setId);

        if (lastSuccessfulRunStartedAt === undefined) {
          return setQuery;
        }

        return setQuery.gt("enqueuedAt", lastSuccessfulRunStartedAt);
      })
      .take(IRT_MIN_COMPLETED_ATTEMPTS_FOR_RECALIBRATION);

    if (pendingQueueEntries.length === 0) {
      if (lastSuccessfulRunStartedAt !== undefined) {
        yield* scheduler.runAfter(
          Duration.millis(0),
          refs.internal.irt.mutations.internalFunctions.queue
            .cleanupCalibrationQueueEntries,
          {
            setId,
            throughAt: lastSuccessfulRunStartedAt,
          }
        );
      }

      continue;
    }

    const oldestPendingQueueEntry = pendingQueueEntries[0];

    if (!oldestPendingQueueEntry) {
      continue;
    }

    const hasEnoughCompletedAttempts =
      pendingQueueEntries.length >=
      IRT_MIN_COMPLETED_ATTEMPTS_FOR_RECALIBRATION;
    const isStale =
      now - oldestPendingQueueEntry.enqueuedAt >=
      IRT_MAX_CALIBRATION_STALENESS_MS;

    if (!(hasEnoughCompletedAttempts || isStale)) {
      continue;
    }

    yield* startCalibrationRunWorkflow(ctx, setId);
  }

  return null;
});

/** Deletes stale calibration queue entries and reschedules when more rows remain. */
export const cleanupCalibrationQueueEntries = Effect.fnUntraced(
  function* (args: {
    readonly setId: Id<"exerciseSets">;
    readonly throughAt: number;
  }) {
    const scheduler = yield* Scheduler;
    const deletedCount = yield* cleanupCalibrationQueueEntriesBatch(args);

    if (deletedCount < IRT_QUEUE_CLEANUP_BATCH_SIZE) {
      return null;
    }

    yield* scheduler.runAfter(
      Duration.millis(0),
      refs.internal.irt.mutations.internalFunctions.queue
        .cleanupCalibrationQueueEntries,
      args
    );

    return null;
  }
);

/** Deletes scale publication queue entries and reschedules when more rows remain. */
export const cleanupScalePublicationQueueEntries = Effect.fnUntraced(
  function* (args: { readonly tryoutId: Id<"tryouts"> }) {
    const scheduler = yield* Scheduler;
    const deletedCount = yield* cleanupScalePublicationQueueEntriesBatch(
      args.tryoutId
    );

    if (deletedCount < IRT_QUEUE_CLEANUP_BATCH_SIZE) {
      return null;
    }

    yield* scheduler.runAfter(
      Duration.millis(0),
      refs.internal.irt.mutations.internalFunctions.queue
        .cleanupScalePublicationQueueEntries,
      args
    );

    return null;
  }
);
