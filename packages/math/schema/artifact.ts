import { decodeMathAst, ExactScalar } from "@repo/math/schema/ast";
import {
  type CoordinatePrimitive,
  CoordinatePrimitiveSchema,
  RenderSamplingPolicy,
  readCoordinatePrimitiveMathAsts,
} from "@repo/math/schema/coordinate-primitives";
import { Effect, Schema } from "effect";

export const COORDINATE_SYSTEM_ARTIFACT_KIND = "coordinate-system-3d";

const ArtifactIdSchema = Schema.NonEmptyString.annotations({
  description: "Stable artifact identifier used by chat part manifests.",
});

const AxisRangeSchema = Schema.Tuple(ExactScalar, ExactScalar).annotations({
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
  proofAnchors: Schema.Array(Schema.NonEmptyString).pipe(
    Schema.minItems(1),
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

/** Decodes a learning artifact and verifies symbolic math references. */
export const decodeLearningArtifact = Effect.fn(
  "math.artifact.decodeLearningArtifact"
)(function* (input: unknown) {
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

  const duplicateId = findDuplicatePrimitiveId(artifact.payload.primitives);
  if (duplicateId) {
    return yield* Effect.fail(
      new LearningArtifactDecodeError({
        message: `Duplicate coordinate primitive id: ${duplicateId}.`,
      })
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

function findDuplicatePrimitiveId(primitives: readonly CoordinatePrimitive[]) {
  const ids = new Set<string>();

  for (const primitive of primitives) {
    if (ids.has(primitive.id)) {
      return primitive.id;
    }
    ids.add(primitive.id);
  }
}
