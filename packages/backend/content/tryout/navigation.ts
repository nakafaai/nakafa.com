import { releaseFail } from "@repo/backend/confect/contentRelease/error";
import type { PublishedCatalog } from "@repo/backend/content/tryout/catalog";
import {
  indexPublishedCatalog,
  readPublishedExamGroups,
  readPublishedGroupParents,
  readPublishedTrackParents,
  sortCatalogRows,
} from "@repo/backend/content/tryout/hierarchy";
import {
  toPublicCountry,
  toPublicExam,
  toPublicGroup,
  toPublicTrack,
} from "@repo/backend/content/tryout/node";
import { Array as Arr, Effect, Option } from "effect";

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

/**
 * Reads one country page of one catalog, none when no country holds the path. Each exam names
 * its entry, the path of its first group, where a link to the exam lands. An exam without a group
 * is a broken snapshot.
 */
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
    exams: yield* Effect.forEach(exams, (exam) =>
      Option.match(Arr.head(readPublishedExamGroups(index, exam)), {
        onNone: () =>
          releaseFail(
            "CONTENT_RELEASE_INTEGRITY",
            "A try-out exam has no group."
          ),
        onSome: (group) =>
          Effect.succeed({ ...toPublicExam(exam), entryPath: group.publicPath }),
      })
    ),
  };
});

/** Reads one exam of one catalog with its groups in order, none when no exam holds the path. */
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
  const parents = yield* readPublishedGroupParents(index, exam.value);
  return {
    country: toPublicCountry(parents.country),
    exam: toPublicExam(parents.exam),
    groups: Arr.map(parents.groups, toPublicGroup),
  };
});

/**
 * Reads one group page of one catalog: its exam's groups, which the group selector offers, and its
 * own tracks in order. None when no group holds the path.
 */
export const readPublishedGroupPage = Effect.fn(
  "tryouts.catalog.readPublishedGroupPage"
)(function* (catalog: PublishedCatalog, publicPath: string) {
  const index = yield* indexPublishedCatalog(catalog);
  const group = Arr.findFirst(
    index.groups,
    (row) => row.publicPath === publicPath
  );
  if (Option.isNone(group)) {
    return null;
  }
  const parents = yield* readPublishedGroupParents(index, group.value);
  const tracks = sortCatalogRows(
    Arr.filter(
      index.tracks,
      (row) =>
        row.countryKey === group.value.countryKey &&
        row.examKey === group.value.examKey &&
        row.groupKey === group.value.groupKey
    )
  );
  return {
    country: toPublicCountry(parents.country),
    exam: toPublicExam(parents.exam),
    group: toPublicGroup(group.value),
    groups: Arr.map(parents.groups, toPublicGroup),
    tracks: Arr.map(tracks, toPublicTrack),
  };
});

/** Reads one track shell of one catalog with its group and its exam's groups, none when no track holds the path. */
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
    group: toPublicGroup(parents.group),
    groups: Arr.map(parents.groups, toPublicGroup),
    track: toPublicTrack(track.value),
  };
});
