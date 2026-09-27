import { readFirecrawlApp } from "@repo/backend/confect/nina/research/provider";
import { ResearchSearchError } from "@repo/backend/confect/nina/research/schema";
import { Effect } from "effect";

/** Calls Firecrawl search with one generated query. */
export const searchFirecrawl = Effect.fn("research.searchFirecrawl")(function* (
  query: string
) {
  yield* Effect.annotateCurrentSpan("query", query);
  const client = yield* readFirecrawlApp().pipe(
    Effect.mapError(
      (error) => new ResearchSearchError({ message: error.message })
    )
  );

  return yield* Effect.tryPromise({
    try: () =>
      client.search(query, {
        limit: 5,
        sources: ["web", "news"],
        scrapeOptions: {
          formats: ["markdown"],
          onlyMainContent: true,
          parsers: [],
        },
        timeout: 10_000,
      }),
    catch: () =>
      new ResearchSearchError({
        message: "Failed to search the web. Please try again.",
      }),
  }).pipe(Effect.map((response) => ({ query, response })));
});
