import { readFirecrawlApp } from "@repo/backend/confect/nina/research/provider";
import { ResearchSearchError } from "@repo/backend/confect/nina/research/schema";
import { Duration, Effect, Option, Schema } from "effect";

/**
 * A search returns results without reading their pages, so it answers in about
 * two seconds. The provider gets ten seconds; this deadline is the backstop for
 * a request that never answers, so a card is never left loading.
 */
const SEARCH_DEADLINE = Duration.seconds(12);

const searchFailure = (status?: { readonly status: number }) =>
  new ResearchSearchError({
    message: "Failed to search the web. Please try again.",
    ...status,
  });

/** The provider's HTTP status. Its message may repeat the query and is never read. */
const ProviderFailure = Schema.Struct({ status: Schema.Finite });

/**
 * Calls Firecrawl search with one generated query. It asks for results only:
 * reading every result page inside the search took 76 seconds when measured on
 * 10 October 2026, so `searchWeb` reads the best pages itself, in parallel.
 */
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
        timeout: 10_000,
      }),
    catch: (cause) =>
      searchFailure(
        Option.getOrUndefined(
          Schema.decodeUnknownOption(ProviderFailure)(cause)
        )
      ),
  }).pipe(
    Effect.timeoutOrElse({
      duration: SEARCH_DEADLINE,
      orElse: () => Effect.fail(searchFailure()),
    }),
    Effect.map((response) => ({ query, response }))
  );
});
