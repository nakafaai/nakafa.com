import { Schema } from "effect";

export const PagefindResultSchema = Schema.Struct({
  excerpt: Schema.String,
  meta: Schema.Struct({
    title: Schema.String,
  }),
  raw_url: Schema.String,
  sub_results: Schema.Array(
    Schema.Struct({
      anchor: Schema.optional(
        Schema.Struct({
          element: Schema.String,
          id: Schema.String,
          location: Schema.Number,
          text: Schema.String,
        })
      ),
      excerpt: Schema.String,
      title: Schema.String,
      url: Schema.String,
    })
  ),
  url: Schema.String,
}).pipe(Schema.mutable);
export type PagefindResult = Schema.Schema.Type<typeof PagefindResultSchema>;

/** Options that can be passed to pagefind.search() */
export const PagefindSearchOptionsSchema = Schema.Struct({
  /** If set, this call will load all assets but return before searching. Prefer using pagefind.preload() instead */
  preload: Schema.optional(Schema.Boolean),
  /** Add more verbose console logging for this search query */
  verbose: Schema.optional(Schema.Boolean),
  /** The set of filters to execute with this search. Input type is extremely flexible, see the filtering docs for details */
  filters: Schema.optional(
    Schema.Record({ key: Schema.String, value: Schema.Unknown })
  ),
  /** The set of sorts to use for this search, instead of relevancy */
  sort: Schema.optional(
    Schema.Record({ key: Schema.String, value: Schema.Unknown })
  ),
}).pipe(Schema.mutable);
export type PagefindSearchOptions = Schema.Schema.Type<
  typeof PagefindSearchOptionsSchema
>;
