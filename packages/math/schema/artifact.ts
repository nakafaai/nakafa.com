import { decodeMathAst, ExactScalar } from "@repo/math/schema/ast";
import {
  type CoordinatePrimitive,
  CoordinatePrimitiveSchema,
  RenderSamplingPolicy,
  readCoordinatePrimitiveMathAsts,
} from "@repo/math/schema/coordinate-primitives";
import { readSortableExactScalar } from "@repo/math/schema/coordinate-scalars";
import { findCoordinatePrimitiveIssue } from "@repo/math/schema/coordinate-validation";
import { Effect, Schema } from "effect";

export const COORDINATE_SYSTEM_ARTIFACT_KIND = "coordinate-system-3d";

/** Maximum serialized size accepted for one coordinate learning artifact. */
export const MAX_COORDINATE_ARTIFACT_BYTES = 750_000;

/** Maximum deterministic primitive count accepted for one coordinate artifact. */
export const MAX_COORDINATE_ARTIFACT_PRIMITIVES = 64;

/** Maximum proof anchors accepted on one coordinate artifact. */
export const MAX_COORDINATE_ARTIFACT_PROOF_ANCHORS = 16;

/** Maximum length accepted for one proof anchor reference. */
export const MAX_COORDINATE_ARTIFACT_PROOF_ANCHOR_LENGTH = 180;

const ArtifactIdSchema = Schema.NonEmptyString.annotations({
  description: "Stable artifact identifier used by chat part manifests.",
});

const ProofAnchorSchema = Schema.NonEmptyString.pipe(
  Schema.pattern(/\S/),
  Schema.maxLength(MAX_COORDINATE_ARTIFACT_PROOF_ANCHOR_LENGTH)
).annotations({
  description: "Bounded nonblank reference to deterministic artifact proof.",
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

  const sizeIssue = findArtifactSizeIssue(artifact);
  if (sizeIssue) {
    return yield* Effect.fail(
      new LearningArtifactDecodeError({ message: sizeIssue })
    );
  }

  const axisIssue = findAxisRangeIssue(artifact);
  if (axisIssue) {
    return yield* Effect.fail(
      new LearningArtifactDecodeError({ message: axisIssue })
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

function findDuplicatePrimitiveId(primitives: readonly CoordinatePrimitive[]) {
  const ids = new Set<string>();

  for (const primitive of primitives) {
    if (ids.has(primitive.id)) {
      return primitive.id;
    }
    ids.add(primitive.id);
  }
}

function findArtifactSizeIssue(artifact: LearningArtifact) {
  const json = JSON.stringify(artifact);
  const sizeBytes = new TextEncoder().encode(json).byteLength;

  if (sizeBytes > MAX_COORDINATE_ARTIFACT_BYTES) {
    return `Coordinate artifact exceeds ${MAX_COORDINATE_ARTIFACT_BYTES} bytes.`;
  }
}

function findAxisRangeIssue(artifact: LearningArtifact) {
  const xIssue = findOneAxisRangeIssue("x", artifact.payload.axes.x);
  if (xIssue) {
    return xIssue;
  }

  const yIssue = findOneAxisRangeIssue("y", artifact.payload.axes.y);
  if (yIssue) {
    return yIssue;
  }

  return findOneAxisRangeIssue("z", artifact.payload.axes.z);
}

function findOneAxisRangeIssue(
  axisName: "x" | "y" | "z",
  range: readonly [ExactScalar, ExactScalar]
) {
  const min = readSortableExactScalar(range[0]);
  const max = readSortableExactScalar(range[1]);

  if (min === undefined) {
    return `Coordinate artifact ${axisName}-axis range must use sortable numeric bounds.`;
  }

  if (max === undefined) {
    return `Coordinate artifact ${axisName}-axis range must use sortable numeric bounds.`;
  }

  if (min >= max) {
    return `Coordinate artifact ${axisName}-axis range must be increasing.`;
  }
}
