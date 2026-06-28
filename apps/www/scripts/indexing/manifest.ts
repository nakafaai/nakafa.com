import { Effect } from "effect";
import { getSitemapEntries } from "@/lib/sitemap/entries";
import { readSitemapPageDescriptors } from "@/lib/sitemap/routes";

const DEFAULT_SITE_INDEX_BATCH_SIZE = 500;

/** Summary returned after processing canonical sitemap URLs in bounded batches. */
export interface SiteIndexManifestSummary {
  batchCount: number;
  canonicalUrlCount: number;
  duplicateCount: number;
  totalEntryCount: number;
}

/** One bounded set of canonical sitemap URLs for indexing adapters. */
export interface SiteIndexUrlBatch {
  batchIndex: number;
  urls: readonly string[];
}

/** Canonical sitemap-derived URL inventory used by indexing notification scripts. */
export interface SiteIndexManifest extends SiteIndexManifestSummary {
  urls: readonly string[];
}

/**
 * Processes canonical sitemap URLs from sitemap pages without exposing one list.
 *
 * The processor owns global de-duplication and summary counts. Adapters receive
 * bounded URL batches so IndexNow/Google flows do not depend on materializing
 * every Nakafa public URL as one array.
 */
export function forEachSiteIndexUrlBatch<Success, Failure, Requirements>(
  process: (
    batch: SiteIndexUrlBatch
  ) => Effect.Effect<Success, Failure, Requirements>,
  options: { batchSize?: number } = {}
) {
  return Effect.gen(function* () {
    const batchSize = options.batchSize ?? DEFAULT_SITE_INDEX_BATCH_SIZE;
    const descriptors = yield* readSitemapPageDescriptors();
    const seenUrls = new Set<string>();
    let batchIndex = 0;
    let currentBatch: string[] = [];
    let duplicateCount = 0;
    let totalEntryCount = 0;

    for (const descriptor of descriptors) {
      const entries = yield* getSitemapEntries({ pageId: descriptor.id });

      for (const entry of entries) {
        totalEntryCount++;

        if (seenUrls.has(entry.url)) {
          duplicateCount++;
          continue;
        }

        seenUrls.add(entry.url);
        currentBatch.push(entry.url);

        if (currentBatch.length >= batchSize) {
          batchIndex++;
          yield* process({ batchIndex, urls: currentBatch });
          currentBatch = [];
        }
      }
    }

    if (currentBatch.length > 0) {
      batchIndex++;
      yield* process({ batchIndex, urls: currentBatch });
    }

    return {
      batchCount: batchIndex,
      canonicalUrlCount: seenUrls.size,
      duplicateCount,
      totalEntryCount,
    } satisfies SiteIndexManifestSummary;
  });
}

/**
 * Builds a full manifest for audits that need one deterministic URL list.
 *
 * Indexing adapters should prefer `forEachSiteIndexUrlBatch`; this helper is
 * intentionally retained for tests and PR proof commands that report complete
 * sitemap coverage.
 */
export const getSiteIndexManifest = Effect.fn("scripts.indexing.manifest")(
  function* () {
    const urls: string[] = [];
    const summary = yield* forEachSiteIndexUrlBatch((batch) =>
      Effect.sync(() => {
        urls.push(...batch.urls);
      })
    );

    return {
      ...summary,
      urls: [...urls].sort(),
    } satisfies SiteIndexManifest;
  }
);

/**
 * Deduplicates and sorts sitemap URLs so adapters share one stable manifest.
 *
 * Keeping this deterministic makes script history predictable and lets PR proof
 * report exactly how many canonical URLs are in the public indexing path.
 */
export function buildSiteIndexManifest(urls: readonly string[]) {
  const uniqueUrls = [...new Set(urls)].sort();

  return {
    batchCount: uniqueUrls.length > 0 ? 1 : 0,
    canonicalUrlCount: uniqueUrls.length,
    duplicateCount: urls.length - uniqueUrls.length,
    totalEntryCount: urls.length,
    urls: uniqueUrls,
  } satisfies SiteIndexManifest;
}
