import { Schema } from "effect";

/**
 * What a search result is. It decides the result's group, its icon and how far
 * it leads when two results score alike: a curriculum before a lesson in it. A
 * `hub` is the first page of a family, such as the Quran or the try-outs.
 */
export const SearchKind = Schema.Literals([
  "curriculum",
  "level",
  "subject",
  "lesson",
  "country",
  "exam",
  "tryout",
  "surah",
  "category",
  "article",
  "hub",
  "page",
]);
export type SearchKind = typeof SearchKind.Type;

/**
 * One page that the palette can open. `trail` names the pages above it, without
 * the home page and the family's own root, so a lesson reads "Kurikulum Merdeka,
 * Class 10, Chemistry". `terms` are other names the page answers to, such as the
 * curricula a lesson also teaches in or a surah's number. `flag` is the country
 * of a curriculum or a try-out country, which the row draws as its flag.
 */
export const SearchEntry = Schema.Struct({
  flag: Schema.optionalKey(Schema.String),
  kind: SearchKind,
  path: Schema.String,
  terms: Schema.optionalKey(Schema.Array(Schema.String)),
  title: Schema.String,
  trail: Schema.Array(Schema.String),
});
export type SearchEntry = typeof SearchEntry.Type;

/** Every page of one locale that the palette searches, in the build's order. */
export const SearchIndex = Schema.Struct({
  entries: Schema.Array(SearchEntry),
});
export type SearchIndex = typeof SearchIndex.Type;

/** The index as the static file that the build writes and the palette reads. */
export const SearchIndexJson = Schema.fromJsonString(SearchIndex);

/** The address of a locale's index among the client assets, which no page shares. */
export function searchIndexPath(locale: string) {
  return `/search/${locale}.json`;
}
