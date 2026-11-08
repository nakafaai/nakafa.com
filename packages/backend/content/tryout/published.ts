import type {
  CatalogSectionSchema,
  CatalogSetSchema,
} from "@nakafa/aksara-contracts/assessment/catalog";
import { releaseFail } from "@repo/backend/confect/contentRelease/error";
import { tryoutSetIdentityOf } from "@repo/backend/confect/tryouts/route";
import {
  readSetFacts,
  type SetFacts,
} from "@repo/backend/content/tryout/facts";
import {
  descriptionOf,
  toPublicExam,
  toPublicGroup,
  toPublicTrack,
} from "@repo/backend/content/tryout/node";
import type { TryoutSetSelection } from "@repo/backend/content/tryout/selection";
import { Array as Arr, Effect, HashMap, Option } from "effect";

type CatalogSection = typeof CatalogSectionSchema.Type;
type CatalogSet = typeof CatalogSetSchema.Type;
type FactsBySet = HashMap.HashMap<string, SetFacts>;

/** Reads the facts of one set from the facts read for its page. */
const factsFor = Effect.fn("tryouts.catalog.factsFor")(function* (
  facts: FactsBySet,
  set: CatalogSet
) {
  return yield* Effect.fromOption(
    HashMap.get(facts, tryoutSetIdentityOf(set))
  ).pipe(
    // The page read the facts of every set it projects.
    Effect.orDie
  );
});

/**
 * Projects one section into the public catalog contract, with its question count and time limit from
 * its set's facts. A catalog section that names no section of its set's profile is a broken snapshot.
 */
export const toPublicPublishedSection = Effect.fn(
  "tryouts.catalog.toPublicPublishedSection"
)(function* (section: CatalogSection, facts: SetFacts) {
  const own = Arr.findFirst(
    facts.sections,
    ({ sectionKey }) => sectionKey === section.sectionKey
  );
  if (Option.isNone(own)) {
    return yield* releaseFail(
      "CONTENT_RELEASE_INTEGRITY",
      `Try-out section ${section.sectionKey} names no section of its profile.`
    );
  }
  return {
    ...descriptionOf(section),
    ...(section.publicPath === undefined
      ? {}
      : { publicPath: section.publicPath }),
    questionCount: own.value.questionCount,
    sectionKey: section.sectionKey,
    timeLimitSeconds: own.value.timeLimitSeconds,
    title: section.title,
    visibility: section.visibility,
  };
});

/** Projects one set into the public catalog contract, with its counts and score kind from its facts. */
export function toPublicPublishedSet(
  set: CatalogSet,
  facts: SetFacts,
  sections: readonly CatalogSection[]
) {
  return {
    countryKey: set.countryKey,
    ...descriptionOf(set),
    examKey: set.examKey,
    publicPath: set.publicPath,
    questionCount: facts.questionCount,
    scoringStrategy: facts.scoringStrategy,
    sectionCount: facts.sections.length,
    setKey: set.setKey,
    title: set.title,
    trackKey: set.trackKey,
    visibleSectionCount: Arr.countBy(
      sections,
      ({ visibility }) => visibility === "visible"
    ),
  };
}

/**
 * Selects a set's entry: the internal entry section it names, or its first visible section. A set
 * without that section is a broken snapshot.
 */
export const readPublishedEntrySection = Effect.fn(
  "tryouts.catalog.readPublishedEntry"
)(function* (set: CatalogSet, sections: readonly CatalogSection[]) {
  const entry = Arr.findFirst(sections, ({ sectionKey, visibility }) =>
    set.internalEntrySectionKey === undefined
      ? visibility === "visible"
      : sectionKey === set.internalEntrySectionKey &&
        visibility === "internal-entry"
  );
  if (Option.isNone(entry)) {
    return yield* releaseFail(
      "CONTENT_RELEASE_INTEGRITY",
      "A try-out set has no section to enter."
    );
  }
  return entry.value;
});

/** Reads the set page of a set-local selection, none when the selected route is a section's. */
export const readPublishedSetPage = Effect.fn(
  "tryouts.catalog.readPublishedSetPage"
)(function* (selection: TryoutSetSelection) {
  if (selection.row.kind !== "set") {
    return null;
  }
  const { sections, set } = selection;
  const facts = yield* factsFor(
    yield* readSetFacts(selection.snapshotId, [set]),
    set
  );
  const entry = yield* readPublishedEntrySection(set, sections);
  return {
    entrySection: yield* toPublicPublishedSection(entry, facts),
    exam: toPublicExam(selection.exam),
    group: toPublicGroup(selection.group),
    sections: yield* Effect.forEach(
      Arr.filter(sections, ({ visibility }) => visibility === "visible"),
      (section) => toPublicPublishedSection(section, facts)
    ),
    set: toPublicPublishedSet(set, facts, sections),
    track: toPublicTrack(selection.track),
  };
});

/**
 * Reads the section page of a set-local selection, none when the selected route is the set's. Only a
 * visible section has a route of its own.
 */
export const readPublishedSectionPage = Effect.fn(
  "tryouts.catalog.readPublishedSectionPage"
)(function* (selection: TryoutSetSelection) {
  const { row, sections, set } = selection;
  if (row.kind !== "section") {
    return null;
  }
  const facts = yield* factsFor(
    yield* readSetFacts(selection.snapshotId, [set]),
    set
  );
  return {
    exam: toPublicExam(selection.exam),
    group: toPublicGroup(selection.group),
    section: yield* toPublicPublishedSection(row, facts),
    set: toPublicPublishedSet(set, facts, sections),
    track: toPublicTrack(selection.track),
  };
});
