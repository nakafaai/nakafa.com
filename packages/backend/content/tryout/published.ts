import type {
  TryoutCountry,
  TryoutExam,
  TryoutSection,
  TryoutSet,
  TryoutTrack,
} from "@nakafa/aksara-contracts/tryout/catalog";
import { releaseFail } from "@repo/backend/confect/contentRelease/error";
import {
  findPublishedSet,
  indexPublishedCatalog,
  type PublishedCatalog,
  type PublishedCatalogIndex,
  readPublishedSetParents,
  readPublishedSetSections,
  readPublishedTrackParents,
  sortCatalogRows,
} from "@repo/backend/content/tryout/hierarchy";
import { Array as Arr, Effect, Option } from "effect";

/** Projects one signed country into the existing public catalog contract. */
function toPublicCountry(country: TryoutCountry) {
  return {
    countryCode: country.countryCode,
    countryKey: country.countryKey,
    ...(country.description === undefined
      ? {}
      : {
          description: country.description,
        }),
    publicPath: country.publicPath,
    title: country.title,
  };
}

/** Projects one signed exam into the existing public catalog contract. */
function toPublicExam(exam: TryoutExam) {
  return {
    ...(exam.description === undefined
      ? {}
      : {
          description: exam.description,
        }),
    examKey: exam.examKey,
    publicPath: exam.publicPath,
    scoringStrategy: exam.scoringStrategy,
    title: exam.title,
  };
}

/** Projects one signed track into the existing public catalog contract. */
function toPublicTrack(track: TryoutTrack) {
  return {
    ...(track.description === undefined
      ? {}
      : {
          description: track.description,
        }),
    publicPath: track.publicPath,
    readyQuestionCount: track.questionCount,
    readySetCount: track.setCount,
    readyVisibleSectionCount: track.visibleSectionCount,
    title: track.title,
    trackKey: track.trackKey,
    trackKind: track.trackKind,
  };
}

/** Projects one signed set into the existing public catalog contract. */
export function toPublicPublishedSet(set: TryoutSet) {
  return {
    countryKey: set.countryKey,
    ...(set.description === undefined
      ? {}
      : {
          description: set.description,
        }),
    examKey: set.examKey,
    publicPath: set.publicPath,
    readyQuestionCount: set.questionCount,
    readyVisibleSectionCount: set.visibleSectionCount,
    scoringStrategy: set.scoringStrategy,
    sectionCount: set.sectionCount,
    setKey: set.setKey,
    title: set.title,
    totalQuestionCount: set.questionCount,
    trackKey: set.trackKey,
    visibleSectionCount: set.visibleSectionCount,
  };
}

/** Projects one signed section into the existing public catalog contract. */
export function toPublicPublishedSection(section: TryoutSection) {
  return {
    ...(section.description === undefined
      ? {}
      : {
          description: section.description,
        }),
    ...(section.publicPath === undefined
      ? {}
      : {
          publicPath: section.publicPath,
        }),
    questionCount: section.questionCount,
    sectionKey: section.sectionKey,
    timeLimitSeconds: section.timeLimitSeconds,
    title: section.title,
    visibility: section.visibility,
  };
}

/** Reads the localized country-first hub from one verified signed catalog. */
export const readPublishedHubPage = Effect.fn(
  "tryouts.catalog.readPublishedHubPage"
)(function* (catalog: PublishedCatalog) {
  const index = yield* indexPublishedCatalog(catalog);
  const countries = Arr.map(sortCatalogRows(index.countries), (country) => ({
    ...toPublicCountry(country),
    examCount: Arr.filter(
      index.exams,
      (exam) => exam.countryKey === country.countryKey
    ).length,
  }));
  return {
    countries,
  };
});

/** Reads one country page from one verified signed catalog. */
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
  const exams = sortCatalogRows(
    Arr.filter(
      index.exams,
      (row) => row.countryKey === country.value.countryKey
    )
  );
  return {
    country: toPublicCountry(country.value),
    exams: Arr.map(exams, toPublicExam),
  };
});

/** Reads one exam page from one verified signed catalog. */
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
      "Signed try-out exam lost its country."
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

/** Reads one track shell from one verified signed catalog. */
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

/** Reads one set page from a verified set-local catalog index. */
export const readPublishedSetPageFromIndex = Effect.fn(
  "tryouts.catalog.readPublishedSetPageFromIndex"
)(function* (index: PublishedCatalogIndex, publicPath: string) {
  const set = Arr.findFirst(index.sets, (row) => row.publicPath === publicPath);
  if (Option.isNone(set)) {
    return null;
  }
  const parents = yield* readPublishedSetParents(index, set.value);
  const sections = yield* readPublishedSetSections(index, set.value);
  const visibleSections = Arr.filter(
    sections,
    (section) => section.visibility === "visible"
  );
  const entrySection = yield* readPublishedEntrySection(
    set.value,
    sections,
    visibleSections
  );
  // Verified positive section counts guarantee the authored visible or internal entry.
  const entry = yield* Effect.fromNullishOr(entrySection).pipe(Effect.orDie);
  return {
    exam: toPublicExam(parents.exam),
    entrySection: toPublicPublishedSection(entry),
    set: toPublicPublishedSet(set.value),
    sections: Arr.map(visibleSections, toPublicPublishedSection),
    track: toPublicTrack(parents.track),
  };
});

/** Reads one section page from a verified set-local catalog index. */
export const readPublishedSectionPageFromIndex = Effect.fn(
  "tryouts.catalog.readPublishedSectionPageFromIndex"
)(function* (index: PublishedCatalogIndex, publicPath: string) {
  const section = Arr.findFirst(
    index.sections,
    (row) => row.publicPath === publicPath && row.visibility === "visible"
  );
  if (Option.isNone(section)) {
    return null;
  }
  const set = findPublishedSet(index, section.value);
  if (Option.isNone(set)) {
    return yield* releaseFail(
      "CONTENT_RELEASE_INTEGRITY",
      "Signed try-out section lost its set."
    );
  }
  const parents = yield* readPublishedSetParents(index, set.value);
  yield* readPublishedSetSections(index, set.value);
  return {
    exam: toPublicExam(parents.exam),
    section: toPublicPublishedSection(section.value),
    set: toPublicPublishedSet(set.value),
    track: toPublicTrack(parents.track),
  };
});

/** Selects and validates the authored internal entry or first visible section. */
export const readPublishedEntrySection = Effect.fn(
  "tryouts.catalog.readPublishedEntry"
)(function* (
  set: TryoutSet,
  sections: readonly TryoutSection[],
  visibleSections: readonly TryoutSection[]
) {
  if (!set.internalEntrySectionKey) {
    return Option.getOrNull(Arr.head(visibleSections));
  }
  const entrySection = Arr.findFirst(
    sections,
    (section) => section.sectionKey === set.internalEntrySectionKey
  );
  if (
    Option.isNone(entrySection) ||
    entrySection.value.visibility !== "internal-entry"
  ) {
    return yield* releaseFail(
      "CONTENT_RELEASE_INTEGRITY",
      "Signed try-out set lost its internal entry section."
    );
  }
  return entrySection.value;
});
