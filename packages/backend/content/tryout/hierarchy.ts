import {
  type TryoutCatalogRowSchema,
  type TryoutCountry,
  TryoutCountrySchema,
  type TryoutExam,
  TryoutExamSchema,
  type TryoutSection,
  TryoutSectionSchema,
  type TryoutSet,
  TryoutSetSchema,
  type TryoutTrack,
  TryoutTrackSchema,
} from "@nakafa/aksara-contracts/tryout/catalog";
import { releaseFail } from "@repo/backend/confect/contentRelease/error";
import type { TrackIdentity } from "@repo/backend/confect/tryouts/sets/spec";
import type { loadTryoutCatalog } from "@repo/backend/content/tryout/catalog";
import { provesSetInventory } from "@repo/backend/content/tryout/inventory";
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
/** Verified localized catalog selected by the active release owner. */
export type PublishedCatalog = Effect.Success<
  ReturnType<typeof loadTryoutCatalog>
>;
export const PublishedCatalogIndexSchema = Schema.Struct({
  countries: Schema.Array(TryoutCountrySchema),
  exams: Schema.Array(TryoutExamSchema),
  sections: Schema.Array(TryoutSectionSchema),
  sets: Schema.Array(TryoutSetSchema),
  tracks: Schema.Array(TryoutTrackSchema),
});
/** Signed catalog rows split into their exact discriminated hierarchy kinds. */
export type PublishedCatalogIndex = typeof PublishedCatalogIndexSchema.Type;
/** Splits verified catalog rows and rejects duplicate public routes. */
export const indexPublishedCatalog = Effect.fn(
  "tryouts.catalog.indexPublishedCatalog"
)(function* (catalog: PublishedCatalog) {
  const countries = MutableList.make<TryoutCountry>();
  const exams = MutableList.make<TryoutExam>();
  const sections = MutableList.make<TryoutSection>();
  const sets = MutableList.make<TryoutSet>();
  const tracks = MutableList.make<TryoutTrack>();
  const publicPaths = MutableHashSet.empty<string>();
  const appendRow = Match.type<typeof TryoutCatalogRowSchema.Type>().pipe(
    Match.discriminatorsExhaustive("kind")({
      country: (row) => MutableList.append(countries, row),
      exam: (row) => MutableList.append(exams, row),
      section: (row) => MutableList.append(sections, row),
      set: (row) => MutableList.append(sets, row),
      track: (row) => MutableList.append(tracks, row),
    })
  );
  for (const { row } of catalog.entries) {
    if ("publicPath" in row && row.publicPath !== undefined) {
      if (MutableHashSet.has(publicPaths, row.publicPath)) {
        return yield* catalogIntegrity(
          `Signed try-out route ${row.publicPath} is duplicated.`
        );
      }
      MutableHashSet.add(publicPaths, row.publicPath);
    }
    appendRow(row);
  }
  const index: PublishedCatalogIndex = {
    countries: MutableList.toArray(countries),
    exams: MutableList.toArray(exams),
    sections: MutableList.toArray(sections),
    sets: MutableList.toArray(sets),
    tracks: MutableList.toArray(tracks),
  };
  return index;
});
/** Resolves and validates the country and exam parents of one track. */
export const readPublishedTrackParents = Effect.fn(
  "tryouts.catalog.readPublishedTrackParents"
)(function* (index: PublishedCatalogIndex, track: TryoutTrack) {
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
    return yield* catalogIntegrity("Signed try-out track lost its parents.");
  }
  return {
    country: country.value,
    exam: exam.value,
  };
});
/** Resolves and validates the hierarchy parents of one set. */
export const readPublishedSetParents = Effect.fn(
  "tryouts.catalog.readPublishedSetParents"
)(function* (index: PublishedCatalogIndex, set: TryoutSet) {
  const track = Arr.findFirst(
    index.tracks,
    (row) =>
      row.countryKey === set.countryKey &&
      row.examKey === set.examKey &&
      row.trackKey === set.trackKey
  );
  if (Option.isNone(track)) {
    return yield* catalogIntegrity("Signed try-out set lost its track.");
  }
  const parents = yield* readPublishedTrackParents(index, track.value);
  return {
    ...parents,
    track: track.value,
  };
});
/** Reads and validates every ordered section owned by one signed set. */
export const readPublishedSetSections = Effect.fn(
  "tryouts.catalog.readPublishedSetSections"
)(function* (index: PublishedCatalogIndex, set: TryoutSet) {
  const sections = sortCatalogRows(
    Arr.filter(
      index.sections,
      (section) =>
        section.countryKey === set.countryKey &&
        section.examKey === set.examKey &&
        section.trackKey === set.trackKey &&
        section.setKey === set.setKey
    )
  );
  if (!provesSetInventory(set, sections)) {
    return yield* catalogIntegrity(
      "Signed try-out set lost one or more sections."
    );
  }
  return sections;
});
/** Reads one signed track and all of its authored sets. */
export const readPublishedTrackSets = Effect.fn(
  "tryouts.catalog.readPublishedTrackSets"
)(function* (catalog: PublishedCatalog, identity: TrackIdentity) {
  const index = yield* indexPublishedCatalog(catalog);
  const track = Arr.findFirst(
    index.tracks,
    (row) =>
      row.countryKey === identity.countryKey &&
      row.examKey === identity.examKey &&
      row.trackKey === identity.trackKey &&
      row.appLocale === identity.locale
  );
  if (Option.isNone(track)) {
    return null;
  }
  yield* readPublishedTrackParents(index, track.value);
  const sets = sortCatalogRows(
    Arr.filter(
      index.sets,
      (set) =>
        set.countryKey === track.value.countryKey &&
        set.examKey === track.value.examKey &&
        set.trackKey === track.value.trackKey
    )
  );
  if (sets.length !== track.value.setCount) {
    return yield* catalogIntegrity(
      "Signed try-out track lost one or more sets."
    );
  }
  return {
    index,
    sets,
    track: track.value,
  };
});
/** Resolves the set that owns one signed section. */
export function findPublishedSet(
  index: PublishedCatalogIndex,
  section: TryoutSection
) {
  return Arr.findFirst(
    index.sets,
    (set) =>
      set.countryKey === section.countryKey &&
      set.examKey === section.examKey &&
      set.trackKey === section.trackKey &&
      set.setKey === section.setKey
  );
}
/** Returns a copied catalog list in stable authored order. */
export function sortCatalogRows<
  Row extends {
    readonly order: number;
  },
>(rows: readonly Row[]) {
  return Arr.sort(
    rows,
    Order.make<Row>((left, right) => {
      const delta = left.order - right.order;
      if (delta < 0) {
        return -1;
      }
      return delta > 0 ? 1 : 0;
    })
  );
}
/** Creates one typed fail-closed published catalog error. */
function catalogIntegrity(message: string) {
  return releaseFail("CONTENT_RELEASE_INTEGRITY", message);
}
