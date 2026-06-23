import { Effect, Schema } from "effect";

function literalValues<const Values extends readonly [string, ...string[]]>(
  ...values: Values
) {
  return values;
}

export const MATH_VARIABLE_NAME_VALUES = literalValues(
  "x",
  "y",
  "z",
  "t",
  "u",
  "v"
);

/** Schema-owned variable names supported by durable mathematical artifacts. */
export const MathVariableNameSchema = Schema.Literal(
  ...MATH_VARIABLE_NAME_VALUES
);

export type MathVariableName = Schema.Schema.Type<
  typeof MathVariableNameSchema
>;

export const MATH_AST_UNARY_OPERATOR_VALUES = literalValues(
  "negate",
  "abs",
  "sqrt",
  "sin",
  "cos",
  "tan",
  "exp",
  "log"
);

/** Schema-owned unary operators accepted by the deterministic MathAst kernel. */
export const MathAstUnaryOperatorSchema = Schema.Literal(
  ...MATH_AST_UNARY_OPERATOR_VALUES
);

export const MATH_AST_BINARY_OPERATOR_VALUES = literalValues(
  "add",
  "subtract",
  "multiply",
  "divide",
  "power"
);

/** Schema-owned binary operators accepted by the deterministic MathAst kernel. */
export const MathAstBinaryOperatorSchema = Schema.Literal(
  ...MATH_AST_BINARY_OPERATOR_VALUES
);

/** Stable node reference used by flat MathAst graphs. */
export const MathAstNodeIdSchema = Schema.NonEmptyString.annotations({
  description: "Stable node identifier inside a MathAst graph.",
});

export type MathAstNodeId = Schema.Schema.Type<typeof MathAstNodeIdSchema>;

/**
 * Exact scalar value with deterministic display metadata.
 *
 * The expression is the CAS-owned canonical value. The decimal field is only
 * a display hint and must not replace exact evaluation.
 */
export class ExactScalar extends Schema.Class<ExactScalar>("ExactScalar")({
  decimal: Schema.optional(Schema.Number),
  expression: Schema.NonEmptyString,
  latex: Schema.String,
}) {}

/** Exact three-dimensional point used by coordinate learning artifacts. */
export class ExactPoint3 extends Schema.Class<ExactPoint3>("ExactPoint3")({
  x: ExactScalar,
  y: ExactScalar,
  z: ExactScalar,
}) {}

const MathAstLiteralNodeSchema = Schema.Struct({
  id: MathAstNodeIdSchema,
  kind: Schema.Literal("literal"),
  value: ExactScalar,
}).pipe(Schema.mutable);

const MathAstVariableNodeSchema = Schema.Struct({
  id: MathAstNodeIdSchema,
  kind: Schema.Literal("variable"),
  name: MathVariableNameSchema,
}).pipe(Schema.mutable);

const MathAstUnaryNodeSchema = Schema.Struct({
  id: MathAstNodeIdSchema,
  kind: Schema.Literal("unary"),
  operand: MathAstNodeIdSchema,
  operator: MathAstUnaryOperatorSchema,
}).pipe(Schema.mutable);

const MathAstBinaryNodeSchema = Schema.Struct({
  id: MathAstNodeIdSchema,
  kind: Schema.Literal("binary"),
  left: MathAstNodeIdSchema,
  operator: MathAstBinaryOperatorSchema,
  right: MathAstNodeIdSchema,
}).pipe(Schema.mutable);

/** One node in the flat, CAS-owned mathematical expression graph. */
export const MathAstNodeSchema = Schema.Union(
  MathAstLiteralNodeSchema,
  MathAstVariableNodeSchema,
  MathAstUnaryNodeSchema,
  MathAstBinaryNodeSchema
).annotations({
  description:
    "Flat mathematical expression node with references to other node ids.",
});

export type MathAstNode = Schema.Schema.Type<typeof MathAstNodeSchema>;

/**
 * Durable mathematical expression graph for reproducible evaluation.
 *
 * This is intentionally a flat graph instead of model-authored text or nested
 * JSON so future deterministic evaluators can verify root reachability and
 * node references before rendering.
 */
export class MathAst extends Schema.Class<MathAst>("MathAst")({
  canonical: Schema.NonEmptyString,
  latex: Schema.String,
  nodes: Schema.Array(MathAstNodeSchema).pipe(
    Schema.minItems(1),
    Schema.mutable
  ),
  root: MathAstNodeIdSchema,
}) {}

/** Expected failure raised when a MathAst fails schema or graph validation. */
export class MathAstDecodeError extends Schema.TaggedError<MathAstDecodeError>()(
  "MathAstDecodeError",
  {
    message: Schema.String,
  }
) {}

/** Decodes a MathAst and verifies graph references before it reaches runtime. */
export const decodeMathAst = Effect.fn("math.ast.decode")(function* (
  input: unknown
) {
  const ast = yield* Schema.decodeUnknown(MathAst)(input).pipe(
    Effect.mapError(
      () =>
        new MathAstDecodeError({
          message: "Invalid MathAst contract.",
        })
    )
  );

  const issue = findMathAstGraphIssue(ast);
  if (issue) {
    return yield* Effect.fail(new MathAstDecodeError({ message: issue }));
  }

  return ast;
});

function findMathAstGraphIssue(ast: MathAst) {
  const nodeIds = new Set<string>();

  for (const node of ast.nodes) {
    if (nodeIds.has(node.id)) {
      return `Duplicate MathAst node id: ${node.id}.`;
    }
    nodeIds.add(node.id);
  }

  if (!nodeIds.has(ast.root)) {
    return `MathAst root node was not found: ${ast.root}.`;
  }

  for (const node of ast.nodes) {
    if (node.kind === "literal") {
      continue;
    }

    if (node.kind === "variable") {
      continue;
    }

    if (node.kind === "unary") {
      if (!nodeIds.has(node.operand)) {
        return `MathAst unary node ${node.id} references missing operand ${node.operand}.`;
      }
      continue;
    }

    if (!nodeIds.has(node.left)) {
      return `MathAst binary node ${node.id} references missing left operand ${node.left}.`;
    }

    if (!nodeIds.has(node.right)) {
      return `MathAst binary node ${node.id} references missing right operand ${node.right}.`;
    }
  }
}
