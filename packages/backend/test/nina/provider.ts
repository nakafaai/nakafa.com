import type { Mock } from "@effect/vitest";
import { JsonTextSchema } from "@repo/utilities/json";
import { Array as Arr, ConfigProvider, Effect, Schema } from "effect";
import { FetchHttpClient } from "effect/http";

/** The address of the provider's search endpoint, as the fetch double sees it. */
export const providerSearchUrl = new URL("https://api.firecrawl.dev/v2/search");

/** The address of the provider's scrape endpoint, as the fetch double sees it. */
export const providerScrapeUrl = new URL("https://api.firecrawl.dev/v2/scrape");

/** The provider key that tests configure. */
export const providerKey = "fc-test-key";

/** The answer of the search endpoint when it finds these results. */
export function searchAnswer(data: object) {
  return Response.json({ success: true, data });
}

/** The answer of the scrape endpoint when it reads this page. */
export function scrapeAnswer(data: object) {
  return Response.json({ success: true, data });
}

/**
 * The answer of either endpoint when it refuses a request: a status and an
 * `error` message, which may repeat the query or the address of the page.
 */
export function refusal(status: number, error: string) {
  return Response.json({ error }, { status });
}

/**
 * Runs an effect that calls the provider over a fetch double, with this key
 * configured (or none, when `key` is undefined), so a test never reaches the
 * network or reads the environment.
 */
export function overKey(fetcher: Mock<typeof fetch>, key: string | undefined) {
  return <A, E, R>(effect: Effect.Effect<A, E, R>) =>
    effect.pipe(
      Effect.provideService(
        ConfigProvider.ConfigProvider,
        ConfigProvider.fromUnknown({ FIRECRAWL_API_KEY: key })
      ),
      Effect.provideService(FetchHttpClient.Fetch, fetcher)
    );
}

/** Runs an effect that calls the provider over a fetch double, with the key set. */
export function overProvider(fetcher: Mock<typeof fetch>) {
  return overKey(fetcher, providerKey);
}

/** Starts an effect at once, so a test can move the fake clock under it. */
export function inBackground<A, E, R>(effect: Effect.Effect<A, E, R>) {
  return Effect.forkChild(effect, { startImmediately: true });
}

/** Reads a request body that was sent as JSON text. */
function readBody(init: RequestInit | undefined) {
  return Effect.promise(() => new Response(init?.body).text()).pipe(
    Effect.flatMap(Schema.decodeUnknownEffect(JsonTextSchema))
  );
}

/**
 * Reads the JSON body of every request the fetch double was given, in order.
 * Only the provider's requests have a body: a page fetched for its own
 * markdown is a GET.
 */
export function sentBodies(fetcher: Mock<typeof fetch>) {
  return Effect.forEach(
    Arr.filter(fetcher.mock.calls, ([, init]) => init?.body !== undefined),
    ([, init]) => readBody(init)
  );
}

/**
 * Makes the fetch double answer each search by its query, which it reads from
 * the request. The answer is a response, or a promise that fails.
 */
export function answerSearches(
  fetcher: Mock<typeof fetch>,
  answer: (query: string) => Response | Promise<Response>
) {
  const QueryBody = Schema.Struct({ query: Schema.String });
  fetcher.mockImplementation((_url, init) =>
    Effect.runPromise(
      readBody(init).pipe(
        Effect.flatMap(Schema.decodeUnknownEffect(QueryBody)),
        Effect.map(({ query }) => query)
      )
    ).then(answer)
  );
}
