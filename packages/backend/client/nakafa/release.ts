import {
  ReleaseIdSchema,
  Sha256HashSchema,
} from "@nakafa/aksara-contracts/ids";
import { readNakafaRuntimeQuery } from "@repo/backend/client/nakafa/query";
import { api } from "@repo/backend/convex/_generated/api";
import {
  getUnknownErrorMessage,
  NakafaAgentDataReadError,
} from "@repo/contents/_lib/agent/errors";
import { Effect, Schema } from "effect";

const NakafaReleasePinSchema = Schema.NullOr(
  Schema.Struct({
    manifestHash: Sha256HashSchema,
    releaseId: ReleaseIdSchema,
    sequence: Schema.Finite.pipe(
      Schema.check(Schema.isInt()),
      Schema.check(Schema.isGreaterThan(0))
    ),
  })
);
type NakafaReleasePin = typeof NakafaReleasePinSchema.Type;
/** Reads the complete active publication identity for a multi-query operation. */
export const readNakafaReleasePin = Effect.fn("NakafaContent.readReleasePin")(
  function* (convexUrl: string) {
    const identity = yield* readNakafaRuntimeQuery(
      convexUrl,
      api.contentRelease.runtime.active.read,
      {}
    );
    return yield* Schema.decodeEffect(NakafaReleasePinSchema)(identity).pipe(
      Effect.mapError(
        (error) =>
          new NakafaAgentDataReadError({
            cause: getUnknownErrorMessage(error),
            message: "Unable to decode the active Nakafa content release.",
          })
      )
    );
  }
);
/** Verifies a multi-query read stayed on one exact publication generation. */
export const verifyNakafaReleasePin = Effect.fn(
  "NakafaContent.verifyReleasePin"
)(function* (convexUrl: string, expected: NakafaReleasePin) {
  const actual = yield* readNakafaReleasePin(convexUrl);
  if (!hasSameReleaseIdentity(expected, actual)) {
    return yield* new NakafaAgentDataReadError({
      cause: `Active content release changed from ${formatReleaseIdentity(expected)} to ${formatReleaseIdentity(actual)}.`,
      message: "Unable to complete one release-pinned Nakafa content read.",
    });
  }
  return actual;
});
/** Compares every signed field that identifies one active publication. */
function hasSameReleaseIdentity(
  expected: NakafaReleasePin,
  actual: NakafaReleasePin
) {
  if (expected === null || actual === null) {
    return expected === actual;
  }
  return (
    expected.manifestHash === actual.manifestHash &&
    expected.releaseId === actual.releaseId &&
    expected.sequence === actual.sequence
  );
}
/** Formats one public release identity for a typed consistency diagnostic. */
function formatReleaseIdentity(identity: NakafaReleasePin) {
  if (identity === null) {
    return "none";
  }
  return `${identity.releaseId}@${identity.sequence} (${identity.manifestHash})`;
}
