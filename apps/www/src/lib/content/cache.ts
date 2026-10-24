import {
  type ContentCacheScope,
  makeContentCacheTag,
} from "@nakafa/aksara-contracts/cache/content";
import { Effect, Schema } from "effect";
import { expireStoreTag } from "@/lib/content/store/entry";

/** The content store could not expire the entries of a changed dependency after publication. */
export class ContentCacheInvalidationError extends Schema.TaggedError<ContentCacheInvalidationError>()(
  "ContentCacheInvalidationError",
  {}
) {}

/**
 * Expires every content store entry that carries the tag of one mutable
 * dependency. Content reads are keyed by the active release, so a publication
 * reads new entries without this call; the expiry removes the entries that
 * carry the tag of a dependency that changed in place.
 */
export const invalidateContentCache = Effect.fn("www.content.cache.invalidate")(
  function* (scope: ContentCacheScope) {
    yield* expireStoreTag(makeContentCacheTag(scope)).pipe(
      Effect.mapError(() => new ContentCacheInvalidationError())
    );
    return scope;
  }
);
