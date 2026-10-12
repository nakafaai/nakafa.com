import { ReleaseIdSchema } from "@nakafa/aksara-contracts/ids";
import { Effect, Result, Schema } from "effect";
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
type ContentReleasePinError =
  | PublishedProjectionError
  | PublishedReleaseMismatchError;
/** Decodes one release pin without starting an Effect runtime. */
function decodeReleasePin(
  actual: unknown,
  expected: ContentReleasePin | undefined,
  identity: PublishedProjectionIdentity
): Result.Result<ContentReleasePin, ContentReleasePinError> {
  const decoded = Schema.decodeUnknownResult(Schema.NullOr(ReleaseIdSchema))(
    actual
  );
  if (Result.isFailure(decoded)) {
    return Result.fail(new PublishedProjectionError(identity));
  }
  if (expected !== undefined && decoded.success !== expected) {
    return Result.fail(
      new PublishedReleaseMismatchError({
        actualReleaseId: decoded.success,
        expectedReleaseId: expected,
      })
    );
  }
  return Result.succeed(decoded.success);
}
/**
 * Decodes and verifies the active release returned by one signed read.
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
  expected: ContentReleasePin | undefined,
  identity: PublishedProjectionIdentity
) {
  const decoded = decodeReleasePin(actual, expected, identity);
  if (Result.isFailure(decoded)) {
    if (decoded.failure._tag === "PublishedReleaseMismatchError") {
      yield* expireActiveContentIdentity().pipe(Effect.ignore({ log: "Warn" }));
    }
    return yield* decoded.failure;
  }
  return decoded.success;
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
