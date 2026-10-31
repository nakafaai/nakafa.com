import {
  CatalogCountrySchema,
  CatalogExamSchema,
  type CatalogRow,
  CatalogSectionSchema,
  CatalogSetSchema,
  CatalogTrackSchema,
} from "@nakafa/aksara-contracts/assessment/catalog";
import { releaseFail } from "@repo/backend/confect/contentRelease/error";
import type { TrackIdentity } from "@repo/backend/confect/tryouts/sets/spec";
import type { PublishedCatalog } from "@repo/backend/content/tryout/catalog";
import {
  Array as Arr,
  Effect,
  Match,
  MutableHashSet,
  MutableList,
  Option,
  Order,
  Schema,
} from "effect";

type CatalogCountry = typeof CatalogCountrySchema.Type;
type CatalogExam = typeof CatalogExamSchema.Type;
type CatalogSection = typeof CatalogSectionSchema.Type;
type CatalogSet = typeof CatalogSetSchema.Type;
type CatalogTrack = typeof CatalogTrackSchema.Type;

/** The catalog rows of one locale split by kind, with the snapshot they belong to. */
const PublishedCatalogIndexSchema = Schema.Struct({
  countries: Schema.Array(CatalogCountrySchema),
  exams: Schema.Array(CatalogExamSchema),
  sections: Schema.Array(CatalogSectionSchema),
  sets: Schema.Array(CatalogSetSchema),
  snapshotId: Schema.String,
  tracks: Schema.Array(CatalogTrackSchema),
});
type PublishedCatalogIndex = typeof PublishedCatalogIndexSchema.Type;

/** Splits one locale's catalog rows by kind and rejects a public route held twice. */
export const indexPublishedCatalog = Effect.fn(
  "tryouts.catalog.indexPublishedCatalog"
)(function* (catalog: PublishedCatalog) {
  const countries = MutableList.make<CatalogCountry>();
  const exams = MutableList.make<CatalogExam>();
  const sections = MutableList.make<CatalogSection>();
  const sets = MutableList.make<CatalogSet>();
  const tracks = MutableList.make<CatalogTrack>();
  const publicPaths = MutableHashSet.empty<string>();
  const appendRow = Match.type<CatalogRow>().pipe(
    Match.discriminatorsExhaustive("kind")({
      country: (row) => MutableList.append(countries, row),
      exam: (row) => MutableList.append(exams, row),
      section: (row) => MutableList.append(sections, row),
      set: (row) => MutableList.append(sets, row),
      track: (row) => MutableList.append(tracks, row),
    })
  );
  for (const row of catalog.rows) {
    if (row.publicPath !== undefined) {
      if (MutableHashSet.has(publicPaths, row.publicPath)) {
        return yield* catalogIntegrity(
          `Try-out route ${row.publicPath} is held twice.`
        );
      }
      MutableHashSet.add(publicPaths, row.publicPath);
    }
    appendRow(row);
  }
  return {
    countries: MutableList.toArray(countries),
    exams: MutableList.toArray(exams),
    sections: MutableList.toArray(sections),
    sets: MutableList.toArray(sets),
    snapshotId: catalog.snapshotId,
    tracks: MutableList.toArray(tracks),
  } satisfies PublishedCatalogIndex;
});

/** Resolves the country and exam a track belongs to. */
export const readPublishedTrackParents = Effect.fn(
  "tryouts.catalog.readPublishedTrackParents"
)(function* (index: PublishedCatalogIndex, track: CatalogTrack) {
  const country = Arr.findFirst(
    index.countries,
    (row) => row.countryKey === track.countryKey
  );
  const exam = Arr.findFirst(
    index.exams,
    (row) =>
      row.countryKey === track.countryKey && row.examKey === track.examKey
  );
  if (!(Option.isSome(country) && Option.isSome(exam))) {
    return yield* catalogIntegrity("A try-out track lost its parents.");
  }
  return { country: country.value, exam: exam.value };
});

/** Returns the sections of one set in their authored order. */
export function readPublishedSetSections(
  index: PublishedCatalogIndex,
  set: CatalogSet
) {
  return sortCatalogRows(
    Arr.filter(
      index.sections,
      (section) =>
        section.countryKey === set.countryKey &&
        section.examKey === set.examKey &&
        section.trackKey === set.trackKey &&
        section.setKey === set.setKey
    )
  );
}

/** Returns the sets of one track in their authored order. */
function readPublishedTrackSetRows(
  index: PublishedCatalogIndex,
  track: Pick<CatalogTrack, "countryKey" | "examKey" | "trackKey">
) {
  return sortCatalogRows(
    Arr.filter(
      index.sets,
      (set) =>
        set.countryKey === track.countryKey &&
        set.examKey === track.examKey &&
        set.trackKey === track.trackKey
    )
  );
}

/** Reads one track of a locale's catalog with its sets, none when the locale has no such track. */
export const readPublishedTrackSets = Effect.fn(
  "tryouts.catalog.readPublishedTrackSets"
)(function* (catalog: PublishedCatalog, identity: TrackIdentity) {
  const index = yield* indexPublishedCatalog(catalog);
  const track = Arr.findFirst(
    index.tracks,
    (row) =>
      row.countryKey === identity.countryKey &&
      row.examKey === identity.examKey &&
      row.trackKey === identity.trackKey
  );
  if (Option.isNone(track)) {
    return null;
  }
  yield* readPublishedTrackParents(index, track.value);
  return {
    index,
    sets: readPublishedTrackSetRows(index, track.value),
    track: track.value,
  };
});

/** Returns a copied catalog list in its authored order. */
export function sortCatalogRows<Row extends { readonly order: number }>(
  rows: readonly Row[]
) {
  return Arr.sort(
    rows,
    Order.mapInput(Order.Number, (row: Row) => row.order)
  );
}

/** Creates one typed fail-closed catalog error. */
function catalogIntegrity(message: string) {
  return releaseFail("CONTENT_RELEASE_INTEGRITY", message);
}
