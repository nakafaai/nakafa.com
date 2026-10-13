import {
  ResearchScrapeError,
  ResearchSearchError,
} from "@repo/backend/confect/nina/research/schema";
import { FetchClient } from "@repo/utilities/http/client";
import {
  Array as Arr,
  Config,
  Duration,
  Effect,
  Redacted,
  Schedule,
  Schema,
} from "effect";
import { HttpClient, HttpClientRequest, HttpClientResponse } from "effect/http";

/**
 * The provider's API address. It is fixed: the provider's SDK also read an
 * optional `FIRECRAWL_API_URL` from the environment, which this repository
 * never sets.
 */
const API_ORIGIN = "https://api.firecrawl.dev";

/** The status a gateway in front of the provider answers with when it fails. */
const BAD_GATEWAY = 502;
/** How many times a bad gateway is asked again, as the provider's SDK did. */
const BAD_GATEWAY_RETRIES = 2;
/** The wait before the first new ask. The second waits twice as long. */
const BAD_GATEWAY_DELAY = "500 millis";

/**
 * How long past the provider's own `timeout` an ask may take before it is cut.
 * The provider's SDK (4.46.0, `src/v2/methods/scrape.ts` and `search.ts`) cut
 * every request at its `timeout` plus the same five seconds.
 */
const ANSWER_MARGIN = Duration.seconds(5);

/**
 * The least `timeout` that the provider takes for a search, in milliseconds.
 * The reference states none, and the SDK refused a `timeout` that was not
 * positive.
 */
const SEARCH_MINIMUM_MS = 1;
/**
 * The least `timeout` that the provider takes for a page read, in milliseconds
 * (https://docs.firecrawl.dev/api-reference/endpoint/scrape, read on 13 October
 * 2026).
 */
const SCRAPE_MINIMUM_MS = 1000;

/** What a learner is told when the deployment has no provider key. */
const NOT_CONFIGURED = "Web research is not configured.";
/** What a learner is told when a search got no usable answer. */
const SEARCH_FAILED = "Failed to search the web. Please try again.";
/** What a learner is told when a page got no usable answer. */
const SCRAPE_FAILED = "The page could not be retrieved. Please try again.";

/**
 * A text of the provider's answer: one string, a list of strings when a page
 * repeats the tag, or null. The scrape reference documents the metadata title
 * and description as a string or an array of strings
 * (https://docs.firecrawl.dev/api-reference/endpoint/scrape, read on 13 October
 * 2026). The SDK's own search tests (4.46.0,
 * `src/__tests__/e2e/v2/search.test.ts`) accept a result title or description
 * that is null or missing, and one null must not fail a whole search.
 */
const TextSchema = Schema.NullOr(
  Schema.Union([Schema.String, Schema.Array(Schema.String)])
);

/** The page metadata Nina reads, from a search result or a scraped page. */
const MetadataSchema = Schema.Struct({
  dcDescription: Schema.optional(TextSchema),
  description: Schema.optional(TextSchema),
  favicon: Schema.optional(TextSchema),
  ogDescription: Schema.optional(TextSchema),
  ogTitle: Schema.optional(TextSchema),
  ogUrl: Schema.optional(TextSchema),
  sourceURL: Schema.optional(TextSchema),
  title: Schema.optional(TextSchema),
  url: Schema.optional(TextSchema),
});

/**
 * One result of a search. A web result has a `description` and a news result
 * has a `snippet`. `metadata` is there only when the provider read the page.
 */
const SearchResultSchema = Schema.Struct({
  description: Schema.optional(TextSchema),
  metadata: Schema.optional(Schema.NullOr(MetadataSchema)),
  snippet: Schema.optional(TextSchema),
  title: Schema.optional(TextSchema),
  url: Schema.optional(TextSchema),
});

/** The results of a search, grouped by the source they came from. */
const SearchDataSchema = Schema.Struct({
  news: Schema.optional(Schema.Array(SearchResultSchema)),
  web: Schema.optional(Schema.Array(SearchResultSchema)),
});

/** What a page read returns: the page as markdown and its metadata. */
const ScrapeDataSchema = Schema.Struct({
  markdown: Schema.optional(Schema.NullOr(Schema.String)),
  metadata: Schema.optional(Schema.NullOr(MetadataSchema)),
});

