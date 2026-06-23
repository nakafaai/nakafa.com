import { LEARNING_ARTIFACT_SCHEMA_VERSION as CURRENT_LEARNING_ARTIFACT_SCHEMA_VERSION } from "@repo/ai/schema/artifact";
import { COORDINATE_SYSTEM_ARTIFACT_KIND } from "@repo/math/schema/artifact/schema";
import {
  MATH_AST_BINARY_OPERATOR_VALUES,
  MATH_AST_UNARY_OPERATOR_VALUES,
  MATH_VARIABLE_NAME_VALUES,
} from "@repo/math/schema/ast/schema";
import { COORDINATE_AXIS_VALUES } from "@repo/math/schema/coordinate/primitive";
import { type Infer, v } from "convex/values";
import { literals } from "convex-helpers/validators";

/** Durable artifact payload schema version mirrored from the AI domain schema. */
export const LEARNING_ARTIFACT_SCHEMA_VERSION =
  CURRENT_LEARNING_ARTIFACT_SCHEMA_VERSION;

/** Durable artifact ids are globally unique logical keys, not Convex row ids. */
export const learningArtifactIdValidator = v.string();

/** Learning artifact kinds supported by the current renderer contract. */
export const learningArtifactKindValidator = literals(
  COORDINATE_SYSTEM_ARTIFACT_KIND
);

/** Schema version stored with every durable artifact payload and manifest. */
export const learningArtifactSchemaVersionValidator = v.literal(
  LEARNING_ARTIFACT_SCHEMA_VERSION
);

const exactScalarValidator = v.object({
  decimal: v.optional(v.number()),
  expression: v.string(),
  latex: v.string(),
});

const exactPoint3Validator = v.object({
  x: exactScalarValidator,
  y: exactScalarValidator,
  z: exactScalarValidator,
});

const mathAstNodeIdValidator = v.string();
const mathAstLiteralNodeValidator = v.object({
  id: mathAstNodeIdValidator,
  kind: v.literal("literal"),
  value: exactScalarValidator,
});
const mathAstVariableNodeValidator = v.object({
  id: mathAstNodeIdValidator,
  kind: v.literal("variable"),
  name: literals(...MATH_VARIABLE_NAME_VALUES),
});
const mathAstUnaryNodeValidator = v.object({
  id: mathAstNodeIdValidator,
  kind: v.literal("unary"),
  operand: mathAstNodeIdValidator,
  operator: literals(...MATH_AST_UNARY_OPERATOR_VALUES),
});
const mathAstBinaryNodeValidator = v.object({
  id: mathAstNodeIdValidator,
  kind: v.literal("binary"),
  left: mathAstNodeIdValidator,
  operator: literals(...MATH_AST_BINARY_OPERATOR_VALUES),
  right: mathAstNodeIdValidator,
});

const mathAstValidator = v.object({
  canonical: v.string(),
  latex: v.string(),
  nodes: v.array(
    v.union(
      mathAstLiteralNodeValidator,
      mathAstVariableNodeValidator,
      mathAstUnaryNodeValidator,
      mathAstBinaryNodeValidator
    )
  ),
  root: mathAstNodeIdValidator,
});

const functionDomainValidator = v.object({
  closedMax: v.boolean(),
  closedMin: v.boolean(),
  max: exactScalarValidator,
  min: exactScalarValidator,
  variable: literals(...MATH_VARIABLE_NAME_VALUES),
});

const canonicalFunctionSpecValidator = v.object({
  ast: mathAstValidator,
  domain: v.array(functionDomainValidator),
  exclusions: v.optional(v.array(mathAstValidator)),
  verifiedBy: v.optional(v.string()),
});

const canonicalVectorFunctionSpecValidator = v.object({
  domain: v.array(functionDomainValidator),
  x: mathAstValidator,
  y: mathAstValidator,
  z: mathAstValidator,
});

const commonPrimitiveFields = {
  id: v.string(),
  label: v.optional(v.string()),
};

