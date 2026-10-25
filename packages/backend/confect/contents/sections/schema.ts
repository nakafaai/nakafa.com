import {
  localeValidator,
  nakafaSectionValidator,
} from "@repo/backend/confect/lib/validators/contents";
import { NAKAFA_AGENT_SECTIONS } from "@repo/contents/agent/constants";
import { Array as Arr, Schema } from "effect";

/** The kinds of section that have rows: a try-out is a catalog entry and has no text to find. */
export const INDEXED_SECTIONS = Arr.filter(
  NAKAFA_AGENT_SECTIONS,
  (section) => section !== "tryout"
);

/**
 * What a document decides about one of its sections, before the section has a
 * hash or a vector. `ordinal` and `count` give the section its place among the
 * `count` sections of its document, which is the same in every language.
 */
const sectionFieldsValidator = Schema.Struct({
  anchor: Schema.String,
  appLocale: localeValidator,
  contentKey: Schema.String,
  count: Schema.Finite,
  excerpt: Schema.String,
  headingPath: Schema.Array(Schema.String),
  ordinal: Schema.Finite,
  publicPath: Schema.String,
  section: nakafaSectionValidator,
  text: Schema.String,
});
export type SectionFields = typeof sectionFieldsValidator.Type;

/** A section with the hash of its text, which tells an unchanged section from a changed one. */
const sectionDraftValidator = Schema.Struct({
  ...sectionFieldsValidator.fields,
  hash: Schema.String,
});
export type SectionDraft = typeof sectionDraftValidator.Type;

/**
 * Builds the scope of a section: its language and its kind as one string, such
 * as `id:material`. A Convex vector filter tests one field for equality and
 * cannot require two fields at once, and the documentation shows only string
 * values, so a search that wants one language and one kind filters on this key.
 */
export function sectionScope(
  appLocale: SectionDraft["appLocale"],
  section: SectionDraft["section"]
) {
  return `${appLocale}:${section}`;
}

/** A stored section without its vector: everything that tells what it says, where it is, and which model embedded it. */
export const sectionHeadValidator = Schema.Struct({
  ...sectionDraftValidator.fields,
  model: Schema.String,
  scope: Schema.String,
});

/**
 * A stored section: its head and the vector of its text. A row does not say
 * which release it was built from, because an unchanged section is not written
 * again when a release changes; `contentSectionState` names the release the
 * whole index was last completed for.
 */
export const sectionRowValidator = Schema.Struct({
  ...sectionHeadValidator.fields,
  embedding: Schema.Array(Schema.Finite),
});

/**
 * Names a document in the index and the version its sections were made from.
 * The version covers the signed facts of the source, the embedding model, and
 * the format of a section, so a build skips a document whose version it holds
 * and splits and embeds again one whose version differs.
 */
const sourceValidator = Schema.Struct({
  appLocale: localeValidator,
  contentKey: Schema.String,
  section: nakafaSectionValidator,
  version: Schema.String,
});
export type Source = typeof sourceValidator.Type;

/**
 * The record of a document in the index: its source and, when the model left
 * some of its sections out, how many. A record without a count holds every
 * section of its version. A record with one makes the next build read the
 * document again, and it stays until the document is stored complete again or
 * the clean-up finds that no release publishes it, so that the sections the
 * index still holds go too.
 */
export const sourceRecordValidator = Schema.Struct({
  ...sourceValidator.fields,
  missing: Schema.optionalKey(Schema.Finite),
});
export type SourceRecord = typeof sourceRecordValidator.Type;

/** A document ready to be indexed: its source and the sections it holds. */
const documentValidator = Schema.Struct({
  ...sourceValidator.fields,
  sections: Schema.Array(sectionFieldsValidator),
});
export type SectionDocument = typeof documentValidator.Type;

/**
 * The record of the last build that finished: the release whose sections the
 * index holds, the model that embedded them, and how many sections the build
 * left out, which is none when the index is complete. There is one.
 */
export const sectionStateValidator = Schema.Struct({
  key: Schema.Literal("primary"),
  missing: Schema.Finite,
  model: Schema.String,
  releaseId: Schema.String,
});

/**
 * One lesson or article of the active release that a build has to split: the
 * authored source its sections come from, and the version it is made at.
 */
export const lessonValidator = Schema.Struct({
  appLocale: localeValidator,
  contentKey: Schema.String,
  publicPath: Schema.String,
  rawMdx: Schema.String,
  section: nakafaSectionValidator,
  title: Schema.String,
  version: Schema.String,
});

/** Where to read lessons from: after the lesson a cursor follows, in the release a build began for. */
export const lessonsInputValidator = Schema.Struct({
  cursor: Schema.NullOr(Schema.String),
  releaseId: Schema.optionalKey(Schema.String),
});

