import type {
  CatalogCountrySchema,
  CatalogExamSchema,
  CatalogSectionSchema,
  CatalogSetSchema,
  CatalogTrackSchema,
} from "@nakafa/aksara-contracts/assessment/catalog";
import { releaseFail } from "@repo/backend/confect/contentRelease/error";
import { tryoutSetIdentityOf } from "@repo/backend/confect/tryouts/route";
import type { PublishedCatalog } from "@repo/backend/content/tryout/catalog";
import {
  readSetFacts,
  type SetFacts,
} from "@repo/backend/content/tryout/facts";
import {
  indexPublishedCatalog,
  readPublishedTrackParents,
  sortCatalogRows,
} from "@repo/backend/content/tryout/hierarchy";
import type { TryoutSetSelection } from "@repo/backend/content/tryout/selection";
import { Array as Arr, Effect, HashMap, Option } from "effect";

type CatalogCountry = typeof CatalogCountrySchema.Type;
type CatalogExam = typeof CatalogExamSchema.Type;
type CatalogSection = typeof CatalogSectionSchema.Type;
type CatalogSet = typeof CatalogSetSchema.Type;
type CatalogTrack = typeof CatalogTrackSchema.Type;
type FactsBySet = HashMap.HashMap<string, SetFacts>;

/** The description of a catalog row, when it has one, as a public model spreads it. */
const descriptionOf = (row: { readonly description?: string }) =>
  row.description === undefined ? {} : { description: row.description };

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

/** Projects one country into the public catalog contract. */
function toPublicCountry(country: CatalogCountry) {
  return {
    countryCode: country.countryCode,
    countryKey: country.countryKey,
    ...descriptionOf(country),
    publicPath: country.publicPath,
    title: country.title,
  };
}

/** Projects one exam into the public catalog contract. */
function toPublicExam(exam: CatalogExam) {
  return {
    ...descriptionOf(exam),
    examKey: exam.examKey,
    publicPath: exam.publicPath,
    title: exam.title,
  };
}

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

/** Projects one track into the public catalog contract. */
function toPublicTrack(track: CatalogTrack) {
  return {
    ...descriptionOf(track),
    publicPath: track.publicPath,
    title: track.title,
    trackKey: track.trackKey,
    trackKind: track.trackKind,
  };
}

/** Reads the localized country-first hub of one catalog, with each country's exam count. */
export const readPublishedHubPage = Effect.fn(
  "tryouts.catalog.readPublishedHubPage"
)(function* (catalog: PublishedCatalog) {
  const index = yield* indexPublishedCatalog(catalog);
  return {
    countries: Arr.map(sortCatalogRows(index.countries), (country) => ({
      ...toPublicCountry(country),
      examCount: Arr.countBy(
        index.exams,
        (exam) => exam.countryKey === country.countryKey
      ),
    })),
  };
});

/** Reads one country page of one catalog, none when no country holds the path. */
export const readPublishedCountryPage = Effect.fn(
  "tryouts.catalog.readPublishedCountryPage"
)(function* (catalog: PublishedCatalog, publicPath: string) {
  const index = yield* indexPublishedCatalog(catalog);
  const country = Arr.findFirst(
    index.countries,
    (row) => row.publicPath === publicPath
  );
  if (Option.isNone(country)) {
    return null;
  }
  return {
    country: toPublicCountry(country.value),
    exams: Arr.map(
      sortCatalogRows(
        Arr.filter(
          index.exams,
          (row) => row.countryKey === country.value.countryKey
        )
      ),
      toPublicExam
    ),
  };
});

/** Reads one exam page of one catalog with its tracks, none when no exam holds the path. */
export const readPublishedExamPage = Effect.fn(
  "tryouts.catalog.readPublishedExamPage"
)(function* (catalog: PublishedCatalog, publicPath: string) {
  const index = yield* indexPublishedCatalog(catalog);
  const exam = Arr.findFirst(
    index.exams,
    (row) => row.publicPath === publicPath
  );
  if (Option.isNone(exam)) {
    return null;
  }
  const country = Arr.findFirst(
    index.countries,
    (row) => row.countryKey === exam.value.countryKey
  );
  if (Option.isNone(country)) {
    return yield* releaseFail(
      "CONTENT_RELEASE_INTEGRITY",
      "A try-out exam lost its country."
    );
  }
  const tracks = sortCatalogRows(
    Arr.filter(
      index.tracks,
      (row) =>
        row.countryKey === exam.value.countryKey &&
        row.examKey === exam.value.examKey
    )
  );
  return {
    country: toPublicCountry(country.value),
    exam: toPublicExam(exam.value),
    tracks: Arr.map(tracks, toPublicTrack),
  };
});

/** Reads one track shell of one catalog, none when no track holds the path. */
export const readPublishedTrackPage = Effect.fn(
  "tryouts.catalog.readPublishedTrackPage"
)(function* (catalog: PublishedCatalog, publicPath: string) {
  const index = yield* indexPublishedCatalog(catalog);
  const track = Arr.findFirst(
    index.tracks,
    (row) => row.publicPath === publicPath
  );
  if (Option.isNone(track)) {
    return null;
  }
  const parents = yield* readPublishedTrackParents(index, track.value);
  return {
    country: toPublicCountry(parents.country),
    exam: toPublicExam(parents.exam),
    track: toPublicTrack(track.value),
  };
});

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
    section: yield* toPublicPublishedSection(row, facts),
    set: toPublicPublishedSet(set, facts, sections),
    track: toPublicTrack(selection.track),
  };
});
