import { Array as Arr, Option, Order, Schema, String as Str } from "effect";
import type { SearchEntry, SearchKind } from "@/lib/search/entry";
import { SearchHit } from "@/lib/search/rank";

/** The groups the palette lists its results in, one per family of Nakafa. */
export const SearchGroup = Schema.Literals([
  "curricula",
  "lessons",
  "tryouts",
  "quran",
  "articles",
  "pages",
]);
export type SearchGroup = typeof SearchGroup.Type;

/** The group of each kind. */
const GROUP_OF_KIND: Readonly<Record<SearchKind, SearchGroup>> = {
  article: "articles",
  category: "articles",
  country: "tryouts",
  curriculum: "curricula",
  exam: "tryouts",
  hub: "pages",
  lesson: "lessons",
  level: "curricula",
  page: "pages",
  subject: "curricula",
  surah: "quran",
  tryout: "tryouts",
};

/** The group a kind is listed in. */
export function groupOfKind(kind: SearchKind) {
  return GROUP_OF_KIND[kind];
}

/** How many results one group shows, so one family never buries the others. */
const GROUP_LIMIT = 6;

/** How many results the palette shows at most, across its groups. */
const RESULT_LIMIT = 24;

/** One group of results, in the order the palette lists them. */
const HitGroup = Schema.Struct({
  group: SearchGroup,
  hits: Schema.Array(SearchHit),
});
type HitGroup = typeof HitGroup.Type;

/**
 * Groups ranked results by family. A group comes in the place of its best
 * result, so the best answer always leads, and each group keeps its own best few.
 */
export function groupHits(
  hits: readonly (typeof SearchHit.Type)[]
): readonly HitGroup[] {
  const shown = Arr.take(hits, RESULT_LIMIT);
  const groups = Arr.dedupe(
    Arr.map(shown, ({ entry }) => groupOfKind(entry.kind))
  );
  return Arr.map(groups, (group) => ({
    group,
    hits: Arr.take(
      Arr.filter(shown, ({ entry }) => groupOfKind(entry.kind) === group),
      GROUP_LIMIT
    ),
  }));
}

/** Whether a path is the page itself or a page under it. */
function isUnder(path: string, parent: string) {
  return path === parent || Str.startsWith(`${parent}/`)(path);
}

/** The entry of the page at a path, or of the nearest page above it that the index holds. */
function findPlace(entries: readonly SearchEntry[], here: string) {
  return Arr.last(
    Arr.sort(
      Arr.filter(entries, ({ path }) => isUnder(here, path)),
      Order.mapInput(Order.Number, ({ path }: SearchEntry) => path.length)
    )
  );
}

/**
 * The level that a page sits in: the level itself, or the level its trail names
 * under the same curriculum, since a lesson's address is not under its level's.
 */
function findLevel(entries: readonly SearchEntry[], place: SearchEntry) {
  if (place.kind === "level") {
    return Option.some(place);
  }
  const [curriculum, level] = place.trail;
  return Arr.findFirst(
    entries,
    (entry) =>
      entry.kind === "level" &&
      entry.title === level &&
      entry.trail[0] === curriculum
  );
}

/** How many places near the reader the palette suggests before a query. */
const NEAR_LIMIT = 6;

/**
 * What the palette suggests from where the reader is, before a query: the
 * subjects of the level a page belongs to, or the levels of a curriculum. A
 * page outside every curriculum suggests nothing, and `places` lists the paths
 * to try in order, the page on screen first and then the reader's recent pages.
 */
export function readNearEntries(
  entries: readonly SearchEntry[],
  places: readonly string[]
): readonly SearchEntry[] {
  const near = Arr.findFirst(places, (here) =>
    Option.flatMap(findPlace(entries, here), (place) =>
      Option.orElse(
        Option.map(findLevel(entries, place), (level) =>
          listUnder(entries, level.path, "subject")
        ),
        () =>
          place.kind === "curriculum"
            ? Option.some(listUnder(entries, place.path, "level"))
            : Option.none()
      ).pipe(Option.filter(Arr.isReadonlyArrayNonEmpty))
    )
  );
  return Option.getOrElse(near, () => []);
}

/** The entries of one kind under a path, in the index's order. */
function listUnder(
  entries: readonly SearchEntry[],
  parent: string,
  kind: SearchKind
) {
  return Arr.take(
    Arr.filter(
      entries,
      (entry) => entry.kind === kind && isUnder(entry.path, parent)
    ),
    NEAR_LIMIT
  );
}

/** What the palette offers every reader before a query: each family's own page, then every curriculum. */
export function readExploreEntries(
  entries: readonly SearchEntry[]
): readonly SearchEntry[] {
  return Arr.appendAll(
    Arr.filter(entries, ({ kind }) => kind === "hub"),
    Arr.filter(entries, ({ kind }) => kind === "curriculum")
  );
}
