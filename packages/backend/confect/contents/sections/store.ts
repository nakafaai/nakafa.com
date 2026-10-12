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
  type SectionDraft,
  sectionHeadValidator,
  sectionScope,
  type storeInputValidator,
} from "@repo/backend/confect/contents/sections/schema";
import { findSource } from "@repo/backend/confect/contents/sections/source";
import { isActive } from "@repo/backend/confect/contents/sections/state";
import { Array as Arr, Effect, Option, Schema } from "effect";

const sameHead = Schema.toEquivalence(sectionHeadValidator);

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
 * Makes the index hold exactly the given sections of one document, and records
 * the version they were made from, in one transaction. A section that matches
 * the stored one in text and model keeps its vector, and is written again only
 * when something else about it changed, such as its place or its heading; a
 * changed or new section needs its vector with it. A stored row that no given
 * section matches is deleted, and so is the row of a section that came without
 * a vector and matches nothing, because the text that row holds is outdated.
 * Storing the same document again changes nothing. Nothing is stored once the
 * release is no longer the active one, because the build of the newer release
 * stores its documents and a late write would overwrite them.
 */
export const storeDocument = Effect.fn("contents.sections.store")(function* (
  input: typeof storeInputValidator.Type
) {
  if (!(yield* isActive(input.releaseId))) {
    return { kept: 0, missing: 0, removed: 0, stale: true, written: 0 };
  }
  const { appLocale, contentKey } = input.source;
  const stored = yield* (yield* DatabaseReader)
    .table("contentSections")
    .index("by_appLocale_and_contentKey_and_ordinal", (index) =>
      index.eq("appLocale", appLocale).eq("contentKey", contentKey)
    )
    .take(SECTIONS_PER_DOCUMENT)
    .pipe(Effect.orDie);
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
        const reusable = Option.filter(
          current,
          (row) => row.hash === draft.hash && row.model === input.model
        );
        const vector = Option.match(reusable, {
          onNone: () => embedding,
          onSome: (row) => row.embedding,
        });
        if (vector === undefined) {
          return { ordinal: draft.ordinal, outcome: "missing" as const };
        }
        if (Option.exists(reusable, (row) => sameHead(row, head))) {
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
  const known = yield* findSource(input.source);
  if (known?.version !== input.source.version) {
    const sources = writer.table("contentSectionSources");
    yield* (
      known === null
        ? Effect.asVoid(sources.insert(input.source))
        : sources.replace(known._id, input.source)
    ).pipe(Effect.orDie);
  }
  const count = (outcome: (typeof outcomes)[number]["outcome"]) =>
    Arr.length(Arr.filter(outcomes, (found) => found.outcome === outcome));
  return {
    kept: count("kept"),
    missing: count("missing"),
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