/** The answer of the search endpoint. The provider sets `success` to true. */
const SearchAnswerSchema = Schema.Struct({
  data: SearchDataSchema,
  success: Schema.Literal(true),
});

/** The answer of the scrape endpoint. The provider sets `success` to true. */
const ScrapeAnswerSchema = Schema.Struct({
  data: ScrapeDataSchema,
  success: Schema.Literal(true),
});

export type ProviderText = typeof TextSchema.Type;
export type PageMetadata = typeof MetadataSchema.Type;
export type SearchResult = typeof SearchResultSchema.Type;
export type SearchData = typeof SearchDataSchema.Type;

/** The deployment has no usable provider key. */
class ResearchProviderError extends Schema.TaggedError<ResearchProviderError>()(
  "ResearchProviderError",
  { message: Schema.String }
) {}

/**
 * A request that returned no usable answer. `status` is the HTTP status of the
 * answer, when there was one. It never keeps the provider's message, which may
 * repeat the query or the address of a page.
 */
class ProviderRequestError extends Schema.TaggedError<ProviderRequestError>()(
  "ProviderRequestError",
  { status: Schema.optional(Schema.Finite) }
) {}

/**
 * Resolves the provider key inside the action that uses it. The key is
 * trimmed, because the provider's SDK trimmed it before use.
 */
const readKey = Effect.fn("research.readKey")(function* () {
  const key = yield* Config.Redacted("FIRECRAWL_API_KEY").pipe(
    Effect.mapError(
      () => new ResearchProviderError({ message: NOT_CONFIGURED })
    )
  );
  const token = Redacted.value(key).trim();
  if (!token) {
    return yield* new ResearchProviderError({ message: NOT_CONFIGURED });
  }
  return Redacted.make(token);
});

/**
 * Sends one JSON request and decodes the answer. The scope aborts the request
 * once its answer is read or refused, so a refused answer never lingers unread.
 */
const postOnce = Effect.fn("research.postOnce")(function* <A, I>(request: {
  readonly body: Schema.Json;
  readonly key: Redacted.Redacted;
  readonly path: string;
  readonly schema: Schema.ConstraintCodec<A, I>;
}) {
  const client = (yield* HttpClient.HttpClient).pipe(HttpClient.withScope);
  const response = yield* client
    .execute(
      HttpClientRequest.post(`${API_ORIGIN}${request.path}`).pipe(
        HttpClientRequest.bearerToken(request.key),
        HttpClientRequest.acceptJson,
        HttpClientRequest.bodyJsonUnsafe(request.body)
      )
    )
    .pipe(Effect.mapError(() => new ProviderRequestError({})));
  if (response.status < 200 || response.status >= 300) {
    return yield* new ProviderRequestError({ status: response.status });
  }
  return yield* HttpClientResponse.schemaBodyJson(request.schema)(
    response
  ).pipe(
    Effect.mapError(() => new ProviderRequestError({ status: response.status }))
  );
}, Effect.scoped);

/**
 * Sends a request and asks again when a bad gateway answers. The provider's
 * SDK did the same for every endpoint, twice, after 0.5 and 1 second. Any
 * other failure ends the request at once.
 *
 * `timeoutMs` is the provider's own limit, which the request sends as its
 * `timeout`. Each ask is cut `ANSWER_MARGIN` after that limit, as the SDK did,
 * so a provider that stays silent does not hold the caller until its deadline.
 * The cut has no status, so it is not asked again.
 */
const post = Effect.fn("research.post")(function* <A, I>(request: {
  readonly body: Schema.JsonObject;
  readonly key: Redacted.Redacted;
  readonly path: string;
  readonly schema: Schema.ConstraintCodec<A, I>;
  readonly timeoutMs: number;
}) {
  return yield* postOnce({
    ...request,
    body: { ...request.body, timeout: request.timeoutMs },
  }).pipe(
    Effect.timeoutOrElse({
      duration: Duration.sum(Duration.millis(request.timeoutMs), ANSWER_MARGIN),
      orElse: () => Effect.fail(new ProviderRequestError({})),
    }),
    Effect.retry({
      schedule: Schedule.exponential(BAD_GATEWAY_DELAY),
      times: BAD_GATEWAY_RETRIES,
      while: (failure) => failure.status === BAD_GATEWAY,
    })
  );
}, Effect.provide(FetchClient));

