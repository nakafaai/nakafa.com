import { Ref } from "@confect/core";
import refs from "@repo/backend/confect/_generated/refs";
import {
  ActionCtx,
  MutationCtx,
  QueryCtx,
} from "@repo/backend/confect/_generated/services";
import type { AudioContentRef } from "@repo/backend/confect/modules/content/audio.schemas";
import {
  type AudioContentLookup,
  getAudioContentLookup,
  readAudioContentLookup,
  readLocalizedAudioContentLookup,
} from "@repo/backend/confect/modules/content/audioContentLookup.service";
import {
  AUDIO_RETRY_CONFIG,
  MAX_AUDIO_QUEUE_POPULAR_ITEMS_PER_TYPE,
  MIN_AUDIO_VIEW_THRESHOLD,
} from "@repo/backend/confect/modules/content/audioGeneration.constants";
import { SUPPORTED_CONTENT_LOCALES } from "@repo/backend/confect/modules/content/content.schemas";
import { Clock, Effect } from "effect";

interface PopularAudioItem {
  readonly ref: AudioContentRef;
  readonly sourceContent?: AudioContentLookup;
  readonly viewCount: number;
}

/** Merges duplicate popular content candidates and keeps the highest view count. */
function mergePopularAudioContentItems(items: readonly PopularAudioItem[]) {
  const mergedItems = new Map<string, PopularAudioItem>();

  for (const item of items) {
    const key = item.sourceContent
      ? `${item.sourceContent.ref.type}:${item.sourceContent.slug}`
      : `${item.ref.type}:${item.ref.id}`;
    const existingItem = mergedItems.get(key);

    if (!existingItem || item.viewCount > existingItem.viewCount) {
      mergedItems.set(key, item);
    }
  }

  return Array.from(mergedItems.values())
    .filter((item) => item.viewCount >= MIN_AUDIO_VIEW_THRESHOLD)
    .sort((left, right) => right.viewCount - left.viewCount)
    .slice(0, MAX_AUDIO_QUEUE_POPULAR_ITEMS_PER_TYPE * 2);
}

/** Reads popular article and subject rows eligible for audio queueing. */
export const getPopularContentForAudioQueue = Effect.fn(
  "popularAudio.getPopularContentForAudioQueue"
)(function* () {
  const ctx = yield* QueryCtx;
  const [articleRows, subjectRows] = yield* Effect.promise(() =>
    Promise.all([
      ctx.db
        .query("articlePopularity")
        .withIndex("by_viewCount_and_contentId")
        .order("desc")
        .take(MAX_AUDIO_QUEUE_POPULAR_ITEMS_PER_TYPE),
      ctx.db
        .query("subjectPopularity")
        .withIndex("by_viewCount_and_contentId")
        .order("desc")
        .take(MAX_AUDIO_QUEUE_POPULAR_ITEMS_PER_TYPE),
    ])
  );
  const articleItems = yield* Effect.forEach(articleRows, (row) =>
    Effect.gen(function* () {
      const sourceContent = yield* getAudioContentLookup({
        id: row.contentId,
        type: "article",
      });

      if (!sourceContent) {
        return null;
      }

      return {
        ref: sourceContent.ref,
        sourceContent,
        viewCount: row.viewCount,
      };
    })
  );
  const subjectItems = yield* Effect.forEach(subjectRows, (row) =>
    Effect.gen(function* () {
      const sourceContent = yield* getAudioContentLookup({
        id: row.contentId,
        type: "subject",
      });

      if (!sourceContent) {
        return null;
      }

      return {
        ref: sourceContent.ref,
        sourceContent,
        viewCount: row.viewCount,
      };
    })
  );
  const sourceItems = [...articleItems, ...subjectItems].filter(
    (item) => item !== null
  );

  return mergePopularAudioContentItems(sourceItems);
});

