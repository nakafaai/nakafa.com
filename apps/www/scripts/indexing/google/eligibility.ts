import { NETWORK_ATTEMPT_DEADLINE } from "@repo/backend/client/network";
import { JsonTextSchema } from "@repo/utilities/json";
import { Array as Arr, Effect, Predicate, Result, Schema } from "effect";
import { HttpClient } from "effect/http";
import {
  GoogleIndexPageFetchError,
  GoogleStructuredDataParseError,
} from "@/scripts/indexing/errors";
import { hasGoogleIndexingApiEligibleStructuredData } from "@/scripts/indexing/google/structured";
import type { SiteIndexUrlBatch } from "@/scripts/indexing/manifest";

const ELIGIBILITY_FETCH_CONCURRENCY = 8;
const JSON_LD_SCRIPT_PATTERN =
  /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/giu;
const decodeStructuredDataJson = Schema.decodeUnknownEffect(JsonTextSchema);
/** Builds the eligible Indexing API URL queue from sitemap and live JSON-LD. */
export const getEligibleGoogleIndexingUrls = Effect.fn(
  "scripts.google.eligibility.list"
)(function* (batch: SiteIndexUrlBatch) {
  yield* Effect.logInfo(
    `Canonical URLs in sitemap batch ${batch.batchIndex}: ${batch.urls.length}`
  );
  yield* Effect.logInfo(
    "General Google discovery remains sitemap.xml, sitemap shards, robots.txt, canonical metadata, and Search Console."
  );
  yield* Effect.logInfo(
    "Checking sitemap URLs for JobPosting or BroadcastEvent-in-VideoObject JSON-LD before using the Google Indexing API."
  );
  const maybeEligibleUrls = yield* Effect.forEach(
    batch.urls,
    readEligibleGoogleIndexingUrl,
    { concurrency: ELIGIBILITY_FETCH_CONCURRENCY }
  );
  const urls = Arr.filter(maybeEligibleUrls, Predicate.isString);
  yield* Effect.logInfo(
    `Google Indexing API eligible URLs in batch ${batch.batchIndex}: ${urls.length}`
  );
  return urls;
});
/** Fetches one sitemap URL and returns it only when its JSON-LD is API-eligible. */
const readEligibleGoogleIndexingUrl = Effect.fn(
  "scripts.google.eligibility.readUrl"
)(function* (url: string) {
  const html = yield* fetchEligibilityPage(url).pipe(
    Effect.timeoutOrElse({
      duration: NETWORK_ATTEMPT_DEADLINE,
      orElse: () =>
        Effect.fail(
          new GoogleIndexPageFetchError({
            cause: "deadline",
            message: `Fetching ${url} for Google Indexing API eligibility did not finish within 10 seconds.`,
            url,
          })
        ),
    })
  );
  const blocks = readJsonLdScriptBodies(html);
  for (const block of blocks) {
    const data = yield* decodeStructuredDataJson(block).pipe(
      Effect.mapError(
        (cause) =>
          new GoogleStructuredDataParseError({
            cause,
            message: `Failed to parse JSON-LD while checking ${url}.`,
            url,
          })
      )
    );
    if (hasGoogleIndexingApiEligibleStructuredData(data)) {
      return url;
    }
  }
});
/** Sends one sitemap URL request and reads its body once the status succeeds. */
const fetchEligibilityPage = Effect.fn("scripts.google.eligibility.fetchPage")(
  function* (url: string) {
    const client = yield* HttpClient.HttpClient;
    const response = yield* client.get(url).pipe(
      Effect.mapError(
        (cause) =>
          new GoogleIndexPageFetchError({
            cause,
            message: `Failed to fetch ${url} for Google Indexing API eligibility.`,
            url,
          })
      )
    );
    if (response.status < 200 || response.status >= 300) {
      return yield* new GoogleIndexPageFetchError({
        message: `Google Indexing API eligibility fetch returned HTTP ${response.status}.`,
        url,
      });
    }
    return yield* response.text.pipe(
      Effect.mapError(
        (cause) =>
          new GoogleIndexPageFetchError({
            cause,
            message: `Failed to read ${url} for Google Indexing API eligibility.`,
            url,
          })
      )
    );
  }
);
/** Extracts JSON-LD script bodies from a live HTML document. */
function readJsonLdScriptBodies(html: string) {
  return Arr.filterMap(html.matchAll(JSON_LD_SCRIPT_PATTERN), (match) => {
    const body = match[1]?.trim();
    return body ? Result.succeed(body) : Result.failVoid;
  });
}
