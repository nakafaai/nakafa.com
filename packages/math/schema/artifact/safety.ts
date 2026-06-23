import { MAX_MATH_AST_NODES } from "@repo/math/schema/ast/schema";
import {
  MAX_FUNCTION_DOMAINS,
  MAX_FUNCTION_EXCLUSIONS,
  MAX_POLYGON_VERTICES,
} from "@repo/math/schema/coordinate/primitive";
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
  const arrayIssue = yield* findRawArtifactArrayIssue(input);
  if (arrayIssue) {
    return arrayIssue;
  }

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

/**
 * Checks producer-controlled arrays before JSON serialization can allocate.
 */
const findRawArtifactArrayIssue = Effect.fn(
  "math.artifact.findRawArtifactArrayIssue"
)(function* (input: unknown) {
  const proofAnchors = yield* readRawField(input, "proofAnchors");
  const proofIssue = readArrayLengthIssue(
    proofAnchors,
    "Coordinate artifact proof anchors",
    MAX_COORDINATE_ARTIFACT_PROOF_ANCHORS
  );
  if (proofIssue) {
    return proofIssue;
  }

  const payload = yield* readRawField(input, "payload");
  const primitives = yield* readRawField(payload, "primitives");
  const primitiveIssue = readArrayLengthIssue(
    primitives,
    "Coordinate artifact primitives",
    MAX_COORDINATE_ARTIFACT_PRIMITIVES
  );
  if (primitiveIssue || !Array.isArray(primitives)) {
    return primitiveIssue;
  }

  for (let index = 0; index < primitives.length; index += 1) {
    const issue = yield* findRawPrimitiveArrayIssue(primitives[index], index);
    if (issue) {
      return issue;
    }
  }
});

/**
 * Checks one raw primitive's nested arrays after the primitive count is bounded.
 */
const findRawPrimitiveArrayIssue = Effect.fn(
  "math.artifact.findRawPrimitiveArrayIssue"
)(function* (primitive: unknown, index: number) {
  const vertices = yield* readRawField(primitive, "vertices");
  const vertexIssue = readArrayLengthIssue(
    vertices,
    `Coordinate primitive ${index} polygon vertices`,
    MAX_POLYGON_VERTICES
  );
  if (vertexIssue) {
    return vertexIssue;
  }

  const functionSpec = yield* readRawField(primitive, "function");
  const functionIssue = yield* findRawFunctionArrayIssue(
    functionSpec,
    `Coordinate primitive ${index} function`
  );
  if (functionIssue) {
    return functionIssue;
  }

  const equation = yield* readRawField(primitive, "equation");
  return yield* findRawFunctionArrayIssue(
    equation,
    `Coordinate primitive ${index} equation`
  );
});

/**
 * Checks scalar/vector function arrays without traversing unbounded rows.
 */
const findRawFunctionArrayIssue = Effect.fn(
  "math.artifact.findRawFunctionArrayIssue"
)(function* (spec: unknown, label: string) {
  const domain = yield* readRawField(spec, "domain");
  const domainIssue = readArrayLengthIssue(
    domain,
    `${label} domains`,
    MAX_FUNCTION_DOMAINS
  );
  if (domainIssue) {
    return domainIssue;
  }

  const exclusions = yield* readRawField(spec, "exclusions");
  const exclusionIssue = readArrayLengthIssue(
    exclusions,
    `${label} exclusions`,
    MAX_FUNCTION_EXCLUSIONS
  );
  if (exclusionIssue) {
    return exclusionIssue;
  }

  const astIssue = yield* findRawMathAstArrayIssue(
    yield* readRawField(spec, "ast"),
    `${label} ast`
  );
  if (astIssue) {
    return astIssue;
  }

  for (const field of ["x", "y", "z"]) {
    const issue = yield* findRawMathAstArrayIssue(
      yield* readRawField(spec, field),
      `${label} ${field}`
    );
    if (issue) {
      return issue;
    }
  }

  if (!Array.isArray(exclusions)) {
    return;
  }

  for (let index = 0; index < exclusions.length; index += 1) {
    const issue = yield* findRawMathAstArrayIssue(
      exclusions[index],
      `${label} exclusion ${index}`
    );
    if (issue) {
      return issue;
    }
  }
});

/**
 * Checks one raw MathAst node array before schema decode builds an id map.
 */
const findRawMathAstArrayIssue = Effect.fn(
  "math.artifact.findRawMathAstArrayIssue"
)(function* (ast: unknown, label: string) {
  const nodes = yield* readRawField(ast, "nodes");
  return readArrayLengthIssue(nodes, `${label} nodes`, MAX_MATH_AST_NODES);
});

/**
 * Reads a producer-controlled property through the typed Effect error path.
 */
const readRawField = Effect.fn("math.artifact.readRawField")(function* (
  source: unknown,
  field: string
) {
  return yield* Effect.try({
    catch: () =>
      new ArtifactSafetyReadError({
        message: "Invalid learning artifact contract.",
      }),
    try: () => (isObjectLike(source) ? Reflect.get(source, field) : undefined),
  });
});

/**
 * Builds a deterministic array-budget issue without iterating the array.
 */
function readArrayLengthIssue(value: unknown, label: string, limit: number) {
  if (!Array.isArray(value) || value.length <= limit) {
    return;
  }

  return `${label} exceeds ${limit} items.`;
}

/**
 * Narrows values whose properties may be inspected with Reflect.get.
 */
function isObjectLike(value: unknown) {
  return (
    (typeof value === "object" || typeof value === "function") && value !== null
  );
}