/** Inserts pending audio queue rows for popular content. */
export const enqueuePopularContentForAudio = Effect.fn(
  "popularAudio.enqueuePopularContentForAudio"
)(function* (args: { items: readonly PopularAudioItem[] }) {
  if (args.items.length === 0) {
    return { processed: 0, queued: 0 };
  }

  const ctx = yield* MutationCtx;
  const sortedItems = [...args.items].sort(
    (left, right) => right.viewCount - left.viewCount
  );
  const now = yield* Clock.currentTimeMillis;
  let totalQueued = 0;

  for (const item of sortedItems) {
    if (item.viewCount < MIN_AUDIO_VIEW_THRESHOLD) {
      break;
    }

    const sourceContent =
      item.sourceContent ??
      (yield* Effect.promise(() => readAudioContentLookup(ctx, item.ref)));

    if (!sourceContent) {
      yield* Effect.logWarning("Content slug not found for audio queue.", {
        contentId: item.ref.id,
        contentType: item.ref.type,
      });
      continue;
    }

    for (const locale of SUPPORTED_CONTENT_LOCALES) {
      const localizedContent = yield* Effect.promise(() =>
        readLocalizedAudioContentLookup(ctx, sourceContent, locale)
      );

      if (!localizedContent) {
        yield* Effect.logDebug("Localized content not found for audio queue.", {
          contentId: item.ref.id,
          contentType: item.ref.type,
          locale,
        });
        continue;
      }

      const existingQueueItem = yield* Effect.promise(() =>
        ctx.db
          .query("audioGenerationQueue")
          .withIndex("by_contentRefType_and_contentRefId_and_locale", (query) =>
            query
              .eq("contentRef.type", localizedContent.ref.type)
              .eq("contentRef.id", localizedContent.ref.id)
              .eq("locale", locale)
          )
          .first()
      );

      if (
        existingQueueItem &&
        ["pending", "processing", "failed"].includes(existingQueueItem.status)
      ) {
        continue;
      }

      if (existingQueueItem) {
        yield* Effect.promise(() => ctx.db.delete(existingQueueItem._id));
      }

      const existingAudio = yield* Effect.promise(() =>
        ctx.db
          .query("contentAudios")
          .withIndex("by_contentRefType_and_contentRefId_and_locale", (query) =>
            query
              .eq("contentRef.type", localizedContent.ref.type)
              .eq("contentRef.id", localizedContent.ref.id)
              .eq("locale", locale)
          )
          .first()
      );

      if (
        existingAudio?.status === "completed" &&
        existingAudio.contentHash === localizedContent.contentHash
      ) {
        continue;
      }

      yield* Effect.promise(() =>
        ctx.db.insert("audioGenerationQueue", {
          contentRef: localizedContent.ref,
          locale,
          maxRetries: AUDIO_RETRY_CONFIG.maxRetries,
          priorityScore: item.viewCount * 10,
          requestedAt: now,
          retryCount: 0,
          slug: sourceContent.slug,
          status: "pending",
          updatedAt: now,
        })
      );
      totalQueued += 1;
    }
  }

  return { processed: sortedItems.length, queued: totalQueued };
});

/** Populates the audio queue from current popularity read models. */
export const populateAudioQueue = Effect.fn("popularAudio.populateAudioQueue")(
  function* () {
    const ctx = yield* ActionCtx;
    yield* Effect.logInfo("Populating audio queue started.");

    const items = yield* Effect.promise(() =>
      ctx.runQuery(
        Ref.getFunctionReference(
          refs.internal.contents.queries.audio.getPopularContentForAudioQueue
        ),
        {}
      )
    );

    if (items.length === 0) {
      yield* Effect.logInfo("No popular content found for audio queue.");
      return null;
    }

    const result = yield* Effect.promise(() =>
      ctx.runMutation(
        Ref.getFunctionReference(
          refs.internal.contents.mutations.audio.enqueuePopularContentForAudio
        ),
        { items }
      )
    );

    yield* Effect.logInfo("Populated audio queue completed.", result);
    return null;
  }
);
