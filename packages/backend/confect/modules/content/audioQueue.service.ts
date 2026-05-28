import { Ref } from "@confect/core";
import type { Id } from "@repo/backend/confect/_generated/dataModel";
import refs from "@repo/backend/confect/_generated/refs";
import {
  DatabaseReader,
  DatabaseWriter,
  MutationCtx,
} from "@repo/backend/confect/_generated/services";
import {
  AUDIO_CLEANUP_CONFIG,
  AUDIO_QUEUE_TIMEOUT_MS,
} from "@repo/backend/confect/modules/content/audioGeneration.constants";
import { readAudioGenerationEnvironment } from "@repo/backend/confect/modules/content/audioGeneration.env";
import { SUPPORTED_CONTENT_LOCALES } from "@repo/backend/confect/modules/content/content.schemas";
import { workflow } from "@repo/backend/confect/modules/operations/workflow";
import { Clock, Effect, Option, Schema } from "effect";

const AUDIO_QUEUE_PER_SLUG_LIMIT = SUPPORTED_CONTENT_LOCALES.length + 1;

export class AudioQueueError extends Schema.TaggedError<AudioQueueError>()(
  "AudioQueueError",
  { message: Schema.String }
) {}

/** Marks one audio queue item as completed. */
export const markQueueCompleted = Effect.fn("audioQueue.markQueueCompleted")(
  function* (queueItemId: Id<"audioGenerationQueue">) {
    const reader = yield* DatabaseReader;
    const writer = yield* DatabaseWriter;
    const item = yield* reader
      .table("audioGenerationQueue")
      .get(queueItemId)
      .pipe(Effect.catchTag("GetByIdFailure", () => Effect.succeed(null)));

    if (!item || item.status === "completed") {
      return null;
    }

    const now = yield* Clock.currentTimeMillis;
    yield* writer.table("audioGenerationQueue").patch(queueItemId, {
      completedAt: now,
      status: "completed",
      updatedAt: now,
    });

    return null;
  }
);

/** Marks one audio queue item failed or retryable. */
const setQueueItemFailed = Effect.fn("audioQueue.setQueueItemFailed")(
  function* (args: { error: string; queueItemId: Id<"audioGenerationQueue"> }) {
    const reader = yield* DatabaseReader;
    const writer = yield* DatabaseWriter;
    const item = yield* reader
      .table("audioGenerationQueue")
      .get(args.queueItemId)
      .pipe(Effect.catchTag("GetByIdFailure", () => Effect.succeed(null)));

    if (!item || item.status === "completed" || item.status === "failed") {
      return null;
    }

    const now = yield* Clock.currentTimeMillis;
    const retryCount = item.retryCount + 1;

    if (retryCount >= item.maxRetries) {
      yield* writer.table("audioGenerationQueue").patch(args.queueItemId, {
        errorMessage: `Max retries exceeded (${item.maxRetries}): ${args.error}`,
        lastErrorAt: now,
        retryCount,
        status: "failed",
        updatedAt: now,
      });
      return null;
    }

    yield* writer.table("audioGenerationQueue").patch(args.queueItemId, {
      errorMessage: args.error,
      lastErrorAt: now,
      retryCount,
      status: "pending",
      updatedAt: now,
    });

    return null;
  }
);

/** Locks one pending queue item for workflow processing. */
export const lockQueueItem = Effect.fn("audioQueue.lockQueueItem")(
  function* (args: { queueItemId: Id<"audioGenerationQueue"> }) {
    const reader = yield* DatabaseReader;
    const writer = yield* DatabaseWriter;
    const item = yield* reader
      .table("audioGenerationQueue")
      .get(args.queueItemId)
      .pipe(Effect.catchTag("GetByIdFailure", () => Effect.succeed(null)));

    if (!item) {
      return yield* Effect.fail(
        new AudioQueueError({ message: "Queue item not found." })
      );
    }

    if (item.status !== "pending") {
      return null;
    }

    const now = yield* Clock.currentTimeMillis;

    if (item.retryCount >= item.maxRetries) {
      yield* writer.table("audioGenerationQueue").patch(args.queueItemId, {
        errorMessage: `Exceeded maximum retry attempts (${item.maxRetries})`,
        status: "failed",
        updatedAt: now,
      });
      return null;
    }

    yield* writer.table("audioGenerationQueue").patch(args.queueItemId, {
      processingStartedAt: now,
      status: "processing",
      updatedAt: now,
    });

    return {
      contentRef: item.contentRef,
      locale: item.locale,
    };
  }
);

/** Marks a queue item failed from a workflow step. */
export const markQueueFailed = Effect.fn("audioQueue.markQueueFailed")(
  function* (args: { error: string; queueItemId: Id<"audioGenerationQueue"> }) {
    return yield* setQueueItemFailed(args);
  }
);

