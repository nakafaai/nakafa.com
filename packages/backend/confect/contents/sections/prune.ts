import {
  DatabaseReader,
  DatabaseWriter,
} from "@repo/backend/confect/_generated/services";
import { loadVersion } from "@repo/backend/confect/contentRelease/model";
import {
  PRUNE_BATCH_SIZE,
  PRUNE_SOURCES_PER_PAGE,
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
 * with their sections, a page of documents at a time and a bounded number of
 * rows at a time. A document that the release still publishes is left as it
 * is: a build keeps the sections of a published document right when it walks
 * it, so this only has to find what the walk can never reach. It does nothing
 * once `releaseId` is no longer the active release, because the build of the
 * newer release cleans up for itself. Its answer says whether the last page is
 * done, and where the next call continues if it is not, which is the same
 * place when the budget of rows ran out inside the page.
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
      .take(budget)
      .pipe(Effect.orDie);
    yield* Effect.forEach(
      rows,
      ({ _id }) => writer.table("contentSections").delete(_id),
      { discard: true }
    );
    budget -= rows.length;
    if (budget === 0) {
      return {
        cursor: input.cursor,
        deleted: PRUNE_BATCH_SIZE,
        done: false,
        stale: false,
      };
    }
    yield* writer.table("contentSectionSources").delete(source._id);
  }
  return {
    cursor: page.continueCursor,
    deleted: PRUNE_BATCH_SIZE - budget,
    done: page.isDone,
    stale: false,
  };
});
