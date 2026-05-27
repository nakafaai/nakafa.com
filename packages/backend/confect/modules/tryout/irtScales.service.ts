import { Ref } from "@confect/core";
import type { Id } from "@repo/backend/confect/_generated/dataModel";
import refs from "@repo/backend/confect/_generated/refs";
import { MutationCtx } from "@repo/backend/confect/_generated/services";
import type { ConvexMutationCtx } from "@repo/backend/confect/modules/shared/convexContext";
import {
  IRT_SCALE_PUBLICATION_QUEUE_BATCH_SIZE,
  IRT_SCALE_QUALITY_REFRESH_QUEUE_BATCH_SIZE,
} from "@repo/backend/confect/modules/tryout/irt.policy";
import { enqueueScaleQualityRefresh } from "@repo/backend/confect/modules/tryout/irtQueueHelpers.service";
import { publishTryoutScaleVersionIfNeeded } from "@repo/backend/confect/modules/tryout/irtScalePublish.service";
import { refreshTryoutScaleQualityCheck } from "@repo/backend/confect/modules/tryout/irtScaleQuality.service";
import { Clock, Effect } from "effect";

const SCALE_QUALITY_REBUILD_BATCH_SIZE = 100;

/** Schedules a scale quality queue drain. */
function scheduleScaleQualityDrain(ctx: ConvexMutationCtx) {
  return Effect.promise(() =>
    ctx.scheduler.runAfter(
      0,
      Ref.getFunctionReference(
        refs.internal.irt.mutations.internalFunctions.scales
          .drainScaleQualityRefreshQueue
      ),
      {}
    )
  );
}

/** Refreshes one tryout quality check and requeues rows when the refresh fails. */
export const refreshScaleQualityCheck = Effect.fn(
  "irt.scales.refreshScaleQualityCheck"
)(function* (args: { readonly tryoutId: Id<"tryouts"> }) {
  const ctx = yield* MutationCtx;
  const queueEntries = yield* Effect.promise(() =>
    ctx.db
      .query("irtScaleQualityRefreshQueue")
      .withIndex("by_tryoutId", (query) => query.eq("tryoutId", args.tryoutId))
      .take(IRT_SCALE_QUALITY_REFRESH_QUEUE_BATCH_SIZE)
  );

  yield* refreshTryoutScaleQualityCheck(ctx.db, args.tryoutId).pipe(
    Effect.flatMap(() =>
      Effect.gen(function* () {
        for (const queueEntry of queueEntries) {
          yield* Effect.promise(() => ctx.db.delete(queueEntry._id));
        }

        return null;
      })
    ),
    Effect.catchAllCause((cause) =>
      Effect.gen(function* () {
        const requeuedAt = yield* Clock.currentTimeMillis;

        for (const queueEntry of queueEntries) {
          yield* Effect.promise(() =>
            ctx.db.replace(queueEntry._id, {
              enqueuedAt: requeuedAt,
              tryoutId: queueEntry.tryoutId,
            })
          );
        }

        yield* Effect.logError("Scale quality refresh failed", cause);
        return null;
      })
    )
  );

  return null;
});

