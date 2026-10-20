import "@tanstack/react-start/server-only";

import { invalidateByTag } from "@vercel/functions";
import { Effect, Schema } from "effect";
import type { ActiveContentReleaseId } from "@/lib/content/published/active";
import { purgeOncePerRelease } from "@/lib/content/store/purge";
import { OG_CACHE_TAG } from "@/lib/og/headers";

/** Vercel could not mark the social image responses stale. */
export class OgCacheInvalidationError extends Schema.TaggedError<OgCacheInvalidationError>()(
  "OgCacheInvalidationError",
  {}
) {}

/** Marks every social image response stale at the CDN. */
const purgeOgCache = Effect.fn("www.og.cache.purge")(function* () {
  yield* Effect.tryPromise({
    catch: () => new OgCacheInvalidationError(),
    try: () => invalidateByTag(OG_CACHE_TAG),
  });
});

/**
 * Purges the social images once for each release, however many scopes the
 * release changes, so the next request for an image renders it from the
 * release that is active now.
 */
export const invalidateOgCache = Effect.fn("www.og.cache.invalidate")(
  function* (releaseId: ActiveContentReleaseId) {
    yield* purgeOncePerRelease({
      kind: "og.purge",
      purge: purgeOgCache(),
      releaseId,
    });
  }
);