const coordinatePrimitiveValidator = v.union(
  v.object({
    ...commonPrimitiveFields,
    kind: v.literal("point"),
    point: exactPoint3Validator,
  }),
  v.object({
    ...commonPrimitiveFields,
    kind: v.literal("vector"),
    tail: v.optional(exactPoint3Validator),
    vector: exactPoint3Validator,
  }),
  v.object({
    ...commonPrimitiveFields,
    end: exactPoint3Validator,
    kind: v.literal("segment"),
    start: exactPoint3Validator,
  }),
  v.object({
    ...commonPrimitiveFields,
    direction: exactPoint3Validator,
    kind: v.literal("ray"),
    origin: exactPoint3Validator,
  }),
  v.object({
    ...commonPrimitiveFields,
    direction: exactPoint3Validator,
    kind: v.literal("line"),
    point: exactPoint3Validator,
  }),
  v.object({
    ...commonPrimitiveFields,
    equation: canonicalFunctionSpecValidator,
    kind: v.literal("plane"),
    normal: exactPoint3Validator,
    point: exactPoint3Validator,
  }),
  v.object({
    ...commonPrimitiveFields,
    kind: v.literal("polygon"),
    vertices: v.array(exactPoint3Validator),
  }),
  v.object({
    ...commonPrimitiveFields,
    kind: v.literal("cuboid"),
    max: exactPoint3Validator,
    min: exactPoint3Validator,
  }),
  v.object({
    ...commonPrimitiveFields,
    center: exactPoint3Validator,
    kind: v.literal("sphere"),
    radius: exactScalarValidator,
  }),
  v.object({
    ...commonPrimitiveFields,
    function: canonicalVectorFunctionSpecValidator,
    kind: v.literal("parametric-curve"),
  }),
  v.object({
    ...commonPrimitiveFields,
    function: canonicalFunctionSpecValidator,
    kind: v.literal("function-surface"),
    outputAxis: literals(...COORDINATE_AXIS_VALUES),
  }),
  v.object({
    ...commonPrimitiveFields,
    function: canonicalVectorFunctionSpecValidator,
    kind: v.literal("parametric-surface"),
  })
);

/** Full coordinate-system render payload persisted outside chat transcripts. */
export const coordinateSystemPayloadValidator = v.object({
  axes: v.object({
    x: v.array(exactScalarValidator),
    y: v.array(exactScalarValidator),
    z: v.array(exactScalarValidator),
  }),
  primitives: v.array(coordinatePrimitiveValidator),
  sampling: v.object({
    curveSamples: v.number(),
    surfaceCells: v.number(),
  }),
});

/** Client/write-side payload shape before Effect schema decoding. */
export const learningArtifactInputValidator = v.object({
  description: v.optional(v.string()),
  id: learningArtifactIdValidator,
  kind: learningArtifactKindValidator,
  payload: coordinateSystemPayloadValidator,
  proofAnchors: v.array(v.string()),
  title: v.string(),
});

/** Retention-safe transcript manifest for a durable artifact payload. */
export const learningArtifactManifestValidator = v.object({
  artifactId: learningArtifactIdValidator,
  bounds: v.object({
    x: v.object({ max: v.string(), min: v.string() }),
    y: v.object({ max: v.string(), min: v.string() }),
    z: v.object({ max: v.string(), min: v.string() }),
  }),
  description: v.optional(v.string()),
  kind: learningArtifactKindValidator,
  payloadBytes: v.number(),
  primitiveCount: v.number(),
  schemaVersion: learningArtifactSchemaVersionValidator,
  title: v.string(),
});

/** Artifact write request paired to the message part order it materializes. */
export const learningArtifactWriteValidator = v.object({
  artifact: learningArtifactInputValidator,
  partOrder: v.number(),
});

/** Convex table row for full learning artifact payload persistence. */
export const learningArtifactRowValidator = v.object({
  artifactId: learningArtifactIdValidator,
  chatId: v.id("chats"),
  description: v.optional(v.string()),
  kind: learningArtifactKindValidator,
  messageId: v.id("messages"),
  partOrder: v.number(),
  payload: coordinateSystemPayloadValidator,
  payloadBytes: v.number(),
  primitiveCount: v.number(),
  proofAnchors: v.array(v.string()),
  schemaVersion: learningArtifactSchemaVersionValidator,
  title: v.string(),
});

/** Full payload returned only after chat visibility authorization succeeds. */
export const visibleLearningArtifactValidator = v.object({
  artifactId: learningArtifactIdValidator,
  description: v.optional(v.string()),
  kind: learningArtifactKindValidator,
  payload: coordinateSystemPayloadValidator,
  proofAnchors: v.array(v.string()),
  schemaVersion: learningArtifactSchemaVersionValidator,
  title: v.string(),
});

/** One bounded integrity issue for artifact payload/manifest drift checks. */
export const artifactIntegrityIssueValidator = v.object({
  artifactId: v.optional(learningArtifactIdValidator),
  messageId: v.optional(v.id("messages")),
  partOrder: v.optional(v.number()),
  reason: v.string(),
});

/** Paginated integrity result used by dev/prod artifact persistence proof. */
export const artifactIntegrityPageValidator = v.object({
  checked: v.number(),
  cursor: v.string(),
  isDone: v.boolean(),
  issues: v.array(artifactIntegrityIssueValidator),
});

export type LearningArtifactRow = Infer<typeof learningArtifactRowValidator>;
export type LearningArtifactWrite = Infer<
  typeof learningArtifactWriteValidator
>;
