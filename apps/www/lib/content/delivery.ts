import {
  type ContentCacheScope,
  makeArtifactCacheTag,
  makeContentCacheTag,
} from "@nakafa/aksara-contracts/cache/content";

/**
 * Cache-Control of a public content document. The CDN keeps the document for an
 * hour and serves the stale copy for a day while it revalidates, so a release
 * reaches visitors through the tags of the document, not through a timer.
 */
export const PUBLIC_CONTENT_CACHE_CONTROL =
  "public, max-age=0, s-maxage=3600, stale-while-revalidate=86400";

/** The response headers of one public content document and its CDN tags. */
export function publicContentHeaders(tags: readonly string[]) {
  return {
    "Cache-Control": PUBLIC_CONTENT_CACHE_CONTROL,
    "Vercel-Cache-Tag": tags.join(","),
  };
}

/**
 * The CDN tags of one document: the mutable scope tags it reads, and the
 * immutable artifact tags of the snapshots it was read from. A release purges
 * by scope, and an artifact tag names one signed snapshot for good.
 */
export function readContentCacheTags(
  scopes: readonly ContentCacheScope[],
  artifactHashes: readonly string[] = []
) {
  return [
    ...scopes.map(makeContentCacheTag),
    ...artifactHashes.map(makeArtifactCacheTag),
  ];
}
