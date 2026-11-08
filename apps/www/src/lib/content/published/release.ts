import { ReleaseIdSchema } from "@nakafa/aksara-contracts/ids";
import { Effect, Schema } from "effect";
import {
  type ActiveContentReleaseId,
  expireActiveContentIdentity,
  loadActiveContentIdentity,
} from "@/lib/content/published/active";
import {
  PublishedProjectionError,
  type PublishedProjectionIdentity,
  PublishedReleaseMismatchError,
} from "@/lib/content/published/errors";
/** Active signed publication identity shared across one multi-read request. */
export type ContentReleasePin = ActiveContentReleaseId | null;
/**
 * Decodes the release that one signed read names. A pinned read needs nothing
 * more: the content store already proved its release against the pin.
 */
export const decodeContentRelease = Effect.fn("NakafaContent.decodeRelease")(
  function* (actual: unknown, identity: PublishedProjectionIdentity) {
    return yield* Schema.decodeUnknownEffect(Schema.NullOr(ReleaseIdSchema))(
      actual
    ).pipe(Effect.mapError(() => new PublishedProjectionError(identity)));
  }
);
/**
 * Decodes the release of one read and compares it with the release that an
 * earlier read of the same operation named, for reads that did not go through
 * the content store under that release.
 *
 * A pin usually comes from the stored release pointer, so a read that names
 * another release shows that the pointer is out of date or that a release has
 * just landed. Either way the pointer is dropped, and the next read asks Convex
 * instead of failing every pinned read until the pointer expires on its own.
 */
export const decodeContentReleasePin = Effect.fn(
  "NakafaContent.decodeReleasePin"
)(function* (
  actual: unknown,
  expected: ContentReleasePin,
  identity: PublishedProjectionIdentity
) {
  const decoded = yield* decodeContentRelease(actual, identity);
  if (decoded !== expected) {
    yield* expireActiveContentIdentity();
    return yield* new PublishedReleaseMismatchError({
      actualReleaseId: decoded,
      expectedReleaseId: expected,
    });
  }
  return decoded;
});
/**
 * Rechecks one multi-read operation against the active publication identity as
 * Convex holds it now. A stored pointer would repeat the answer that the
 * operation started from and could not notice a release that landed since.
 */
export const verifyContentReleasePin = Effect.fn(
  "NakafaContent.verifyReleasePin"
)(function* (
  expected: ContentReleasePin,
  identity: PublishedProjectionIdentity
) {
  const active = yield* loadActiveContentIdentity();
  return yield* decodeContentReleasePin(
    active?.releaseId ?? null,
    expected,
    identity
  );
});
