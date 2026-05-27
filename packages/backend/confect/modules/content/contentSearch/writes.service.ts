import { MutationCtx } from "@repo/backend/confect/_generated/services";
import { CONTENT_SYNC_BATCH_LIMITS } from "@repo/backend/confect/modules/content/constants";
import type {
  Locale,
  NakafaSection,
} from "@repo/backend/confect/modules/content/content.schemas";
import {
  buildContentSearchDocument,
  isSameContentSearch,
} from "@repo/backend/confect/modules/content/contentSearch/documents.service";
import { ContentSyncBatchSizeError } from "@repo/backend/confect/modules/content/contentSearch/errors.service";
import { Clock, Effect } from "effect";

/** Upserts one content search row and returns the write outcome. */
export const syncContentSearch = Effect.fn("contentSearch.syncContentSearch")(
  function* (source: {
    contentHash: string;
    description?: string;
    locale: Locale;
    route: string;
    section: NakafaSection;
    syncedAt: number;
    text: string;
    title: string;
  }) {
    const ctx = yield* MutationCtx;
    const nextValues = buildContentSearchDocument(source);
    const existing = yield* Effect.promise(() =>
      ctx.db
        .query("contentSearch")
        .withIndex("by_content_id", (query) =>
          query.eq("content_id", nextValues.content_id)
        )
        .unique()
    );

    if (isSameContentSearch(existing, nextValues)) {
      return "unchanged";
    }

    if (existing) {
      yield* Effect.promise(() => ctx.db.patch(existing._id, nextValues));
      return "updated";
    }

    yield* Effect.promise(() => ctx.db.insert("contentSearch", nextValues));
    return "created";
  }
);

/** Deletes one content search row by stable content id. */
export const deleteContentSearch = Effect.fn(
  "contentSearch.deleteContentSearch"
)(function* (contentId: string) {
  const ctx = yield* MutationCtx;
  const existing = yield* Effect.promise(() =>
    ctx.db
      .query("contentSearch")
      .withIndex("by_content_id", (query) => query.eq("content_id", contentId))
      .unique()
  );

  if (!existing) {
    return null;
  }

  yield* Effect.promise(() => ctx.db.delete(existing._id));
  return null;
});

/** Bulk syncs Quran search documents into the shared content search table. */
export const bulkSyncQuranSearch = Effect.fn(
  "contentSearch.bulkSyncQuranSearch"
)(function* (args: {
  documents: readonly {
    contentHash: string;
    description: string;
    locale: Locale;
    route: string;
    text: string;
    title: string;
  }[];
}) {
  if (args.documents.length > CONTENT_SYNC_BATCH_LIMITS.quranSearchDocuments) {
    return yield* Effect.fail(
      new ContentSyncBatchSizeError({
        message: `bulkSyncQuranSearch accepts at most ${CONTENT_SYNC_BATCH_LIMITS.quranSearchDocuments} Quran search documents.`,
      })
    );
  }

  const syncedAt = yield* Clock.currentTimeMillis;
  let created = 0;
  let unchanged = 0;
  let updated = 0;

  for (const document of args.documents) {
    const result = yield* syncContentSearch({
      ...document,
      section: "quran",
      syncedAt,
    });

    if (result === "created") {
      created += 1;
      continue;
    }

    if (result === "updated") {
      updated += 1;
      continue;
    }

    unchanged += 1;
  }

  return { created, unchanged, updated };
});
