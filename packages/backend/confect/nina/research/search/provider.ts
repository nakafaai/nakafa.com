import { purposes } from "@repo/backend/confect/gateway/purpose";
import { readFirecrawlApp } from "@repo/backend/confect/nina/research/provider";
import { ResearchSearchError } from "@repo/backend/confect/nina/research/schema";
import { Duration, Effect, Option, Schema } from "effect";

/**
 * One query settles within the step budget of the specialist purpose that
 * runs research: as sources or as an error, never as a card left loading.
 */
const SEARCH_DEADLINE = Duration.millis(purposes.specialist.timeout.stepMs);

const searchFailure = (status?: { readonly status: number }) =>
  new ResearchSearchError({
    message: "Failed to search the web. Please try again.",
    ...status,
  });

/** The provider's HTTP status. Its message may repeat the query and is never read. */
const ProviderFailure = Schema.Struct({ status: Schema.Finite });

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
