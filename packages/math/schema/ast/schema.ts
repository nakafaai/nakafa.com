import { findMathAstGraphIssue } from "@repo/math/schema/ast/graph";
import { literalValues } from "@repo/utilities/literals";
import { Effect, Schema } from "effect";

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

export const MAX_MATH_AST_NODE_ID_LENGTH = 180;

/** Stable node reference used by flat MathAst graphs. */
export const MathAstNodeIdSchema = Schema.NonEmptyString.pipe(
  Schema.pattern(/\S/),
  Schema.maxLength(MAX_MATH_AST_NODE_ID_LENGTH)
).annotations({
  description: "Bounded nonblank node identifier inside a MathAst graph.",
});

export type MathAstNodeId = Schema.Schema.Type<typeof MathAstNodeIdSchema>;

const FiniteDecimalHint = Schema.Number.pipe(Schema.finite());

export const MAX_MATH_AST_DISPLAY_LENGTH = 2048;

const ExactScalarExpression = Schema.NonEmptyString.pipe(
  Schema.pattern(/\S/),
  Schema.maxLength(MAX_MATH_AST_DISPLAY_LENGTH)
).annotations({
  description: "Bounded nonblank CAS-owned canonical scalar expression.",
});

const ExactScalarLatex = Schema.String.pipe(
  Schema.maxLength(MAX_MATH_AST_DISPLAY_LENGTH)
);

/** CAS-owned exact scalar with a finite optional decimal display hint. */
export class ExactScalar extends Schema.Class<ExactScalar>("ExactScalar")({
  decimal: Schema.optional(FiniteDecimalHint),
  expression: ExactScalarExpression,
  latex: ExactScalarLatex,
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
);

export type MathAstNode = Schema.Schema.Type<typeof MathAstNodeSchema>;

export const MAX_MATH_AST_NODES = 256;

const MathAstCanonicalSchema = Schema.NonEmptyString.pipe(
  Schema.pattern(/\S/),
  Schema.maxLength(MAX_MATH_AST_DISPLAY_LENGTH)
).annotations({
  description: "Bounded nonblank canonical display expression for a MathAst.",
});

const MathAstLatexSchema = Schema.String.pipe(
  Schema.maxLength(MAX_MATH_AST_DISPLAY_LENGTH)
);

/** Flat durable graph for reproducible mathematical evaluation. */
export class MathAst extends Schema.Class<MathAst>("MathAst")({
  canonical: MathAstCanonicalSchema,
  latex: MathAstLatexSchema,
  nodes: Schema.Array(MathAstNodeSchema).pipe(
    Schema.minItems(1),
    Schema.maxItems(MAX_MATH_AST_NODES),
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

/**
 * Decodes a MathAst and verifies graph references before it reaches runtime.
 */
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

/**
 * Reads the schema-owned variable names referenced by a MathAst graph.
 */
export function readMathAstVariableNames(ast: MathAst) {
  const variableNames = new Set<MathVariableName>();

  for (const node of ast.nodes) {
    if (node.kind === "variable") {
      variableNames.add(node.name);
    }
  }

  return variableNames;
}
