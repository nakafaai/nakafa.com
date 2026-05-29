import refs from "@repo/backend/confect/_generated/refs";
import {
  DatabaseReader,
  DatabaseWriter,
  MutationRunner,
  QueryRunner,
} from "@repo/backend/confect/_generated/services";
import type { AudioContentRef } from "@repo/backend/confect/modules/content/audio.schemas";
import {
  type AudioContentLookup,
  getAudioContentLookup,
  getLocalizedAudioContentLookup,
} from "@repo/backend/confect/modules/content/audioContentLookup.service";
import {
  AUDIO_RETRY_CONFIG,
  MAX_AUDIO_QUEUE_POPULAR_ITEMS_PER_TYPE,
  MIN_AUDIO_VIEW_THRESHOLD,
} from "@repo/backend/confect/modules/content/audioGeneration.constants";
import { SUPPORTED_CONTENT_LOCALES } from "@repo/backend/confect/modules/content/content.schemas";
import { Clock, Effect, Option } from "effect";

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
export const getPopularContentForAudioQueue = Effect.fnUntraced(function* () {
  const reader = yield* DatabaseReader;
  const [articleRows, subjectRows] = yield* Effect.all(
    [
      reader
        .table("articlePopularity")
        .index(
          "by_viewCount_and_contentId",
          (query) => query.gte("viewCount", MIN_AUDIO_VIEW_THRESHOLD),
          "desc"
        )
        .take(MAX_AUDIO_QUEUE_POPULAR_ITEMS_PER_TYPE),
      reader
        .table("subjectPopularity")
        .index(
          "by_viewCount_and_contentId",
          (query) => query.gte("viewCount", MIN_AUDIO_VIEW_THRESHOLD),
          "desc"
        )
        .take(MAX_AUDIO_QUEUE_POPULAR_ITEMS_PER_TYPE),
    ],
    { concurrency: "unbounded" }
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
export const enqueuePopularContentForAudio = Effect.fnUntraced(
  function* (args: { items: readonly PopularAudioItem[] }) {
    if (args.items.length === 0) {
      return { processed: 0, queued: 0 };
    }

    const reader = yield* DatabaseReader;
    const writer = yield* DatabaseWriter;
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
        item.sourceContent ?? (yield* getAudioContentLookup(item.ref));

      if (!sourceContent) {
        continue;
      }

      for (const locale of SUPPORTED_CONTENT_LOCALES) {
        const localizedContent = yield* getLocalizedAudioContentLookup(
          sourceContent,
          locale
        );

        if (!localizedContent) {
          continue;
        }

        const existingQueueItem = yield* reader
          .table("audioGenerationQueue")
          .index("by_contentRefType_and_contentRefId_and_locale", (query) =>
            query
              .eq("contentRef.type", localizedContent.ref.type)
              .eq("contentRef.id", localizedContent.ref.id)
              .eq("locale", locale)
          )
          .first()
          .pipe(Effect.map(Option.getOrNull));

        if (
          existingQueueItem &&
          ["pending", "processing", "failed"].includes(existingQueueItem.status)
        ) {
          continue;
        }

        if (existingQueueItem) {
          yield* writer
            .table("audioGenerationQueue")
            .delete(existingQueueItem._id);
        }

        const existingAudio = yield* reader
          .table("contentAudios")
          .index("by_contentRefType_and_contentRefId_and_locale", (query) =>
            query
              .eq("contentRef.type", localizedContent.ref.type)
              .eq("contentRef.id", localizedContent.ref.id)
              .eq("locale", locale)
          )
          .first()
          .pipe(Effect.map(Option.getOrNull));

        if (
          existingAudio?.status === "completed" &&
          existingAudio.contentHash === localizedContent.contentHash
        ) {
          continue;
        }

        yield* writer.table("audioGenerationQueue").insert({
          contentRef: localizedContent.ref,
          locale,
          maxRetries: AUDIO_RETRY_CONFIG.maxRetries,
          priorityScore: item.viewCount * 10,
          requestedAt: now,
          retryCount: 0,
          slug: sourceContent.slug,
          status: "pending",
          updatedAt: now,
        });
        totalQueued += 1;
      }
    }

    return { processed: sortedItems.length, queued: totalQueued };
  }
);

/** Populates the audio queue from current popularity read models. */
export const populateAudioQueue = Effect.fnUntraced(function* () {
  const runQuery = yield* QueryRunner;
  const runMutation = yield* MutationRunner;
  yield* Effect.logInfo("Populating audio queue started.");

  const items = yield* runQuery(
    refs.internal.contents.queries.audio.getPopularContentForAudioQueue,
    {}
  );

  if (items.length === 0) {
    yield* Effect.logInfo("No popular content found for audio queue.");
    return null;
  }

  const result = yield* runMutation(
    refs.internal.contents.mutations.audio.enqueuePopularContentForAudio,
    { items }
  );

  yield* Effect.logInfo("Populated audio queue completed.", result);
  return null;
});
