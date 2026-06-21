import { Effect } from "effect";
import { getSitemapEntries } from "@/lib/sitemap/entries";

/** Canonical sitemap-derived URL inventory used by indexing notification scripts. */
export interface SiteIndexManifest {
  duplicateCount: number;
  totalEntryCount: number;
  urls: readonly string[];
}

/**
 * Builds the canonical URL manifest from Nakafa sitemap entries.
 *
 * This is the source of discoverability proof for indexing scripts: every
 * general public page remains discoverable through sitemap/canonical/Search
 * Console paths even when it is not eligible for Google's narrower Indexing API.
 */
export const getSiteIndexManifest = Effect.fn("scripts.indexing.manifest")(
  function* () {
    const entries = yield* getSitemapEntries();
    return buildSiteIndexManifest(entries.map((entry) => entry.url));
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
    duplicateCount: urls.length - uniqueUrls.length,
    totalEntryCount: urls.length,
    urls: uniqueUrls,
  } satisfies SiteIndexManifest;
}
