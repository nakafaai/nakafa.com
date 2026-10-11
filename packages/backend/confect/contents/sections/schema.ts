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
 * The language and the kind of a section as one value. Convex vector filters
 * cannot require two fields at once, so a search that wants one language and
 * one kind filters on this pair.
 */
const sectionScopeValidator = Schema.Tuple([
  localeValidator,
  nakafaSectionValidator,
]);

/** Builds the scope of a section from its language and kind. */
export function sectionScope(
  appLocale: SectionDraft["appLocale"],
  section: SectionDraft["section"]
): [SectionDraft["appLocale"], SectionDraft["section"]] {
  return [appLocale, section];
}

/** A stored section: its draft, the vector of its text, and the release it was built from. */
export const sectionRowValidator = Schema.Struct({
  ...sectionDraftValidator.fields,
  embedding: Schema.Array(Schema.Finite),
  model: Schema.String,
  releaseId: Schema.String,
  scope: sectionScopeValidator,
});

/** One lesson or article of the active release, with the authored source its sections come from. */
export const lessonValidator = Schema.Struct({
  appLocale: localeValidator,
  contentKey: Schema.String,
  publicPath: Schema.String,
  rawMdx: Schema.String,
  section: nakafaSectionValidator,
  title: Schema.String,
});

/** Where to read lessons from: after the lesson a cursor follows, in the release a build began for. */
export const lessonsInputValidator = Schema.Struct({
  cursor: Schema.NullOr(Schema.String),
  releaseId: Schema.optionalKey(Schema.String),
});

/** A page of lessons, or the news that the release a build began for is no longer active. */
export const lessonsResultValidator = Schema.Union([
  Schema.Struct({ kind: Schema.Literal("stale") }),
  Schema.Struct({
    kind: Schema.Literal("page"),
    lessons: Schema.Array(lessonValidator),
    next: Schema.NullOr(Schema.String),
    releaseId: Schema.String,
  }),
]);

/** Which surah of the Quran to read, in the release a build began for. */
export const surahInputValidator = Schema.Struct({
  releaseId: Schema.optionalKey(Schema.String),
  surah: Schema.Finite,
});

/** The passages of a surah, none when the release has no Quran, or stale. */
export const surahResultValidator = Schema.Union([
  Schema.Struct({ kind: Schema.Literal("stale") }),
  Schema.Struct({ kind: Schema.Literal("none"), releaseId: Schema.String }),
  Schema.Struct({
    kind: Schema.Literal("surah"),
    releaseId: Schema.String,
    sections: Schema.Array(sectionFieldsValidator),
  }),
]);

/** The identity and text hash of a section, as the build asks whether it is stored already. */
const sectionKeyValidator = Schema.Struct({
  appLocale: localeValidator,
  contentKey: Schema.String,
  hash: Schema.String,
  ordinal: Schema.Finite,
});

/** Asks which of the keyed sections are stored with the same text, made by the same model. */
export const knownInputValidator = Schema.Struct({
  model: Schema.String,
  sections: Schema.Array(sectionKeyValidator),
});

/** A section to store, with its vector when its text changed. */
export const storedSectionValidator = Schema.Struct({
  ...sectionDraftValidator.fields,
  embedding: Schema.optionalKey(Schema.Array(Schema.Finite)),
});

/** Sections to store for one release. */
export const storeInputValidator = Schema.Struct({
  model: Schema.String,
  releaseId: Schema.String,
  sections: Schema.Array(storedSectionValidator),
});

/**
 * What a store did: sections written, sections found as they were, and
 * sections it could not keep because they came without a vector and nothing
 * stored matched them. `stale` says the release was no longer the active one,
 * so that nothing was stored.
 */
export const storeResultValidator = Schema.Struct({
  kept: Schema.Finite,
  missing: Schema.Finite,
  stale: Schema.Boolean,
  written: Schema.Finite,
});

/** Names the release whose rows stay when the others are deleted. */
export const pruneInputValidator = Schema.Struct({ releaseId: Schema.String });

/** How many rows a prune deleted, and whether none are left to delete. */
export const pruneResultValidator = Schema.Struct({
  deleted: Schema.Finite,
  done: Schema.Boolean,
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

/**
 * Where a build step works: the lessons after a cursor, one surah of the
 * Quran, or the deletion of rows that earlier releases left behind. A build
 * walks them in this order, and a position is all it needs to resume.
 */
const positionValidator = Schema.Union([
  Schema.Struct({
    cursor: Schema.NullOr(Schema.String),
    phase: Schema.Literal("lessons"),
  }),
  Schema.Struct({ phase: Schema.Literal("quran"), surah: Schema.Finite }),
  Schema.Struct({ phase: Schema.Literal("prune") }),
]);
export type Position = typeof positionValidator.Type;

/** One build step: the release it is for, if known, and where it works. */
export const stepInputValidator = Schema.Struct({
  position: Schema.optionalKey(positionValidator),
  releaseId: Schema.optionalKey(Schema.String),
});

/** The step that follows another: the release is known by then. */
const nextStepValidator = Schema.Struct({
  position: positionValidator,
  releaseId: Schema.String,
});

/**
 * What one build step did and the step that follows it: `next` is null when
 * the build is complete or `stale` says that the release changed under it.
 */
export const stepResultValidator = Schema.Struct({
  embedded: Schema.Finite,
  kept: Schema.Finite,
  missing: Schema.Finite,
  next: Schema.NullOr(nextStepValidator),
  position: positionValidator,
  stale: Schema.Boolean,
  written: Schema.Finite,
});
