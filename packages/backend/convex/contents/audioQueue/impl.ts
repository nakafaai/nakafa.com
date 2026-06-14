import type {
  ActionCtx,
  MutationCtx,
} from "@repo/backend/convex/_generated/server";
import {
  isAudioGenerationEnabled,
  MIN_VIEW_THRESHOLD,
  RETRY_CONFIG,
} from "@repo/backend/convex/audioStudies/constants";
import { getAudioContentSourceByLocale } from "@repo/backend/convex/audioStudies/helpers/sources";
import {
  AudioQueuePopulationError,
  audioQueuePopulationFailedCode,
  type EnqueuePopularContentForAudioArgs,
  type EnqueuePopularContentForAudioResult,
} from "@repo/backend/convex/contents/audioQueue/spec";
import type { PopularAudioContentItem } from "@repo/backend/convex/contents/validators";
import { getUnknownErrorMessage } from "@repo/backend/convex/lib/effect";
import { SUPPORTED_CONTENT_LOCALES } from "@repo/backend/convex/lib/validators/contents";
import { logger } from "@repo/backend/convex/utils/logger";
import type { FunctionReference } from "convex/server";
import { Clock, Effect } from "effect";

const audioQueueMutationBatchSize = 10;

/** Maps internal read/write failures into the audio queue error channel. */
function toAudioQueuePopulationError(error: unknown) {
  return new AudioQueuePopulationError({
    code: audioQueuePopulationFailedCode,
    message: getUnknownErrorMessage(error),
  });
}

/** Internal Convex functions used by the audio queue population action. */
export interface AudioQueuePopulationTargets {
  readonly enqueuePopularContent: FunctionReference<
    "mutation",
    "internal",
    EnqueuePopularContentForAudioArgs,
    EnqueuePopularContentForAudioResult
  >;
  readonly readPopularContent: FunctionReference<
    "query",
    "internal",
    Record<string, never>,
    PopularAudioContentItem[]
  >;
}

type AudioQueueActionCtx = Pick<ActionCtx, "runMutation" | "runQuery">;

/** Splits popular audio candidates into bounded write transactions. */
export function chunkPopularAudioItems(items: PopularAudioContentItem[]) {
  const chunks: PopularAudioContentItem[][] = [];

  for (
    let index = 0;
    index < items.length;
    index += audioQueueMutationBatchSize
  ) {
    chunks.push(items.slice(index, index + audioQueueMutationBatchSize));
  }

  return chunks;
}

/** Returns whether an existing audio queue row still owns generation work. */
function isActiveAudioQueueStatus(status: string) {
  return status === "pending" || status === "processing" || status === "failed";
}

/**
 * Queues locale-specific audio work from already-ranked popularity items.
 *
 * The mutation keeps queue writes native Convex and only imports local content
 * lookup helpers. Provider calls stay in the Node action path.
 * @see https://docs.convex.dev/functions/actions
 */
