import { Effect, Schema } from "effect";
import {
  GoogleIndexPageFetchError,
  GoogleStructuredDataParseError,
} from "@/scripts/indexing/errors";
import { hasGoogleIndexingApiEligibleStructuredData } from "@/scripts/indexing/google/structured";
import type { SiteIndexManifest } from "@/scripts/indexing/manifest";
import { logger } from "@/scripts/utils";

const ELIGIBILITY_FETCH_CONCURRENCY = 8;
const JSON_LD_SCRIPT_PATTERN =
  /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/giu;
const decodeStructuredDataJson = Schema.decodeUnknown(
  Schema.parseJson(Schema.Unknown)
);

/** Builds the eligible Indexing API URL queue from sitemap and live JSON-LD. */
export const getEligibleGoogleIndexingUrls = Effect.fn(
  "scripts.google.eligibility.list"
)(function* (manifest: SiteIndexManifest) {
  logger.stats("Total URLs in sitemap", manifest.totalEntryCount);
  logger.stats("Canonical URLs in sitemap", manifest.urls.length);
  logger.stats("Duplicate sitemap URLs removed", manifest.duplicateCount);
  logger.info(
    "General Google discovery remains sitemap.xml, sitemap shards, robots.txt, canonical metadata, and Search Console."
  );
  logger.info(
    "Checking sitemap URLs for JobPosting or BroadcastEvent-in-VideoObject JSON-LD before using the Google Indexing API."
  );

  const maybeEligibleUrls = yield* Effect.forEach(
    manifest.urls,
    readEligibleGoogleIndexingUrl,
    { concurrency: ELIGIBILITY_FETCH_CONCURRENCY }
  );
  const urls = maybeEligibleUrls.filter(isString);

  logger.stats("Google Indexing API eligible URLs", urls.length);

  return urls;
});

/** Fetches one sitemap URL and returns it only when its JSON-LD is API-eligible. */
const readEligibleGoogleIndexingUrl = Effect.fn(
  "scripts.google.eligibility.readUrl"
)(function* (url: string) {
  const { html, ok, status } = yield* Effect.tryPromise({
    try: () =>
      fetch(url).then((response) =>
        response.text().then((html) => ({
          html,
          ok: response.ok,
          status: response.status,
        }))
      ),
    catch: (cause) =>
      new GoogleIndexPageFetchError({
        cause,
        message: `Failed to fetch ${url} for Google Indexing API eligibility.`,
        url,
      }),
  });

  if (!ok) {
    return yield* Effect.fail(
      new GoogleIndexPageFetchError({
        message: `Google Indexing API eligibility fetch returned HTTP ${status}.`,
        url,
      })
    );
  }

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

  return;
});

/** Extracts JSON-LD script bodies from a live HTML document. */
function readJsonLdScriptBodies(html: string) {
  const blocks: string[] = [];

  for (const match of html.matchAll(JSON_LD_SCRIPT_PATTERN)) {
    const body = match[1]?.trim();

    if (body) {
      blocks.push(body);
    }
  }

  return blocks;
}

/** Narrows optional URL results from the eligibility scan. */
function isString(value: string | undefined): value is string {
  return typeof value === "string";
}