/**
 * A page of the lessons whose sections the index lacks or holds at another
 * version, with the number of lessons of the page it holds at the right version
 * already, or the news that the release a build began for is no longer active.
 */
export const lessonsResultValidator = Schema.Union([
  Schema.Struct({ kind: Schema.Literal("stale") }),
  Schema.Struct({
    kind: Schema.Literal("page"),
    lessons: Schema.Array(lessonValidator),
    next: Schema.NullOr(Schema.String),
    releaseId: Schema.String,
    unchanged: Schema.Finite,
  }),
]);

/** Which surah of the Quran to start at, in the release a build began for. */
export const surahInputValidator = Schema.Struct({
  releaseId: Schema.optionalKey(Schema.String),
  surah: Schema.Finite,
});

/**
 * The first surah at or after the one asked for whose passages the index lacks
 * or holds at another version, as one document for each language, with the
 * number of documents it passed over; `done` when none is left, which is also
 * the answer for a release that has no Quran.
 */
export const surahResultValidator = Schema.Union([
  Schema.Struct({ kind: Schema.Literal("stale") }),
  Schema.Struct({
    kind: Schema.Literal("done"),
    releaseId: Schema.String,
    unchanged: Schema.Finite,
  }),
  Schema.Struct({
    documents: Schema.Array(documentValidator),
    kind: Schema.Literal("surah"),
    releaseId: Schema.String,
    surah: Schema.Finite,
    unchanged: Schema.Finite,
  }),
]);

/**
 * Asks, for the hash of each text of a document, whether the index holds a
 * section of that document with the same text made by the same model, at
 * whatever place it has: such a section needs no new vector, even when
 * another section came before it and moved it one place on. Only hashes
 * travel, never the texts.
 */
export const knownInputValidator = Schema.Struct({
  appLocale: localeValidator,
  contentKey: Schema.String,
  hashes: Schema.Array(Schema.String),
  model: Schema.String,
});

/** A section to store, with its vector when its text changed. */
export const storedSectionValidator = Schema.Struct({
  ...sectionDraftValidator.fields,
  embedding: Schema.optionalKey(Schema.Array(Schema.Finite)),
});

/** The sections of one document to store for one release, and the source they were made from. */
export const storeInputValidator = Schema.Struct({
  model: Schema.String,
  releaseId: Schema.String,
  sections: Schema.Array(storedSectionValidator),
  source: sourceValidator,
});

/**
 * What a store did: sections written, sections found as they were, sections it
 * could not keep because they came without a vector and nothing stored matched
 * them, and rows it deleted because the document no longer has them. `stale`
 * says the release was no longer the active one, so that nothing was stored.
 */
export const storeResultValidator = Schema.Struct({
  kept: Schema.Finite,
  missing: Schema.Finite,
  removed: Schema.Finite,
  stale: Schema.Boolean,
  written: Schema.Finite,
});

/** Names the release whose build is cleaning up, and where in the stored documents it stopped. */
export const pruneInputValidator = Schema.Struct({
  cursor: Schema.NullOr(Schema.String),
  releaseId: Schema.String,
});

/**
 * How many rows a clean-up deleted, whether the last page of documents is done,
 * where the next call continues if it is not (the same place when the budget of
 * rows ran out inside a page), and whether the release stopped being the active
 * one, in which case it did nothing.
 */
export const pruneResultValidator = Schema.Struct({
  cursor: Schema.NullOr(Schema.String),
  deleted: Schema.Finite,
  done: Schema.Boolean,
  stale: Schema.Boolean,
});

/**
 * Names the release a finished build indexed, the model that embedded it, and
 * how many sections the build left out.
 */
export const finishInputValidator = Schema.Struct({
  missing: Schema.Finite,
  model: Schema.String,
  releaseId: Schema.String,
});

/** Whether the build was recorded: it is not when its release is no longer the active one. */
export const finishResultValidator = Schema.Struct({
  recorded: Schema.Boolean,
});

/** Which stored sections to read back: those of one language, after a cursor. */
export const pageInputValidator = Schema.Struct({
  appLocale: localeValidator,
  cursor: Schema.NullOr(Schema.String),
});

/** A page of stored sections with what the model test needs of each, and the cursor of the next page. */
export const pageResultValidator = Schema.Struct({
  next: Schema.NullOr(Schema.String),
  sections: Schema.Array(
    Schema.Struct({
      contentKey: Schema.String,
      headingPath: Schema.Array(Schema.String),
      ordinal: Schema.Finite,
      text: Schema.String,
    })
  ),
});
