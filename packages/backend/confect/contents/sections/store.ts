import {
  DatabaseReader,
  DatabaseWriter,
} from "@repo/backend/confect/_generated/services";
import {
  COMPARE_PAGE_BYTES,
  COMPARE_PAGE_ROWS,
  SECTIONS_PER_DOCUMENT,
} from "@repo/backend/confect/contents/sections/limits";
import {
  type knownInputValidator,
  type pageInputValidator,
  type SourceRecord,
  sectionHeadValidator,
  sectionScope,
  type storeInputValidator,
} from "@repo/backend/confect/contents/sections/schema";
import { findSource } from "@repo/backend/confect/contents/sections/source";
import { isActive } from "@repo/backend/confect/contents/sections/state";
import { Array as Arr, Effect, Option, Schema } from "effect";

const sameHead = Schema.toEquivalence(sectionHeadValidator);

/** Reads the stored sections of one document, in the order of their places. */
const documentRows = Effect.fn("contents.sections.documentRows")(function* (
  key: Pick<typeof knownInputValidator.Type, "appLocale" | "contentKey">
) {
  return yield* (yield* DatabaseReader)
    .table("contentSections")
    .index("by_appLocale_and_contentKey_and_ordinal", (index) =>
      index.eq("appLocale", key.appLocale).eq("contentKey", key.contentKey)
    )
    .take(SECTIONS_PER_DOCUMENT)
    .pipe(Effect.orDie);
});

/** Whether a stored section has the text with that hash, made by that model, so that its vector is the vector of the text. */
function holdsText(
  row: Pick<typeof sectionHeadValidator.Type, "hash" | "model">,
  hash: string,
  model: string
) {
  return row.hash === hash && row.model === model;
}

/**
 * Tells, for each hash and in the same order, whether the document holds a
 * section with that text, made by the same model, at whatever place, so that
 * the text needs no new vector.
 */
export const knownSections = Effect.fn("contents.sections.known")(function* (
  input: typeof knownInputValidator.Type
) {
  const stored = yield* documentRows(input);
  return Arr.map(input.hashes, (hash) =>
    Arr.some(stored, (row) => holdsText(row, hash, input.model))
  );
});

/**
 * Makes the index hold exactly the given sections of one document, and records
 * the version they were made from with the count of the sections the model left
 * out, in one transaction. The next build reads a document with a section left
 * out again and embeds what it still lacks, and the record keeps the count, so
 * that a clean-up which finds the release no longer publishes the document still
 * deletes the sections the index holds. A section keeps the vector of a stored
 * section of the document that has the same text and was made by the same model,
 * whichever place that section had, and is written again only when something
 * else about it changed, such as
 * its place or its heading: a section that another section pushed one place on
 * is neither embedded again nor lost. A changed or new section needs its vector
 * with it.
 * A stored row that no given section takes the place of is deleted, and so is
 * the row of a section that came without a vector and matches nothing, because
 * the text that row holds is outdated. Storing the same document again changes
 * nothing. Nothing is stored once the release is no longer the active one,
 * because the build of the newer release stores its documents and a late write
 * would overwrite them.
 */
export const storeDocument = Effect.fn("contents.sections.store")(function* (
  input: typeof storeInputValidator.Type
) {
  if (!(yield* isActive(input.releaseId))) {
    return { kept: 0, missing: 0, removed: 0, stale: true, written: 0 };
  }
  const stored = yield* documentRows(input.source);
  const writer = yield* DatabaseWriter;
  const table = writer.table("contentSections");
  const outcomes = yield* Effect.forEach(
    input.sections,
    ({ embedding, ...draft }) =>
      Effect.gen(function* () {
        const current = Arr.findFirst(
          stored,
          ({ ordinal }) => ordinal === draft.ordinal
        );
        const head = {
          ...draft,
          model: input.model,
          scope: sectionScope(draft.appLocale, draft.section),
        };
        const hasText = (row: (typeof stored)[number]) =>
          holdsText(row, draft.hash, input.model);
        // The row at its own place when it has the text, and otherwise any
        // row of the document that has it, which is a section that moved. The
        // rows are read before any is written, so a row that this loop
        // replaces still gives its vector.
        const holder = Option.orElse(Option.filter(current, hasText), () =>
          Arr.findFirst(stored, hasText)
        );
        const vector = Option.match(holder, {
          onNone: () => embedding,
          onSome: (row) => row.embedding,
        });
        if (vector === undefined) {
          return { ordinal: draft.ordinal, outcome: "missing" as const };
        }
        if (Option.exists(holder, (row) => sameHead(row, head))) {
          return { ordinal: draft.ordinal, outcome: "kept" as const };
        }
        yield* Option.match(current, {
          onNone: () =>
            Effect.asVoid(table.insert({ ...head, embedding: vector })),
          onSome: ({ _id }) =>
            table.replace(_id, { ...head, embedding: vector }),
        }).pipe(Effect.orDie);
        return { ordinal: draft.ordinal, outcome: "written" as const };
      })
  );
  const present = Arr.map(
    Arr.filter(outcomes, ({ outcome }) => outcome !== "missing"),
    ({ ordinal }) => ordinal
  );
  const extras = Arr.filter(
    stored,
    ({ ordinal }) => !Arr.contains(present, ordinal)
  );
  yield* Effect.forEach(extras, ({ _id }) => table.delete(_id), {
    discard: true,
  });
  const count = (outcome: (typeof outcomes)[number]["outcome"]) =>
    Arr.length(Arr.filter(outcomes, (found) => found.outcome === outcome));
  const missing = count("missing");
  const known = yield* findSource(input.source);
  const sources = writer.table("contentSectionSources");
  const record: SourceRecord =
    missing > 0 ? { ...input.source, missing } : input.source;
  if (
    known === null ||
    known.version !== record.version ||
    known.missing !== record.missing
  ) {
    yield* (
      known === null
        ? Effect.asVoid(sources.insert(record))
        : sources.replace(known._id, record)
    ).pipe(Effect.orDie);
  }
  return {
    kept: count("kept"),
    missing,
    removed: Arr.length(extras),
    stale: false,
    written: count("written"),
  };
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
