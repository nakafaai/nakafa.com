import "@tanstack/react-start/server-only";

import { Effect } from "effect";
import type { ActiveContentReleaseId } from "@/lib/content/published/active";
import { invalidateStoreTag } from "@/lib/content/store/entry";
import { purgeOncePerRelease } from "@/lib/content/store/purge";
import { CONTENT_LLMS_CACHE_TAG } from "@/lib/llms/constants";

/**
 * Marks every Markdown answer of the llms corpus stale at the CDN, once for each
 * release. The answers carry the tag, so the next request for one of them reads
 * the release that is active now, and the purge needs no store entry, because
 * every store key already names its release.
 */
export const invalidateLlmsCache = Effect.fn("www.llms.cache.invalidate")(
  function* (releaseId: ActiveContentReleaseId) {
    yield* purgeOncePerRelease({
      kind: "llms.purge",
      purge: invalidateStoreTag(CONTENT_LLMS_CACHE_TAG),
      releaseId,
    });
  }
);
