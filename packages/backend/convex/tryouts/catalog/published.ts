import type {
  TryoutCountry,
  TryoutExam,
  TryoutSection,
  TryoutSet,
  TryoutTrack,
} from "@nakafa/aksara-contracts/tryout/spec";
import { releaseFail } from "@repo/backend/convex/contentRelease/error";
import {
  findPublishedSet,
  indexPublishedCatalog,
  type PublishedCatalog,
  readPublishedSetParents,
  readPublishedSetSections,
  readPublishedTrackParents,
  sortCatalogRows,
} from "@repo/backend/convex/tryouts/catalog/hierarchy";
import { Effect } from "effect";

/** Projects one signed country into the existing public catalog contract. */
function toPublicCountry(country: TryoutCountry) {
  return {
    countryCode: country.countryCode,
    countryKey: country.countryKey,
    description: country.description,
    publicPath: country.publicPath,
    title: country.title,
  };
}

/** Projects one signed exam into the existing public catalog contract. */
function toPublicExam(exam: TryoutExam) {
  return {
    description: exam.description,
    examKey: exam.examKey,
    publicPath: exam.publicPath,
    scoringStrategy: exam.scoringStrategy,
    title: exam.title,
  };
}

/** Projects one signed track into the existing public catalog contract. */
function toPublicTrack(track: TryoutTrack) {
  return {
    description: track.description,
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
    description: set.description,
    examKey: set.examKey,
    internalEntrySectionKey: set.internalEntrySectionKey,
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
function toPublicSection(section: TryoutSection) {
  return {
    description: section.description,
    publicPath: section.publicPath,
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
  const countries = sortCatalogRows(index.countries).map((country) => ({
    ...toPublicCountry(country),
    examCount: index.exams.filter(
      (exam) => exam.countryKey === country.countryKey
    ).length,
  }));
  return { countries };
});

/** Reads one country page from one verified signed catalog. */
export const readPublishedCountryPage = Effect.fn(
  "tryouts.catalog.readPublishedCountryPage"
)(function* (catalog: PublishedCatalog, publicPath: string) {
  const index = yield* indexPublishedCatalog(catalog);
  const country = index.countries.find((row) => row.publicPath === publicPath);
  if (!country) {
    return null;
  }
  const exams = sortCatalogRows(
    index.exams.filter((row) => row.countryKey === country.countryKey)
  );
  return {
    country: toPublicCountry(country),
    exams: exams.map(toPublicExam),
  };
});

/** Reads one exam page from one verified signed catalog. */
export const readPublishedExamPage = Effect.fn(
  "tryouts.catalog.readPublishedExamPage"
)(function* (catalog: PublishedCatalog, publicPath: string) {
  const index = yield* indexPublishedCatalog(catalog);
  const exam = index.exams.find((row) => row.publicPath === publicPath);
  if (!exam) {
    return null;
  }
  const country = index.countries.find(
    (row) => row.countryKey === exam.countryKey
  );
  if (!country) {
    return yield* releaseFail(
      "CONTENT_RELEASE_INTEGRITY",
      "Signed try-out exam lost its country."
    );
  }
  const tracks = sortCatalogRows(
    index.tracks.filter(
      (row) =>
        row.countryKey === exam.countryKey && row.examKey === exam.examKey
    )
  );
  return {
    country: toPublicCountry(country),
    exam: toPublicExam(exam),
    tracks: tracks.map(toPublicTrack),
  };
});

/** Reads one track shell from one verified signed catalog. */
export const readPublishedTrackPage = Effect.fn(
  "tryouts.catalog.readPublishedTrackPage"
)(function* (catalog: PublishedCatalog, publicPath: string) {
  const index = yield* indexPublishedCatalog(catalog);
  const track = index.tracks.find((row) => row.publicPath === publicPath);
  if (!track) {
    return null;
  }
  const parents = yield* readPublishedTrackParents(index, track);
  return {
    country: toPublicCountry(parents.country),
    exam: toPublicExam(parents.exam),
    track: toPublicTrack(track),
  };
});

/** Reads one set page from one verified signed catalog. */
export const readPublishedSetPage = Effect.fn(
  "tryouts.catalog.readPublishedSetPage"
)(function* (catalog: PublishedCatalog, publicPath: string) {
  const index = yield* indexPublishedCatalog(catalog);
  const set = index.sets.find((row) => row.publicPath === publicPath);
  if (!set) {
    return null;
  }
  const parents = yield* readPublishedSetParents(index, set);
  const sections = yield* readPublishedSetSections(index, set);
  const visibleSections = sections.filter(
    (section) => section.visibility === "visible"
  );
  const entrySection = yield* readEntrySection(set, sections, visibleSections);
  return {
    exam: toPublicExam(parents.exam),
    entrySection: entrySection ? toPublicSection(entrySection) : null,
    set: toPublicPublishedSet(set),
    sections: visibleSections.map(toPublicSection),
    track: toPublicTrack(parents.track),
  };
});

/** Reads one visible section page from one verified signed catalog. */
export const readPublishedSectionPage = Effect.fn(
  "tryouts.catalog.readPublishedSectionPage"
)(function* (catalog: PublishedCatalog, publicPath: string) {
  const index = yield* indexPublishedCatalog(catalog);
  const section = index.sections.find(
    (row) => row.publicPath === publicPath && row.visibility === "visible"
  );
  if (!section) {
    return null;
  }
  const set = findPublishedSet(index, section);
  if (!set) {
    return yield* releaseFail(
      "CONTENT_RELEASE_INTEGRITY",
      "Signed try-out section lost its set."
    );
  }
  const parents = yield* readPublishedSetParents(index, set);
  yield* readPublishedSetSections(index, set);
  return {
    exam: toPublicExam(parents.exam),
    section: toPublicSection(section),
    set: toPublicPublishedSet(set),
    track: toPublicTrack(parents.track),
  };
});

/** Selects and validates the authored internal entry or first visible section. */
const readEntrySection = Effect.fn("tryouts.catalog.readPublishedEntry")(
  function* (
    set: TryoutSet,
    sections: readonly TryoutSection[],
    visibleSections: readonly TryoutSection[]
  ) {
    if (!set.internalEntrySectionKey) {
      return visibleSections.at(0) ?? null;
    }

    const entrySection = sections.find(
      (section) => section.sectionKey === set.internalEntrySectionKey
    );
    if (entrySection?.visibility !== "internal-entry") {
      return yield* releaseFail(
        "CONTENT_RELEASE_INTEGRITY",
        "Signed try-out set lost its internal entry section."
      );
    }
    return entrySection;
  }
);
