/**
 * Google Indexing API CLI boundary.
 *
 * General Google discovery for Nakafa is owned by sitemap.xml, sitemap shards,
 * robots.txt, canonical metadata, Search Console, and crawlable stable URLs.
 * This command only notifies URLs whose live JSON-LD proves JobPosting or
 * BroadcastEvent-in-VideoObject eligibility under Google's Indexing API policy.
 *
 * References:
 * - https://developers.google.com/search/apis/indexing-api/v3/using-api
 * - https://developers.google.com/search/apis/indexing-api/v3/quickstart
 * - https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap
 */

// Environment variables loaded via Node.js --env-file flag.
import { Effect } from "effect";
import { runGoogleIndexing } from "@/scripts/indexing/google/run";
import { logger } from "@/scripts/utils";

Effect.runPromise(
  runGoogleIndexing().pipe(
    Effect.catchAll((error) =>
      Effect.sync(() => {
        logger.error(`Error running Google indexing script: ${error}`);
        process.exit(1);
      })
    )
  )
);
