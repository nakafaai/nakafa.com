import {
  DatabaseReader,
  DatabaseWriter,
} from "@repo/backend/confect/_generated/services";
import {
  COMPARE_PAGE_BYTES,
  COMPARE_PAGE_ROWS,
  PRUNE_BATCH_SIZE,
} from "@repo/backend/confect/contents/sections/limits";
import {
  type knownInputValidator,
  type pageInputValidator,
  type pruneInputValidator,
  type SectionDraft,
  sectionScope,
  type storeInputValidator,
} from "@repo/backend/confect/contents/sections/schema";
import { isActive } from "@repo/backend/confect/contents/sections/state";
import { Array as Arr, Effect } from "effect";

/** Finds the stored row of a section by its language, its document, and its place in it. */
const findSection = Effect.fn("contents.sections.findSection")(function* (
  key: Pick<SectionDraft, "appLocale" | "contentKey" | "ordinal">
) {
  return yield* (yield* DatabaseReader)
    .table("contentSections")
    .get(
      "by_appLocale_and_contentKey_and_ordinal",
      key.appLocale,
      key.contentKey,
      key.ordinal
    )
    .pipe(
      Effect.catchTag("GetByIndexFailure", () => Effect.succeed(null)),
      Effect.orDie
    );
});

/**
 * Tells, for each keyed section and in the same order, whether the index holds
 * it with the same text, made by the same model, so that it needs no new vector.
 */
export const knownSections = Effect.fn("contents.sections.known")(function* (
  input: typeof knownInputValidator.Type
) {
  return yield* Effect.forEach(input.sections, (key) =>
    Effect.map(
      findSection(key),
      (row) => row?.hash === key.hash && row.model === input.model
    )
  );
});

/**
 * Stores sections for one release. A section that matches the stored one in
 * text and model keeps its vector and takes the new release, so an unchanged
 * section is never embedded again; a changed or new section needs its vector
 * with it. Storing the same sections again changes nothing. Nothing is stored
 * once the release is no longer the active one, because the build of the
 * newer release stores its sections and a late write would overwrite them.
 */
export const storeSections = Effect.fn("contents.sections.store")(function* (
  input: typeof storeInputValidator.Type
) {
  if (!(yield* isActive(input.releaseId))) {
    return { kept: 0, missing: 0, stale: true, written: 0 };
  }
  const writer = yield* DatabaseWriter;
  const table = writer.table("contentSections");
  const outcomes = yield* Effect.forEach(
    input.sections,
    ({ embedding, ...draft }) =>
      Effect.gen(function* () {
        const stored = yield* findSection(draft);
        const base = {
          ...draft,
          model: input.model,
          releaseId: input.releaseId,
          scope: sectionScope(draft.appLocale, draft.section),
        };
        if (
          stored !== null &&
          stored.hash === draft.hash &&
          stored.model === input.model
        ) {
          if (stored.releaseId === input.releaseId) {
            return "kept" as const;
          }
          yield* table
            .replace(stored._id, { ...base, embedding: stored.embedding })
            .pipe(Effect.orDie);
          return "written" as const;
        }
        if (embedding === undefined) {
          return "missing" as const;
        }
        yield* (
          stored === null
            ? Effect.asVoid(table.insert({ ...base, embedding }))
            : table.replace(stored._id, { ...base, embedding })
        ).pipe(Effect.orDie);
        return "written" as const;
      })
  );
  const count = (outcome: (typeof outcomes)[number]) =>
    Arr.length(Arr.filter(outcomes, (found) => found === outcome));
  return {
    kept: count("kept"),
    missing: count("missing"),
    stale: false,
    written: count("written"),
  };
});

/**
 * Deletes rows built from other releases than `releaseId`, a bounded batch at
 * a time. It deletes nothing when `releaseId` is no longer the active release,
 * because the rows of the newer release would be the ones to keep.
 */
export const pruneSections = Effect.fn("contents.sections.prune")(function* (
  input: typeof pruneInputValidator.Type
) {
  if (!(yield* isActive(input.releaseId))) {
    return { deleted: 0, done: true };
  }
  const reader = yield* DatabaseReader;
  const writer = yield* DatabaseWriter;
  const earlier = yield* reader
    .table("contentSections")
    .index("by_releaseId", (index) => index.lt("releaseId", input.releaseId))
    .take(PRUNE_BATCH_SIZE)
    .pipe(Effect.orDie);
  const later = yield* reader
    .table("contentSections")
    .index("by_releaseId", (index) => index.gt("releaseId", input.releaseId))
    .take(PRUNE_BATCH_SIZE - earlier.length)
    .pipe(Effect.orDie);
  const doomed = Arr.appendAll(earlier, later);
  yield* Effect.forEach(
    doomed,
    ({ _id }) => writer.table("contentSections").delete(_id),
    { discard: true }
  );
  return { deleted: doomed.length, done: doomed.length < PRUNE_BATCH_SIZE };
});

/**
 * Reads one page of the stored sections of a language, in the order of the
 * index: for the model test, the headings that tell which section is which
 * and the text that each candidate model embeds.
 */
export const pageTexts = Effect.fn("contents.sections.pageTexts")(function* (
  input: typeof pageInputValidator.Type
) {
  const page = yield* (yield* DatabaseReader)
    .table("contentSections")
    .index("by_appLocale_and_contentKey_and_ordinal", (index) =>
      index.eq("appLocale", input.appLocale)
    )
    .paginate({
      cursor: input.cursor,
      maximumBytesRead: COMPARE_PAGE_BYTES,
      numItems: COMPARE_PAGE_ROWS,
    })
    .pipe(Effect.orDie);
  return {
    next: page.isDone ? null : page.continueCursor,
    sections: Arr.map(
      page.page,
      ({ contentKey, headingPath, ordinal, text }) => ({
        contentKey,
        headingPath,
        ordinal,
        text,
      })
    ),
  };
});
