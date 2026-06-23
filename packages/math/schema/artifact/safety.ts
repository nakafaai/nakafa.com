import {
  ArtifactSafetyReadError,
  readRawArrayCount,
  readRawArrayItem,
  readRawField,
  readRawJsonByteCount,
} from "@repo/math/schema/artifact/raw";
import { MAX_MATH_AST_NODES } from "@repo/math/schema/ast/schema";
import {
  MAX_FUNCTION_DOMAINS,
  MAX_FUNCTION_EXCLUSIONS,
  MAX_POLYGON_VERTICES,
} from "@repo/math/schema/coordinate/primitive";
import { Effect } from "effect";

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

const MAX_RAW_ARTIFACT_ARRAY_ITEMS = Math.max(
  MAX_COORDINATE_ARTIFACT_PRIMITIVES,
  MAX_COORDINATE_ARTIFACT_PROOF_ANCHORS,
  MAX_FUNCTION_DOMAINS,
  MAX_FUNCTION_EXCLUSIONS,
  MAX_MATH_AST_NODES,
  MAX_POLYGON_VERTICES
);

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

  const sizeBytes = yield* readRawJsonByteCount(input, new WeakSet(), {
    arrayItems: MAX_RAW_ARTIFACT_ARRAY_ITEMS,
    bytes: MAX_COORDINATE_ARTIFACT_BYTES,
  });
  if (sizeBytes === undefined) {
    return yield* Effect.fail(
      new ArtifactSafetyReadError({
        message: "Invalid learning artifact contract.",
      })
    );
  }

  if (sizeBytes > MAX_COORDINATE_ARTIFACT_BYTES) {
    return `Coordinate artifact exceeds ${MAX_COORDINATE_ARTIFACT_BYTES} bytes.`;
  }
});

/**
 * Checks producer-controlled arrays before JSON serialization can allocate.
 */
export const findRawArtifactArrayIssue = Effect.fn(
  "math.artifact.findRawArtifactArrayIssue"
)(function* (input: unknown) {
  const proofAnchors = yield* readRawField(input, "proofAnchors");
  const proofCount = yield* readRawArrayCount(
    proofAnchors,
    "Coordinate artifact proof anchors",
    MAX_COORDINATE_ARTIFACT_PROOF_ANCHORS
  );
  if (typeof proofCount === "string") {
    return proofCount;
  }

  const payload = yield* readRawField(input, "payload");
  const axisIssue = yield* findRawAxisArrayIssue(payload);
  if (axisIssue) {
    return axisIssue;
  }

  const primitives = yield* readRawField(payload, "primitives");
  const primitiveCount = yield* readRawArrayCount(
    primitives,
    "Coordinate artifact primitives",
    MAX_COORDINATE_ARTIFACT_PRIMITIVES
  );
  if (typeof primitiveCount !== "number") {
    return primitiveCount;
  }

  for (let index = 0; index < primitiveCount; index += 1) {
    const primitive = yield* readRawArrayItem(primitives, index);
    const issue = yield* findRawPrimitiveArrayIssue(primitive, index);
    if (issue) {
      return issue;
    }
  }
});

/**
 * Checks raw axis tuple lengths before generic byte traversal sees arrays.
 */
const findRawAxisArrayIssue = Effect.fn("math.artifact.findRawAxisArrayIssue")(
  function* (payload: unknown) {
    const axes = yield* readRawField(payload, "axes");
    for (const axis of ["x", "y", "z"]) {
      const range = yield* readRawField(axes, axis);
      const count = yield* readRawArrayCount(
        range,
        `Coordinate artifact axis ${axis} range`,
        2
      );
      if (typeof count === "string") {
        return count;
      }
    }
  }
);

/**
 * Checks one raw primitive's nested arrays after the primitive count is bounded.
 */
const findRawPrimitiveArrayIssue = Effect.fn(
  "math.artifact.findRawPrimitiveArrayIssue"
)(function* (primitive: unknown, index: number) {
  const vertices = yield* readRawField(primitive, "vertices");
  const vertexCount = yield* readRawArrayCount(
    vertices,
    `Coordinate primitive ${index} polygon vertices`,
    MAX_POLYGON_VERTICES
  );
  if (typeof vertexCount === "string") {
    return vertexCount;
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
  const domainCount = yield* readRawArrayCount(
    domain,
    `${label} domains`,
    MAX_FUNCTION_DOMAINS
  );
  if (typeof domainCount === "string") {
    return domainCount;
  }

  const exclusions = yield* readRawField(spec, "exclusions");
  const exclusionCount = yield* readRawArrayCount(
    exclusions,
    `${label} exclusions`,
    MAX_FUNCTION_EXCLUSIONS
  );
  if (typeof exclusionCount === "string") {
    return exclusionCount;
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

  if (exclusionCount === undefined) {
    return;
  }

  for (let index = 0; index < exclusionCount; index += 1) {
    const exclusion = yield* readRawArrayItem(exclusions, index);
    const issue = yield* findRawMathAstArrayIssue(
      exclusion,
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
  const nodeCount = yield* readRawArrayCount(
    nodes,
    `${label} nodes`,
    MAX_MATH_AST_NODES
  );
  return typeof nodeCount === "string" ? nodeCount : undefined;
});
