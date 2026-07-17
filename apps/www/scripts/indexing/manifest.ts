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
