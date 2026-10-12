import { timeLeft } from "@repo/backend/confect/nina/capability/deadline";
import { readFirecrawlApp } from "@repo/backend/confect/nina/research/provider";
import { ResearchSearchError } from "@repo/backend/confect/nina/research/schema";
import {
  Array as Arr,
  Duration,
  Effect,
  Option,
  Schedule,
  Schema,
} from "effect";

/** How long the search provider may take to answer, in milliseconds. */
const SEARCH_TIMEOUT_MS = 10_000;

/**
 * A search returns results without reading their pages, so it answers in about
 * two seconds. The provider gets ten seconds; this deadline is the backstop for
 * a request that never answers, so a card is never left loading.
 */
const SEARCH_DEADLINE = Duration.seconds(12);

/** The status the provider answers with when the plan's rate limit refuses a request. */
const RATE_LIMITED = 429;
/** How long a refused search waits before it asks once more. */
const RETRY_DELAY = Duration.seconds(1);

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
 * Each attempt is cut to the time the running capability has left.
 *
 * Named sites restrict the search through the provider's own `includeDomains`
 * field, not through a `site:` operator in the query: when measured on 12
 * October 2026, the news source answered the operator with five results of
 * other sites in one of four cases, and the field returned no result of
 * another site in four of four. With no site the field is left out, because
 * the SDK sends an empty list as it is: it tests the field for truth, and an
 * empty array is true.
 */
export const searchFirecrawl = Effect.fn("research.searchFirecrawl")(function* (
  query: string,
  sites: readonly string[] = []
) {
  yield* Effect.annotateCurrentSpan("query", query);
  yield* Effect.annotateCurrentSpan("sites", sites);
  const client = yield* readFirecrawlApp().pipe(
    Effect.mapError(
      (error) => new ResearchSearchError({ message: error.message })
    )
  );
  const restriction = Arr.isReadonlyArrayNonEmpty(sites)
    ? { includeDomains: [...sites] }
    : {};

  const attempt = Effect.gen(function* () {
    const left = yield* timeLeft;
    return yield* Effect.tryPromise({
      try: () =>
        client.search(query, {
          limit: 5,
          sources: ["web", "news"],
          timeout: Math.min(SEARCH_TIMEOUT_MS, Duration.toMillis(left)),
          ...restriction,
        }),
      catch: (cause) =>
        searchFailure(
          Option.getOrUndefined(
            Schema.decodeUnknownOption(ProviderFailure)(cause)
          )
        ),
    }).pipe(
      Effect.timeoutOrElse({
        duration: Duration.min(SEARCH_DEADLINE, left),
        orElse: () => Effect.fail(searchFailure()),
      })
    );
  });

  return yield* attempt.pipe(
    // Every learner shares the plan's rate limit, so a refused search waits a
    // moment and asks once more before it counts as failed.
    Effect.retry({
      schedule: Schedule.spaced(RETRY_DELAY),
      times: 1,
      while: (error) => error.status === RATE_LIMITED,
    }),
    Effect.map((response) => ({ query, response }))
  );
});
