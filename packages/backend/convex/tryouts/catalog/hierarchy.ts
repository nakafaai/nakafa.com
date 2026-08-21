import type {
  TryoutCountry,
  TryoutExam,
  TryoutSection,
  TryoutSet,
  TryoutTrack,
} from "@nakafa/aksara-contracts/tryout/catalog";
import { releaseFail } from "@repo/backend/convex/contentRelease/error";
import type { loadTryoutCatalog } from "@repo/backend/convex/contentRelease/tryout/catalog";
import type { TrackIdentity } from "@repo/backend/convex/tryouts/sets/spec";
import { Effect } from "effect";
/** Verified localized catalog selected by the active release owner. */
export type PublishedCatalog = Effect.Success<
  ReturnType<typeof loadTryoutCatalog>
>;
/** Signed catalog rows split into their exact discriminated hierarchy kinds. */
export interface PublishedCatalogIndex {
  readonly countries: readonly TryoutCountry[];
  readonly exams: readonly TryoutExam[];
  readonly sections: readonly TryoutSection[];
  readonly sets: readonly TryoutSet[];
  readonly tracks: readonly TryoutTrack[];
}
/** Splits verified catalog rows and rejects duplicate public routes. */
export const indexPublishedCatalog = Effect.fn(
  "tryouts.catalog.indexPublishedCatalog"
)(function* (catalog: PublishedCatalog) {
  const countries: TryoutCountry[] = [];
  const exams: TryoutExam[] = [];
  const sections: TryoutSection[] = [];
  const sets: TryoutSet[] = [];
  const tracks: TryoutTrack[] = [];
  const publicPaths = new Set<string>();
  for (const { row } of catalog.entries) {
    if ("publicPath" in row && row.publicPath !== undefined) {
      if (publicPaths.has(row.publicPath)) {
        return yield* catalogIntegrity(
          `Signed try-out route ${row.publicPath} is duplicated.`
        );
      }
      publicPaths.add(row.publicPath);
    }
    switch (row.kind) {
      case "country":
        countries.push(row);
        break;
      case "exam":
        exams.push(row);
        break;
      case "section":
        sections.push(row);
        break;
      case "set":
        sets.push(row);
        break;
      case "track":
        tracks.push(row);
        break;
      default:
        return yield* catalogIntegrity(
          "Signed try-out catalog contains an unsupported row kind."
        );
    }
  }
  const index: PublishedCatalogIndex = {
    countries,
    exams,
    sections,
    sets,
    tracks,
  };
  return index;
});
/** Resolves and validates the country and exam parents of one track. */
export const readPublishedTrackParents = Effect.fn(
  "tryouts.catalog.readPublishedTrackParents"
)(function* (index: PublishedCatalogIndex, track: TryoutTrack) {
  const country = index.countries.find(
    (row) => row.countryKey === track.countryKey
  );
  const exam = index.exams.find(
    (row) =>
      row.countryKey === track.countryKey && row.examKey === track.examKey
  );
  if (!(country && exam)) {
    return yield* catalogIntegrity("Signed try-out track lost its parents.");
  }
  return { country, exam };
});
/** Resolves and validates the hierarchy parents of one set. */
export const readPublishedSetParents = Effect.fn(
  "tryouts.catalog.readPublishedSetParents"
)(function* (index: PublishedCatalogIndex, set: TryoutSet) {
  const track = index.tracks.find(
    (row) =>
      row.countryKey === set.countryKey &&
      row.examKey === set.examKey &&
      row.trackKey === set.trackKey
  );
  if (!track) {
    return yield* catalogIntegrity("Signed try-out set lost its track.");
  }
  const parents = yield* readPublishedTrackParents(index, track);
  return { ...parents, track };
});
/** Reads and validates every ordered section owned by one signed set. */
export const readPublishedSetSections = Effect.fn(
  "tryouts.catalog.readPublishedSetSections"
)(function* (index: PublishedCatalogIndex, set: TryoutSet) {
  const sections = sortCatalogRows(
    index.sections.filter(
      (section) =>
        section.countryKey === set.countryKey &&
        section.examKey === set.examKey &&
        section.trackKey === set.trackKey &&
        section.setKey === set.setKey
    )
  );
  const questionCount = sections.reduce(
    (total, section) => total + section.questionCount,
    0
  );
  const visibleCount = sections.filter(
    (section) => section.visibility === "visible"
  ).length;
  if (
    sections.length !== set.sectionCount ||
    questionCount !== set.questionCount ||
    visibleCount !== set.visibleSectionCount
  ) {
    return yield* catalogIntegrity(
      "Signed try-out set lost one or more sections."
    );
  }
  return sections;
});
/** Finds one signed set by its stable authored identity. */
export const readPublishedSet = Effect.fn("tryouts.catalog.readPublishedSet")(
  function* (
    catalog: PublishedCatalog,
    identity: TrackIdentity & {
      readonly setKey: string;
    }
  ) {
    const index = yield* indexPublishedCatalog(catalog);
    return (
      index.sets.find(
        (set) =>
          set.countryKey === identity.countryKey &&
          set.examKey === identity.examKey &&
          set.trackKey === identity.trackKey &&
          set.setKey === identity.setKey &&
          set.appLocale === identity.locale
      ) ?? null
    );
  }
);
/** Finds one visible signed section by its stable authored identity. */
export const readPublishedSection = Effect.fn(
  "tryouts.catalog.readPublishedSection"
)(function* (
  catalog: PublishedCatalog,
  identity: TrackIdentity & {
    readonly sectionKey: string;
    readonly setKey: string;
  }
) {
  const index = yield* indexPublishedCatalog(catalog);
  return (
    index.sections.find(
      (section) =>
        section.countryKey === identity.countryKey &&
        section.examKey === identity.examKey &&
        section.trackKey === identity.trackKey &&
        section.setKey === identity.setKey &&
        section.sectionKey === identity.sectionKey &&
        section.appLocale === identity.locale &&
        section.visibility === "visible"
    ) ?? null
  );
});
/** Finds one signed set by its localized public path. */
export const readPublishedSetByPath = Effect.fn(
  "tryouts.catalog.readPublishedSetByPath"
)(function* (catalog: PublishedCatalog, publicPath: string) {
  const index = yield* indexPublishedCatalog(catalog);
  return index.sets.find((set) => set.publicPath === publicPath) ?? null;
});
/** Reads one signed track and all of its authored sets. */
export const readPublishedTrackSets = Effect.fn(
  "tryouts.catalog.readPublishedTrackSets"
)(function* (catalog: PublishedCatalog, identity: TrackIdentity) {
  const index = yield* indexPublishedCatalog(catalog);
  const track = index.tracks.find(
    (row) =>
      row.countryKey === identity.countryKey &&
      row.examKey === identity.examKey &&
      row.trackKey === identity.trackKey &&
      row.appLocale === identity.locale
  );
  if (!track) {
    return null;
  }
  yield* readPublishedTrackParents(index, track);
  const sets = sortCatalogRows(
    index.sets.filter(
      (set) =>
        set.countryKey === track.countryKey &&
        set.examKey === track.examKey &&
        set.trackKey === track.trackKey
    )
  );
  if (sets.length !== track.setCount) {
    return yield* catalogIntegrity(
      "Signed try-out track lost one or more sets."
    );
  }
  return { sets, track };
});
/** Resolves the set that owns one signed section. */
export function findPublishedSet(
  index: PublishedCatalogIndex,
  section: TryoutSection
) {
  return index.sets.find(
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
  return [...rows].sort((left, right) => left.order - right.order);
}
/** Creates one typed fail-closed published catalog error. */
function catalogIntegrity(message: string) {
  return releaseFail("CONTENT_RELEASE_INTEGRITY", message);
}
