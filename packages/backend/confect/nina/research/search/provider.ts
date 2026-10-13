import { timeLeft } from "@repo/backend/confect/nina/capability/deadline";
import { requestSearch } from "@repo/backend/confect/nina/research/provider";
import { Duration, Effect, Schedule } from "effect";

/** How long the search provider may take to answer, in milliseconds. */
const SEARCH_TIMEOUT_MS = 10_000;

/**
 * A search returns results without reading their pages, so it answers in about
 * two seconds. The provider gets ten seconds; this deadline is the backstop for
 * a request that never answers, so a card is never left loading.
 */
const SEARCH_DEADLINE = Duration.seconds(12);

/** How many results of each source a search asks for. */
const SEARCH_LIMIT = 5;

/** The status the provider answers with when the plan's rate limit refuses a request. */
const RATE_LIMITED = 429;
/** How long a refused search waits before it asks once more. */
const RETRY_DELAY = Duration.seconds(1);

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
 * another site in four of four. With no site the field is left out
 * (`research/provider.ts`).
 *
 * The span carries neither the query nor the sites, because both are derived
 * from the learner's words (docs/adr/0019-gateway.md, "Search provider").
 */
export const searchFirecrawl = Effect.fn("research.searchFirecrawl")(function* (
  query: string,
  sites: readonly string[] = []
) {
  const attempt = Effect.gen(function* () {
    const left = yield* timeLeft;
    return yield* requestSearch({
      deadline: Duration.min(SEARCH_DEADLINE, left),
      limit: SEARCH_LIMIT,
      query,
      sites,
      timeoutMs: Math.min(SEARCH_TIMEOUT_MS, Duration.toMillis(left)),
    });
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
