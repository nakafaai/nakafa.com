import {
  LearningArtifactDescriptionSchema as LearningArtifactManifestDescriptionSchema,
  LearningArtifactTitleSchema as LearningArtifactManifestTitleSchema,
} from "@repo/math/schema/artifact/copy";
import {
  MAX_COORDINATE_ARTIFACT_BYTES,
  MAX_COORDINATE_ARTIFACT_PRIMITIVES,
  MAX_LEARNING_ARTIFACT_ID_LENGTH,
} from "@repo/math/schema/artifact/safety";
import {
  COORDINATE_SYSTEM_ARTIFACT_KIND,
  type LearningArtifact,
  LearningArtifactSchema,
} from "@repo/math/schema/artifact/schema";
import { MAX_MATH_AST_DISPLAY_LENGTH } from "@repo/math/schema/ast/schema";
import { Effect, Schema } from "effect";

/** Current durable payload version for coordinate learning artifacts. */
export const LEARNING_ARTIFACT_SCHEMA_VERSION = 1;

const LearningArtifactManifestScalarSchema = Schema.String.pipe(
  Schema.maxLength(MAX_MATH_AST_DISPLAY_LENGTH)
);

const LearningArtifactManifestAxisBoundsSchema = Schema.Struct({
  max: LearningArtifactManifestScalarSchema,
  min: LearningArtifactManifestScalarSchema,
}).pipe(Schema.mutable);

/** Lightweight chat transcript pointer to a durable learning artifact payload. */
export const LearningArtifactManifestSchema = Schema.Struct({
  artifactId: Schema.NonEmptyString.pipe(
    Schema.pattern(/\S/),
    Schema.maxLength(MAX_LEARNING_ARTIFACT_ID_LENGTH)
  ),
  bounds: Schema.Struct({
    x: LearningArtifactManifestAxisBoundsSchema,
    y: LearningArtifactManifestAxisBoundsSchema,
    z: LearningArtifactManifestAxisBoundsSchema,
  }).pipe(Schema.mutable),
  description: Schema.optional(LearningArtifactManifestDescriptionSchema),
  kind: Schema.Literal(COORDINATE_SYSTEM_ARTIFACT_KIND),
  payloadBytes: Schema.Number.pipe(
    Schema.int(),
    Schema.between(1, MAX_COORDINATE_ARTIFACT_BYTES)
  ),
  primitiveCount: Schema.Number.pipe(
    Schema.int(),
    Schema.between(1, MAX_COORDINATE_ARTIFACT_PRIMITIVES)
  ),
  schemaVersion: Schema.Literal(LEARNING_ARTIFACT_SCHEMA_VERSION),
  title: LearningArtifactManifestTitleSchema,
}).pipe(Schema.mutable);

/** Artifact payload write paired to the transcript part order it materializes. */
export const LearningArtifactWriteSchema = Schema.Struct({
  artifact: LearningArtifactSchema,
  partOrder: Schema.Number.pipe(Schema.int(), Schema.nonNegative()),
}).pipe(Schema.mutable);

export type LearningArtifactManifest = Schema.Schema.Type<
  typeof LearningArtifactManifestSchema
>;
export type LearningArtifactWrite = Schema.Schema.Encoded<
  typeof LearningArtifactWriteSchema
>;

/** Expected failure when a durable artifact cannot produce a manifest. */
export class LearningArtifactManifestBuildError extends Schema.TaggedError<LearningArtifactManifestBuildError>()(
  "LearningArtifactManifestBuildError",
  {
    message: Schema.String,
  }
) {}

/** Expected failure when an artifact write cannot be encoded for transport. */
export class LearningArtifactWriteEncodeError extends Schema.TaggedError<LearningArtifactWriteEncodeError>()(
  "LearningArtifactWriteEncodeError",
  {
    message: Schema.String,
  }
) {}

/**
 * Builds the retention-safe manifest stored in transcript parts.
 * Full render payloads stay outside hot transcript rows and are persisted
 * through the matching artifact write batch.
 */
export const buildLearningArtifactManifest = Effect.fn(
  "ai.schema.artifact.buildManifest"
)(function* (artifact: LearningArtifact) {
  const manifest = {
    artifactId: artifact.id,
    bounds: {
      x: {
        max: artifact.payload.axes.x[1].expression,
        min: artifact.payload.axes.x[0].expression,
      },
      y: {
        max: artifact.payload.axes.y[1].expression,
        min: artifact.payload.axes.y[0].expression,
      },
      z: {
        max: artifact.payload.axes.z[1].expression,
        min: artifact.payload.axes.z[0].expression,
      },
    },
    description: readManifestDescription(artifact.description),
    kind: artifact.kind,
    payloadBytes: readArtifactPayloadBytes(artifact),
    primitiveCount: artifact.payload.primitives.length,
    schemaVersion: LEARNING_ARTIFACT_SCHEMA_VERSION,
    title: artifact.title.trim(),
  };

  return yield* Schema.decodeUnknown(LearningArtifactManifestSchema)(
    manifest
  ).pipe(
    Effect.mapError(
      () =>
        new LearningArtifactManifestBuildError({
          message: "Learning artifact manifest is outside transcript budgets.",
        })
    )
  );
});

/**
 * Compares manifest fields explicitly so object-key order cannot affect writes.
 */
export function isSameLearningArtifactManifest(
  actual: LearningArtifactManifest,
  expected: LearningArtifactManifest
) {
  return (
    actual.artifactId === expected.artifactId &&
    actual.kind === expected.kind &&
    actual.title === expected.title &&
    actual.description === expected.description &&
    actual.payloadBytes === expected.payloadBytes &&
    actual.primitiveCount === expected.primitiveCount &&
    actual.bounds.x.min === expected.bounds.x.min &&
    actual.bounds.x.max === expected.bounds.x.max &&
    actual.bounds.y.min === expected.bounds.y.min &&
    actual.bounds.y.max === expected.bounds.y.max &&
    actual.bounds.z.min === expected.bounds.z.min &&
    actual.bounds.z.max === expected.bounds.z.max
  );
}

/**
 * Encodes runtime artifact values into the JSON shape accepted by Convex.
 */
export const encodeLearningArtifactWrite = Effect.fn(
  "ai.schema.artifact.encodeWrite"
)(function* (input: unknown) {
  const write = yield* Schema.decodeUnknown(LearningArtifactWriteSchema)(
    input
  ).pipe(
    Effect.mapError(
      () =>
        new LearningArtifactWriteEncodeError({
          message: "Learning artifact write is not transport encodable.",
        })
    )
  );

  return yield* Effect.sync(() =>
    Schema.encodeSync(LearningArtifactWriteSchema)(write)
  );
});

/**
 * Counts the exact payload that Convex persists outside transcript rows.
 */
function readArtifactPayloadBytes(artifact: LearningArtifact) {
  return new TextEncoder().encode(JSON.stringify(artifact)).byteLength;
}

/**
 * Keeps optional artifact descriptions bounded and nonblank in manifests.
 */
function readManifestDescription(description: string | undefined) {
  if (description === undefined) {
    return;
  }

  const trimmed = description.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}
