import { releaseFail } from "@repo/backend/confect/contentRelease/error";
import type { PublishedCatalog } from "@repo/backend/content/tryout/catalog";
import {
  indexPublishedCatalog,
  type PublishedCatalogIndex,
  readPublishedExamGroups,
  readPublishedGroupEntry,
  readPublishedGroupParents,
  readPublishedGroupTracks,
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

type CatalogCountryRow = PublishedCatalogIndex["countries"][number];
type CatalogGroupRow = PublishedCatalogIndex["groups"][number];

/**
 * Reads the exams of one country in order, each with its entry: where its card
 * links, its first group's entry. An exam without a group is a broken snapshot.
 */
const readCountryExams = Effect.fn("tryouts.catalog.readCountryExams")(
  function* (index: PublishedCatalogIndex, country: CatalogCountryRow) {
    const exams = sortCatalogRows(
      Arr.filter(index.exams, (row) => row.countryKey === country.countryKey)
    );
    return yield* Effect.forEach(exams, (exam) =>
      Option.match(Arr.head(readPublishedExamGroups(index, exam)), {
        onNone: () =>
          releaseFail(
            "CONTENT_RELEASE_INTEGRITY",
            "A try-out exam has no group."
          ),
        onSome: (group) =>
          Effect.succeed({
            ...toPublicExam(exam),
            entryPath: readPublishedGroupEntry(index, group),
          }),
      })
    );
  }
);

/** Lists the groups a page's selector offers, each with the entry choosing it lands on. */
function toGroupChoices(
  index: PublishedCatalogIndex,
  groups: readonly CatalogGroupRow[]
) {
  return Arr.map(groups, (group) => ({
    ...toPublicGroup(group),
    entryPath: readPublishedGroupEntry(index, group),
  }));
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

/** Reads one country page of one catalog with its exams and their entries, none when no country holds the path. */
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
    exams: yield* readCountryExams(index, country.value),
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
    groups: toGroupChoices(index, parents.groups),
  };
});

/**
 * Reads one group page of one catalog: its exam's groups, which the group selector offers with
 * their entries, and its own tracks in order. None when no group holds the path.
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
  return {
    country: toPublicCountry(parents.country),
    exam: toPublicExam(parents.exam),
    group: toPublicGroup(group.value),
    groups: toGroupChoices(index, parents.groups),
    tracks: Arr.map(
      readPublishedGroupTracks(index, group.value),
      toPublicTrack
    ),
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
    groups: toGroupChoices(index, parents.groups),
    track: toPublicTrack(track.value),
  };
});
