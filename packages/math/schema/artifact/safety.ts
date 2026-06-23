import { Effect, Schema } from "effect";

/** Maximum serialized size accepted for one coordinate learning artifact. */
export const MAX_COORDINATE_ARTIFACT_BYTES = 750_000;

/** Maximum deterministic primitive count accepted for one coordinate artifact. */
export const MAX_COORDINATE_ARTIFACT_PRIMITIVES = 64;

/** Maximum length accepted for one learning artifact id. */
export const MAX_LEARNING_ARTIFACT_ID_LENGTH = 180;

/** Maximum proof anchors accepted on one coordinate artifact. */
export const MAX_COORDINATE_ARTIFACT_PROOF_ANCHORS = 16;

/** Maximum length accepted for one proof anchor reference. */
export const MAX_COORDINATE_ARTIFACT_PROOF_ANCHOR_LENGTH = 180;

/** Expected failure raised when raw artifact preflight cannot read JSON size. */
export class ArtifactSafetyReadError extends Schema.TaggedError<ArtifactSafetyReadError>()(
  "ArtifactSafetyReadError",
  {
    message: Schema.String,
  }
) {}

/**
 * Checks raw artifact JSON size before schema decode walks nested payloads.
 */
export const findRawArtifactSizeIssue = Effect.fn(
  "math.artifact.findRawArtifactSizeIssue"
)(function* (input: unknown) {
  const json = yield* Effect.try({
    catch: () =>
      new ArtifactSafetyReadError({
        message: "Invalid learning artifact contract.",
      }),
    try: () => JSON.stringify(input),
  });

  if (json === undefined) {
    return yield* Effect.fail(
      new ArtifactSafetyReadError({
        message: "Invalid learning artifact contract.",
      })
    );
  }

  const sizeBytes = new TextEncoder().encode(json).byteLength;
  if (sizeBytes > MAX_COORDINATE_ARTIFACT_BYTES) {
    return `Coordinate artifact exceeds ${MAX_COORDINATE_ARTIFACT_BYTES} bytes.`;
  }
});