/** Enqueues scale-quality refresh rows for every tryout through paginated batches. */
export const rebuildScaleQualityChecksPage = Effect.fn(
  "irt.scales.rebuildScaleQualityChecksPage"
)(function* (args: { readonly cursor?: string }) {
  const ctx = yield* MutationCtx;
  const enqueuedAt = yield* Clock.currentTimeMillis;
  let enqueuedAny = false;
  const page = yield* Effect.promise(() =>
    ctx.db.query("tryouts").paginate({
      cursor: args.cursor ?? null,
      numItems: SCALE_QUALITY_REBUILD_BATCH_SIZE,
    })
  );

  for (const tryout of page.page) {
    const pendingScalePublication = yield* Effect.promise(() =>
      ctx.db
        .query("irtScalePublicationQueue")
        .withIndex("by_tryoutId_and_enqueuedAt", (query) =>
          query.eq("tryoutId", tryout._id)
        )
        .first()
    );

    if (pendingScalePublication) {
      continue;
    }

    const enqueued = yield* enqueueScaleQualityRefresh(ctx, {
      enqueuedAt,
      tryoutId: tryout._id,
    });
    enqueuedAny = enqueuedAny || enqueued;
  }

  if (!page.isDone) {
    yield* Effect.promise(() =>
      ctx.scheduler.runAfter(
        0,
        Ref.getFunctionReference(
          refs.internal.irt.mutations.internalFunctions.scales
            .rebuildScaleQualityChecksPage
        ),
        { cursor: page.continueCursor }
      )
    );
  }

  if (page.isDone && (args.cursor !== undefined || enqueuedAny)) {
    yield* scheduleScaleQualityDrain(ctx);
  }

  return {
    isDone: page.isDone,
    processedCount: page.page.length,
  };
});

/** Claims scale-quality refresh rows and schedules per-tryout refresh mutations. */
export const drainScaleQualityRefreshQueue = Effect.fn(
  "irt.scales.drainScaleQualityRefreshQueue"
)(function* () {
  const ctx = yield* MutationCtx;
  const processingStartedAt = yield* Clock.currentTimeMillis;
  const queueEntries = yield* Effect.promise(() =>
    ctx.db
      .query("irtScaleQualityRefreshQueue")
      .withIndex("by_processingStartedAt_and_enqueuedAt", (query) =>
        query.eq("processingStartedAt", undefined)
      )
      .take(IRT_SCALE_QUALITY_REFRESH_QUEUE_BATCH_SIZE)
  );

  if (queueEntries.length === 0) {
    return {
      processedCount: 0,
      scheduledCount: 0,
    };
  }

  const tryoutIds = [...new Set(queueEntries.map((entry) => entry.tryoutId))];

  for (const queueEntry of queueEntries) {
    yield* Effect.promise(() =>
      ctx.db.patch(queueEntry._id, {
        processingStartedAt,
      })
    );
  }

  for (const tryoutId of tryoutIds) {
    yield* Effect.promise(() =>
      ctx.scheduler.runAfter(
        0,
        Ref.getFunctionReference(
          refs.internal.irt.mutations.internalFunctions.scales
            .refreshScaleQualityCheck
        ),
        { tryoutId }
      )
    );
  }

  if (queueEntries.length === IRT_SCALE_QUALITY_REFRESH_QUEUE_BATCH_SIZE) {
    yield* scheduleScaleQualityDrain(ctx);
  }

  return {
    processedCount: queueEntries.length,
    scheduledCount: tryoutIds.length,
  };
});

/** Publishes pending scales and schedules quality refresh cleanup. */
export const drainScalePublicationQueue = Effect.fn(
  "irt.scales.drainScalePublicationQueue"
)(function* () {
  const ctx = yield* MutationCtx;
  const enqueuedAt = yield* Clock.currentTimeMillis;
  const queueEntries = yield* Effect.promise(() =>
    ctx.db
      .query("irtScalePublicationQueue")
      .withIndex("by_enqueuedAt")
      .take(IRT_SCALE_PUBLICATION_QUEUE_BATCH_SIZE)
  );
  const distinctTryoutIds = [
    ...new Set(queueEntries.map((entry) => entry.tryoutId)),
  ];

  for (const tryoutId of distinctTryoutIds) {
    yield* publishTryoutScaleVersionIfNeeded(ctx, tryoutId);
    yield* enqueueScaleQualityRefresh(ctx, { enqueuedAt, tryoutId });
    yield* Effect.promise(() =>
      ctx.scheduler.runAfter(
        0,
        Ref.getFunctionReference(
          refs.internal.irt.mutations.internalFunctions.queue
            .cleanupScalePublicationQueueEntries
        ),
        { tryoutId }
      )
    );
  }

  if (distinctTryoutIds.length > 0) {
    yield* scheduleScaleQualityDrain(ctx);
  }

  return null;
});
