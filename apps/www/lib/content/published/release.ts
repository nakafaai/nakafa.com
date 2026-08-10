import { ReleaseIdSchema } from "@nakafa/aksara-contracts/ids";
import { Effect, Either, Schema } from "effect";
import {
  type ActiveContentReleaseId,
  readActiveContentIdentity,
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
): Either.Either<ContentReleasePin, ContentReleasePinError> {
  const decoded = Schema.decodeUnknownEither(Schema.NullOr(ReleaseIdSchema))(
    actual
  );
  if (Either.isLeft(decoded)) {
    return Either.left(new PublishedProjectionError(identity));
  }
  if (expected !== undefined && decoded.right !== expected) {
    return Either.left(
      new PublishedReleaseMismatchError({
        actualReleaseId: decoded.right,
        expectedReleaseId: expected,
      })
    );
  }
  return Either.right(decoded.right);
}

/** Decodes and verifies the active release returned by one signed read. */
export const decodeContentReleasePin = Effect.fn(
  "NakafaContent.decodeReleasePin"
)(function* (
  actual: unknown,
  expected: ContentReleasePin | undefined,
  identity: PublishedProjectionIdentity
) {
  const decoded = decodeReleasePin(actual, expected, identity);
  if (Either.isLeft(decoded)) {
    return yield* decoded.left;
  }
  return decoded.right;
});

/** Rechecks one multi-read operation against the active publication identity. */
export const verifyContentReleasePin = Effect.fn(
  "NakafaContent.verifyReleasePin"
)(function* (
  expected: ContentReleasePin,
  identity: PublishedProjectionIdentity
) {
  const active = yield* readActiveContentIdentity();
  return yield* decodeContentReleasePin(
    active?.releaseId ?? null,
    expected,
    identity
  );
});
