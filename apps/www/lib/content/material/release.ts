import { ReleaseIdSchema } from "@nakafa/aksara-contracts/ids";
import { Effect, Either, Schema } from "effect";
import type { MaterialProjectionIdentity } from "@/lib/content/material/decode";
import { makeMaterialProjectionError } from "@/lib/content/material/decode";
import {
  type ActiveContentReleaseId,
  fetchActiveContentIdentity,
  readActiveContentIdentity,
} from "@/lib/content/published/active";
import { PublishedReleaseMismatchError } from "@/lib/content/published/errors";

/** Active material release identity shared across one multi-read request. */
export type MaterialReleasePin = ActiveContentReleaseId | null;

type MaterialReleasePinError =
  | ReturnType<typeof makeMaterialProjectionError>
  | PublishedReleaseMismatchError;

/** Decodes one release pin without starting an Effect runtime. */
function decodeReleasePin(
  actual: unknown,
  expected: MaterialReleasePin | undefined,
  identity: MaterialProjectionIdentity
): Either.Either<MaterialReleasePin, MaterialReleasePinError> {
  const decoded = Schema.decodeUnknownEither(Schema.NullOr(ReleaseIdSchema))(
    actual
  );
  if (Either.isLeft(decoded)) {
    return Either.left(makeMaterialProjectionError(identity));
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

/** Decodes and verifies the active release returned by one material read. */
export const decodeMaterialReleasePin = Effect.fn(
  "NakafaMaterial.decodeReleasePin"
)(function* (
  actual: unknown,
  expected: MaterialReleasePin | undefined,
  identity: MaterialProjectionIdentity
) {
  const decoded = decodeReleasePin(actual, expected, identity);
  if (Either.isLeft(decoded)) {
    return yield* decoded.left;
  }
  return decoded.right;
});

/** Rechecks one material read against the latest active publication identity. */
export const verifyMaterialReleasePin = Effect.fn(
  "NakafaMaterial.verifyReleasePin"
)(function* (
  expected: MaterialReleasePin,
  identity: MaterialProjectionIdentity
) {
  const active = yield* readActiveContentIdentity();
  return yield* decodeMaterialReleasePin(
    active?.releaseId ?? null,
    expected,
    identity
  );
});

/**
 * Rechecks one static material read without starting an Effect fiber.
 *
 * The direct Promise is the framework boundary for static RSC prerender. Domain
 * validation still uses the same pure decoder as the Effect-native operation.
 *
 * @see https://nextjs.org/docs/messages/next-prerender-current-time
 */
export function verifyStaticMaterialReleasePin(
  expected: MaterialReleasePin,
  identity: MaterialProjectionIdentity
) {
  return fetchActiveContentIdentity().then((active) => {
    const decoded = decodeReleasePin(
      active?.releaseId ?? null,
      expected,
      identity
    );
    if (Either.isLeft(decoded)) {
      return Promise.reject(decoded.left);
    }
    return decoded.right;
  });
}