export const enqueuePopularAudioContent = Effect.fn(
  "contents.audioQueue.enqueuePopularAudioContent"
)(function* (ctx: MutationCtx, args: EnqueuePopularContentForAudioArgs) {
  if (args.items.length === 0) {
    return { processed: 0, queued: 0 };
  }

  let totalQueued = 0;
  const now = yield* Clock.currentTimeMillis;
  const sortedItems = [...args.items].sort(
    (left, right) => right.viewCount - left.viewCount
  );

  for (const item of sortedItems) {
    if (item.viewCount < MIN_VIEW_THRESHOLD) {
      break;
    }

    const sourceContent = item.sourceContent;

    for (const locale of SUPPORTED_CONTENT_LOCALES) {
      const localizedContent = yield* Effect.tryPromise({
        try: () => getAudioContentSourceByLocale(ctx, sourceContent, locale),
        catch: toAudioQueuePopulationError,
      });

      if (!localizedContent) {
        yield* Effect.sync(() =>
          logger.debug("Locale content not found", {
            contentId: sourceContent.content_id,
            contentType: sourceContent.contentType,
            locale,
          })
        );
        continue;
      }

      const existingQueueItem = yield* Effect.tryPromise({
        try: () =>
          ctx.db
            .query("audioGenerationQueue")
            .withIndex("by_content_id_and_locale", (q) =>
              q
                .eq("content_id", localizedContent.content_id)
                .eq("locale", locale)
            )
            .first(),
        catch: toAudioQueuePopulationError,
      });

      if (existingQueueItem) {
        if (isActiveAudioQueueStatus(existingQueueItem.status)) {
          yield* Effect.sync(() =>
            logger.debug("Already in queue", {
              contentId: localizedContent.content_id,
              contentType: localizedContent.contentType,
              locale,
              status: existingQueueItem.status,
            })
          );
          continue;
        }

        yield* Effect.sync(() =>
          logger.info("Replacing completed queue item", {
            contentId: localizedContent.content_id,
            contentType: localizedContent.contentType,
            locale,
          })
        );
        yield* Effect.tryPromise({
          try: () =>
            ctx.db.delete("audioGenerationQueue", existingQueueItem._id),
          catch: toAudioQueuePopulationError,
        });
      }

      const existingAudio = yield* Effect.tryPromise({
        try: () =>
          ctx.db
            .query("contentAudios")
            .withIndex("by_content_id_and_locale", (q) =>
              q
                .eq("content_id", localizedContent.content_id)
                .eq("locale", locale)
            )
            .first(),
        catch: toAudioQueuePopulationError,
      });

      if (
        existingAudio?.status === "completed" &&
        existingAudio.contentHash === localizedContent.contentHash
      ) {
        yield* Effect.sync(() =>
          logger.debug("Audio already completed for hash", {
            contentId: localizedContent.content_id,
            contentType: localizedContent.contentType,
            locale,
          })
        );
        continue;
      }

      yield* Effect.tryPromise({
        try: () =>
          ctx.db.insert("audioGenerationQueue", {
            alignmentId: localizedContent.alignmentId,
            assetId: localizedContent.assetId,
            conceptId: localizedContent.conceptId,
            content_id: localizedContent.content_id,
            contentType: localizedContent.contentType,
            learningObjectId: localizedContent.learningObjectId,
            lensId: localizedContent.lensId,
            locale,
            maxRetries: RETRY_CONFIG.maxRetries,
            priorityScore: item.viewCount * 10,
            requestedAt: now,
            retryCount: 0,
            route: sourceContent.route,
            status: "pending",
            updatedAt: now,
          }),
        catch: toAudioQueuePopulationError,
      });

      yield* Effect.sync(() =>
        logger.info("Added to queue", {
          contentId: localizedContent.content_id,
          contentType: localizedContent.contentType,
          locale,
          priorityScore: item.viewCount * 10,
        })
      );

      totalQueued++;
    }
  }

  return { processed: sortedItems.length, queued: totalQueued };
});

/**
 * Reads popularity in a query, then enqueues audio work in separate mutations.
 */
export const populateAudioGenerationQueue = Effect.fn(
  "contents.audioQueue.populateAudioGenerationQueue"
)(function* (ctx: AudioQueueActionCtx, targets: AudioQueuePopulationTargets) {
  if (!isAudioGenerationEnabled()) {
    yield* Effect.sync(() =>
      logger.info(
        "Audio queue population skipped - ENABLE_AUDIO_GENERATION not set"
      )
    );
    return null;
  }

  yield* Effect.sync(() => logger.info("Populating audio queue started"));

  const items = yield* Effect.tryPromise({
    try: () => ctx.runQuery(targets.readPopularContent, {}),
    catch: toAudioQueuePopulationError,
  });

  if (items.length === 0) {
    yield* Effect.sync(() =>
      logger.info("No popular content found for audio queue population")
    );
    return null;
  }

  let processed = 0;
  let queued = 0;
  const chunks = chunkPopularAudioItems(items);

  for (const chunk of chunks) {
    const result = yield* Effect.tryPromise({
      try: () =>
        ctx.runMutation(targets.enqueuePopularContent, {
          items: chunk,
        }),
      catch: toAudioQueuePopulationError,
    });

    processed += result.processed;
    queued += result.queued;
  }

  yield* Effect.sync(() =>
    logger.info("Populated audio queue completed", {
      batches: chunks.length,
      processed,
      queued,
    })
  );

  return null;
});
