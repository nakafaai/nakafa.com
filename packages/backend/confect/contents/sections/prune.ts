import {
  DatabaseReader,
  DatabaseWriter,
} from "@repo/backend/confect/_generated/services";
import { releaseFail } from "@repo/backend/confect/contentRelease/error";
import { loadVersion } from "@repo/backend/confect/contentRelease/model";
import {
  PRUNE_BATCH_SIZE,
  PRUNE_SOURCES_PER_PAGE,
  SECTIONS_PER_DOCUMENT,
} from "@repo/backend/confect/contents/sections/limits";
import type {
  pruneInputValidator,
  Source,
} from "@repo/backend/confect/contents/sections/schema";
import { activeSequence } from "@repo/backend/confect/contents/sections/state";
import { publicationLayer } from "@repo/backend/content/publication/confect";
import { loadQuranOwner } from "@repo/backend/content/quran/owner";
import { Effect, Option } from "effect";

/** The snapshot of the Quran in the active release, or none when the release has no Quran. */
const quranSnapshotId = loadQuranOwner().pipe(
  Effect.provide(publicationLayer),
  Effect.map(({ snapshotId }) => snapshotId)
);

/**
 * Whether a document of the index is published still in the active release,
 * which has the given sequence: a lesson or an article has a public version at
 * that sequence, and the Quran has a snapshot. `quranSnapshot` is read only if
 * a Quran document asks.
 */
const isPublished = Effect.fn("contents.sections.isPublished")(function* (
  source: Source,
  sequence: number,
  quranSnapshot: typeof quranSnapshotId
) {
  if (source.section === "quran") {
    return (yield* quranSnapshot) !== null;
  }
  const head = yield* loadVersion(
    source.contentKey,
    source.appLocale,
    sequence
  );
  return head?.operation === "upsert" && head.delivery === "public";
});

/**
 * Deletes the documents that the active release does not publish any more,
 * with their sections, a page of documents at a time. A document goes whole or
 * not at all: its rows and its record are deleted in one transaction, so the
 * index never keeps rows without their record or a record without its rows. A
 * call deletes at most a batch of rows, and when the next document does not fit
 * what is left of it, the call stops before that document and the next call
 * begins with an empty batch. A document that
 * the release still publishes is left as it is: a build keeps the sections of
 * a published document right when it walks it, so this only has to find what
 * the walk can never reach. It does nothing once `releaseId` is no longer the
 * active release, because the build of the newer release cleans up for
 * itself. Its answer says whether the last page is done, and where the next
 * call continues if it is not, which is the same place when the batch ran out
 * inside the page.
 */
export const pruneSections = Effect.fn("contents.sections.prune")(function* (
  input: typeof pruneInputValidator.Type
) {
  const sequence = yield* activeSequence(input.releaseId);
  if (Option.isNone(sequence)) {
    return { cursor: null, deleted: 0, done: true, stale: true };
  }
  const reader = yield* DatabaseReader;
  const writer = yield* DatabaseWriter;
  const page = yield* reader
    .table("contentSectionSources")
    .index("by_appLocale_and_contentKey")
    .paginate({ cursor: input.cursor, numItems: PRUNE_SOURCES_PER_PAGE })
    .pipe(Effect.orDie);
  const quranSnapshot = yield* Effect.cached(quranSnapshotId);
  let budget = PRUNE_BATCH_SIZE;
  for (const source of page.page) {
    if (yield* isPublished(source, sequence.value, quranSnapshot)) {
      continue;
    }
    const rows = yield* reader
      .table("contentSections")
      .index("by_appLocale_and_contentKey_and_ordinal", (index) =>
        index
          .eq("appLocale", source.appLocale)
          .eq("contentKey", source.contentKey)
      )
      .take(SECTIONS_PER_DOCUMENT + 1)
      .pipe(Effect.orDie);
    // No build stores such a document. Without this, the call would stop at
    // it for ever, because it fits no batch, and schedule the same call again.
    if (rows.length > SECTIONS_PER_DOCUMENT) {
      return yield* releaseFail(
        "CONTENT_RELEASE_LIMIT",
        `Indexed document ${source.contentKey}/${source.appLocale} holds more than ${SECTIONS_PER_DOCUMENT} sections.`
      );
    }
    if (rows.length > budget) {
      return {
        cursor: input.cursor,
        deleted: PRUNE_BATCH_SIZE - budget,
        done: false,
        stale: false,
      };
    }
    yield* Effect.forEach(
      rows,
      ({ _id }) => writer.table("contentSections").delete(_id),
      { discard: true }
    );
    yield* writer.table("contentSectionSources").delete(source._id);
    budget -= rows.length;
  }
  return {
    cursor: page.continueCursor,
    deleted: PRUNE_BATCH_SIZE - budget,
    done: page.isDone,
    stale: false,
  };
});