/** Starts workflows for the highest-priority pending content slug. */
export const startWorkflowsForPendingItems = Effect.fn(
  "audioQueue.startWorkflowsForPendingItems"
)(function* () {
  const ctx = yield* MutationCtx;
  const reader = yield* DatabaseReader;
  const audioGeneration = yield* readAudioGenerationEnvironment();

  if (!audioGeneration.enabled) {
    yield* Effect.logInfo("Audio generation skipped because it is disabled.");
    return { started: 0, skipped: 0 };
  }

  const now = yield* Clock.currentTimeMillis;
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);

  const completedToday = yield* reader
    .table("audioGenerationQueue")
    .index("by_status_and_completedAt", (query) =>
      query.eq("status", "completed").gte("completedAt", today.getTime())
    )
    .take(audioGeneration.maxContentPerDay + 10);
  const completedSlugs = new Set(completedToday.map((item) => item.slug));

  if (completedSlugs.size >= audioGeneration.maxContentPerDay) {
    yield* Effect.logInfo("Daily audio generation limit reached.", {
      completed: completedSlugs.size,
      limit: audioGeneration.maxContentPerDay,
    });
    return { started: 0, skipped: 0 };
  }

  const topItemOption = yield* reader
    .table("audioGenerationQueue")
    .index(
      "by_status_and_priorityScore",
      (query) => query.eq("status", "pending"),
      "desc"
    )
    .first();
  const topItem = Option.getOrNull(topItemOption);

  if (!topItem) {
    yield* Effect.logInfo("No pending audio queue items.");
    return { started: 0, skipped: 0 };
  }

  const contentItems = yield* reader
    .table("audioGenerationQueue")
    .index("by_slug_and_status", (query) =>
      query.eq("slug", topItem.slug).eq("status", "pending")
    )
    .take(AUDIO_QUEUE_PER_SLUG_LIMIT);

  if (contentItems.length > SUPPORTED_CONTENT_LOCALES.length) {
    return yield* Effect.fail(
      new AudioQueueError({
        message: "Audio queue slug exceeded the supported locale count.",
      })
    );
  }

  let started = 0;
  for (const item of contentItems) {
    yield* Effect.promise(() =>
      workflow.start(
        ctx,
        Ref.getFunctionReference(
          refs.internal.audioStudies.workflows.generateAudioForQueueItem
        ),
        { queueItemId: item._id },
        {
          context: { queueItemId: item._id },
          onComplete: Ref.getFunctionReference(
            refs.internal.audioStudies.workflows.handleWorkflowComplete
          ),
        }
      )
    );
    started += 1;
  }

  yield* Effect.logInfo("Started audio workflows for content slug.", {
    slug: topItem.slug,
    started,
  });

  return { contentRef: topItem.contentRef, skipped: 0, started };
});

/** Deletes old completed and failed queue rows. */
export const cleanup = Effect.fn("audioQueue.cleanup")(function* () {
  const reader = yield* DatabaseReader;
  const writer = yield* DatabaseWriter;
  const now = yield* Clock.currentTimeMillis;
  const cutoffDate =
    now - AUDIO_CLEANUP_CONFIG.retentionDays * 24 * 60 * 60 * 1000;
  const completedOldItems = yield* reader
    .table("audioGenerationQueue")
    .index("by_status_and_updatedAt", (query) =>
      query.eq("status", "completed").lt("updatedAt", cutoffDate)
    )
    .take(100);
  const failedOldItems = yield* reader
    .table("audioGenerationQueue")
    .index("by_status_and_updatedAt", (query) =>
      query.eq("status", "failed").lt("updatedAt", cutoffDate)
    )
    .take(100);
  let deleted = 0;

  for (const item of completedOldItems) {
    yield* writer.table("audioGenerationQueue").delete(item._id);
    deleted += 1;
  }

  for (const item of failedOldItems) {
    yield* writer.table("audioGenerationQueue").delete(item._id);
    deleted += 1;
  }

  if (deleted > 0) {
    yield* Effect.logInfo("Cleaned up old audio queue items.", { deleted });
  }

  return { deleted };
});

/** Resets timed-out processing items back to pending when retries remain. */
export const resetStuckQueueItems = Effect.fn(
  "audioQueue.resetStuckQueueItems"
)(function* () {
  const reader = yield* DatabaseReader;
  const writer = yield* DatabaseWriter;
  const now = yield* Clock.currentTimeMillis;
  const stuckThreshold = now - AUDIO_QUEUE_TIMEOUT_MS;
  const stuckItems = yield* reader
    .table("audioGenerationQueue")
    .index("by_status_and_updatedAt", (query) =>
      query.eq("status", "processing").lt("updatedAt", stuckThreshold)
    )
    .take(50);
  let reset = 0;

  for (const item of stuckItems) {
    if (item.retryCount >= item.maxRetries) {
      continue;
    }

    yield* writer.table("audioGenerationQueue").patch(item._id, {
      retryCount: item.retryCount + 1,
      status: "pending",
      updatedAt: now,
    });
    reset += 1;
  }

  if (reset > 0) {
    yield* Effect.logInfo("Reset stuck audio queue items.", { reset });
  }

  return { reset };
});
