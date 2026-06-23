import { findLearningArtifactInvariantIssue } from "@repo/math/schema/artifact/invariant";
import {
  findRawArtifactSizeIssue,
  MAX_COORDINATE_ARTIFACT_PRIMITIVES,
  MAX_COORDINATE_ARTIFACT_PROOF_ANCHOR_LENGTH,
  MAX_COORDINATE_ARTIFACT_PROOF_ANCHORS,
  MAX_LEARNING_ARTIFACT_ID_LENGTH,
} from "@repo/math/schema/artifact/safety";
import { decodeMathAst, ExactScalar } from "@repo/math/schema/ast/schema";
import {
  CoordinatePrimitiveSchema,
  RenderSamplingPolicy,
  readCoordinatePrimitiveMathAsts,
} from "@repo/math/schema/coordinate/primitive";
import { findCoordinatePrimitiveIssue } from "@repo/math/schema/coordinate/validation";
import { Effect, Schema } from "effect";

export const COORDINATE_SYSTEM_ARTIFACT_KIND = "coordinate-system-3d";

const ArtifactIdSchema = Schema.NonEmptyString.pipe(
  Schema.pattern(/\S/),
  Schema.maxLength(MAX_LEARNING_ARTIFACT_ID_LENGTH)
).annotations({
  description: "Stable artifact identifier used by chat part manifests.",
});

const ProofAnchorSchema = Schema.NonEmptyString.pipe(
  Schema.pattern(/\S/),
  Schema.maxLength(MAX_COORDINATE_ARTIFACT_PROOF_ANCHOR_LENGTH)
).annotations({
  description: "Bounded nonblank reference to deterministic artifact proof.",
});

const AxisRangeSchema = Schema.Tuple(ExactScalar, ExactScalar)
  .pipe(Schema.mutable)
  .annotations({
    description: "Exact inclusive axis range for renderer framing.",
  });

/** Deterministic coordinate system payload for educational 3D rendering. */
export class CoordinateSystemPayload extends Schema.Class<CoordinateSystemPayload>(
  "CoordinateSystemPayload"
)({
  axes: Schema.Struct({
    x: AxisRangeSchema,
    y: AxisRangeSchema,
    z: AxisRangeSchema,
  }).pipe(Schema.mutable),
  primitives: Schema.Array(CoordinatePrimitiveSchema).pipe(
    Schema.minItems(1),
    Schema.maxItems(MAX_COORDINATE_ARTIFACT_PRIMITIVES),
    Schema.mutable
  ),
  sampling: RenderSamplingPolicy,
}) {}

/** Full durable artifact for a coordinate-system-3d chat manifest. */
export class CoordinateSystemArtifact extends Schema.Class<CoordinateSystemArtifact>(
  "CoordinateSystemArtifact"
)({
  description: Schema.optional(Schema.String),
  id: ArtifactIdSchema,
  kind: Schema.Literal(COORDINATE_SYSTEM_ARTIFACT_KIND),
  payload: CoordinateSystemPayload,
  proofAnchors: Schema.Array(ProofAnchorSchema).pipe(
    Schema.minItems(1),
    Schema.maxItems(MAX_COORDINATE_ARTIFACT_PROOF_ANCHORS),
    Schema.mutable
  ),
  title: Schema.NonEmptyString,
}) {}

/** Schema-owned learning artifact union. */
export const LearningArtifactSchema = Schema.Union(CoordinateSystemArtifact);

export type LearningArtifact = Schema.Schema.Type<
  typeof LearningArtifactSchema
>;

/** Expected failure raised when a learning artifact is not deterministic. */
export class LearningArtifactDecodeError extends Schema.TaggedError<LearningArtifactDecodeError>()(
  "LearningArtifactDecodeError",
  {
    message: Schema.String,
  }
) {}

/**
 * Decodes a learning artifact and verifies symbolic math references.
 */
export const decodeLearningArtifact = Effect.fn(
  "math.artifact.decodeLearningArtifact"
)(function* (input: unknown) {
  const rawSizeIssue = yield* findRawArtifactSizeIssue(input).pipe(
    Effect.mapError(
      (error) => new LearningArtifactDecodeError({ message: error.message })
    )
  );
  if (rawSizeIssue) {
    return yield* Effect.fail(
      new LearningArtifactDecodeError({ message: rawSizeIssue })
    );
  }

  const artifact = yield* Schema.decodeUnknown(LearningArtifactSchema)(
    input
  ).pipe(
    Effect.mapError(
      () =>
        new LearningArtifactDecodeError({
          message: "Invalid learning artifact contract.",
        })
    )
  );

  const artifactIssue = findLearningArtifactInvariantIssue(artifact);
  if (artifactIssue) {
    return yield* Effect.fail(
      new LearningArtifactDecodeError({ message: artifactIssue })
    );
  }

  const primitiveIssue = findCoordinatePrimitiveIssue(
    artifact.payload.primitives
  );
  if (primitiveIssue) {
    return yield* Effect.fail(
      new LearningArtifactDecodeError({ message: primitiveIssue.message })
    );
  }

  for (const ast of readCoordinatePrimitiveMathAsts(
    artifact.payload.primitives
  )) {
    yield* decodeMathAst(ast).pipe(
      Effect.mapError(
        (error) => new LearningArtifactDecodeError({ message: error.message })
      )
    );
  }

  return artifact;
});
