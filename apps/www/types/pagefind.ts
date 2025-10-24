import * as z from "zod";

export const PagefindResultSchema = z.object({
  excerpt: z.string(),
  meta: z.object({
    title: z.string(),
  }),
  raw_url: z.string(),
  sub_results: z.array(
    z.object({
      anchor: z
        .object({
          element: z.string(),
          id: z.string(),
          location: z.number(),
          text: z.string(),
        })
        .optional(),
      excerpt: z.string(),
      title: z.string(),
      url: z.string(),
    }),
  ),
  url: z.string(),
});
export type PagefindResult = z.infer<typeof PagefindResultSchema>;

/** Options that can be passed to pagefind.search() */
export const PagefindSearchOptionsSchema = z.object({
  /** If set, this call will load all assets but return before searching. Prefer using pagefind.preload() instead */
  preload: z.boolean().optional(),
  /** Add more verbose console logging for this search query */
  verbose: z.boolean().optional(),
  /** The set of filters to execute with this search. Input type is extremely flexible, see the filtering docs for details */
  filters: z.record(z.string(), z.unknown()).optional(),
  /** The set of sorts to use for this search, instead of relevancy */
  sort: z.record(z.string(), z.unknown()).optional(),
});
export type PagefindSearchOptions = z.infer<typeof PagefindSearchOptionsSchema>;
