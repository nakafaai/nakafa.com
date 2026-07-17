import { Effect } from "effect";
import { getSitemapEntries } from "@/lib/sitemap/entries";
import { readSitemapPageDescriptors } from "@/lib/sitemap/routes";

const DEFAULT_SITE_INDEX_BATCH_SIZE = 500;

/** Summary returned after processing canonical sitemap URLs in bounded batches. */
export interface SiteIndexManifestSummary {
  batchCount: number;
  canonicalUrlCount: number;
}

/** One bounded set of canonical sitemap URLs for indexing adapters. */
export interface SiteIndexUrlBatch {
  batchIndex: number;
  urls: readonly string[];
}

/**
 * Processes canonical sitemap URLs from sitemap pages without exposing one list.
 *
 * Adapters receive bounded URL batches, while the manifest retains counters
 * only and never materializes every Nakafa public URL in memory.
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
    let batchIndex = 0;
    let canonicalUrlCount = 0;
    let currentBatch: string[] = [];

    for (const descriptor of descriptors) {
      const entries = yield* getSitemapEntries({ pageId: descriptor.id });

      for (const entry of entries) {
        canonicalUrlCount++;
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
      canonicalUrlCount,
    };
  });
}