/** The failure of a search, with the status of the provider's answer if any. */
const searchFailure = (status?: number) =>
  new ResearchSearchError({ message: SEARCH_FAILED, status });

/** The failure of a page read. */
const scrapeFailure = () => new ResearchScrapeError({ message: SCRAPE_FAILED });

/**
 * Searches the web and the news with one query, and returns the results of
 * both sources. `limit` counts the results of each source, and `timeoutMs` is
 * the provider's own limit for the search, in milliseconds. The request names
 * no page reading, so the provider reads no page inside the search. With
 * `sites` it restricts the results to those hostnames through the provider's
 * `includeDomains` field. With no site the field is left out, because the
 * reference does not say what an empty list means.
 *
 * `deadline` is the backstop for the whole request, bad gateway retries
 * included, and each ask is also cut shortly after `timeoutMs`. A failure
 * carries the HTTP status of the provider's answer, which the caller reads to
 * tell a refusal by the rate limit from other failures. It never carries the
 * provider's message, which may repeat the query. A `timeoutMs` below
 * `SEARCH_MINIMUM_MS` sends nothing and fails at once, as the SDK did for a
 * `timeout` that was not positive: the provider does not take it, and a caller
 * with no time left cancels the request as it starts.
 */
export const requestSearch = Effect.fn("research.requestSearch")(
  function* (search: {
    readonly deadline: Duration.Duration;
    readonly limit: number;
    readonly query: string;
    readonly sites: readonly string[];
    readonly timeoutMs: number;
  }) {
    const key = yield* readKey().pipe(
      Effect.mapError(
        (error) => new ResearchSearchError({ message: error.message })
      )
    );
    if (search.timeoutMs < SEARCH_MINIMUM_MS) {
      return yield* searchFailure();
    }
    const answer = yield* post({
      body: {
        query: search.query,
        sources: ["web", "news"],
        ...(Arr.isReadonlyArrayNonEmpty(search.sites)
          ? { includeDomains: search.sites }
          : {}),
        limit: search.limit,
      },
      key,
      path: "/v2/search",
      schema: SearchAnswerSchema,
      timeoutMs: search.timeoutMs,
    }).pipe(
      Effect.mapError((failure) => searchFailure(failure.status)),
      Effect.timeoutOrElse({
        duration: search.deadline,
        orElse: () => Effect.fail(searchFailure()),
      })
    );
    return answer.data;
  }
);

/**
 * Reads one page as markdown. `timeoutMs` is the provider's own limit for the
 * read, in milliseconds. When the page takes longer, the provider answers with
 * a refusal and this function does not ask again: the SDK would have waited
 * for a document that the provider keeps processing, unless told not to.
 * `deadline` is the backstop for the whole read, bad gateway retries included,
 * and each ask is also cut shortly after `timeoutMs`. A `timeoutMs` below
 * `SCRAPE_MINIMUM_MS` sends nothing and fails at once, as a search does.
 */
export const requestScrape = Effect.fn("research.requestScrape")(
  function* (page: {
    readonly deadline: Duration.Duration;
    readonly timeoutMs: number;
    readonly url: string;
  }) {
    const key = yield* readKey().pipe(
      Effect.mapError(
        (error) => new ResearchScrapeError({ message: error.message })
      )
    );
    if (page.timeoutMs < SCRAPE_MINIMUM_MS) {
      return yield* scrapeFailure();
    }
    const answer = yield* post({
      body: { url: page.url, formats: ["markdown"] },
      key,
      path: "/v2/scrape",
      schema: ScrapeAnswerSchema,
      timeoutMs: page.timeoutMs,
    }).pipe(
      Effect.mapError(scrapeFailure),
      Effect.timeoutOrElse({
        duration: page.deadline,
        orElse: () => Effect.fail(scrapeFailure()),
      })
    );
    return answer.data;
  }
);
