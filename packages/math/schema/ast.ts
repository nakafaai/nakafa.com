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

/** Maximum stable node id length accepted for one MathAst node. */
export const MAX_MATH_AST_NODE_ID_LENGTH = 180;

/** Stable node reference used by flat MathAst graphs. */
export const MathAstNodeIdSchema = Schema.NonEmptyString.pipe(
  Schema.pattern(/\S/),
  Schema.maxLength(MAX_MATH_AST_NODE_ID_LENGTH)
).annotations({
  description: "Bounded nonblank node identifier inside a MathAst graph.",
});

export type MathAstNodeId = Schema.Schema.Type<typeof MathAstNodeIdSchema>;

const FiniteDecimalHint = Schema.Number.pipe(Schema.finite()).annotations({
  description: "Finite decimal display hint for an exact scalar.",
});

const ExactScalarExpression = Schema.NonEmptyString.pipe(
  Schema.pattern(/\S/)
).annotations({
  description: "Nonblank CAS-owned canonical scalar expression.",
});

/** CAS-owned exact scalar with a finite optional decimal display hint. */
export class ExactScalar extends Schema.Class<ExactScalar>("ExactScalar")({
  decimal: Schema.optional(FiniteDecimalHint),
  expression: ExactScalarExpression,
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

/** Maximum nodes accepted in one deterministic MathAst graph. */
export const MAX_MATH_AST_NODES = 256;

/** Maximum display metadata length accepted for one MathAst field. */
export const MAX_MATH_AST_DISPLAY_LENGTH = 2048;

const MathAstCanonicalSchema = Schema.NonEmptyString.pipe(
  Schema.pattern(/\S/),
  Schema.maxLength(MAX_MATH_AST_DISPLAY_LENGTH)
).annotations({
  description: "Bounded nonblank canonical display expression for a MathAst.",
});

const MathAstLatexSchema = Schema.String.pipe(
  Schema.maxLength(MAX_MATH_AST_DISPLAY_LENGTH)
).annotations({
  description: "Bounded LaTeX display expression for a MathAst.",
});

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

/** Reads the schema-owned variable names referenced by a MathAst graph. */
export function readMathAstVariableNames(ast: MathAst) {
  const variableNames = new Set<MathVariableName>();

  for (const node of ast.nodes) {
    if (node.kind === "variable") {
      variableNames.add(node.name);
    }
  }

  return variableNames;
}

interface MathAstEdge {
  children: MathAstEdge[];
  node: MathAstNode;
}

function findMathAstGraphIssue(ast: MathAst) {
  const edges: MathAstEdge[] = [];
  const edgesByNodeId = new Map<string, MathAstEdge>();

  for (const node of ast.nodes) {
    if (edgesByNodeId.has(node.id)) {
      return `Duplicate MathAst node id: ${node.id}.`;
    }

    const edge = { children: [], node };
    edges.push(edge);
    edgesByNodeId.set(node.id, edge);
  }

  const rootEdge = edgesByNodeId.get(ast.root);
  if (!rootEdge) {
    return `MathAst root node was not found: ${ast.root}.`;
  }

  for (const edge of edges) {
    for (const ref of readMathAstChildRefs(edge.node)) {
      const childEdge = edgesByNodeId.get(ref.id);
      if (!childEdge) {
        return `MathAst ${edge.node.kind} node ${edge.node.id} references missing ${ref.role} ${ref.id}.`;
      }
      edge.children.push(childEdge);
    }
  }

  return findReachabilityIssue(rootEdge, edges);
}

function findReachabilityIssue(
  rootEdge: MathAstEdge,
  edges: readonly MathAstEdge[]
) {
  const reachableNodeIds = new Set<string>();
  const visitingNodeIds = new Set<string>();
  const stack = [{ edge: rootEdge, exiting: false }];

  for (let frame = stack.pop(); frame !== undefined; frame = stack.pop()) {
    const nodeId = frame.edge.node.id;

    if (frame.exiting) {
      visitingNodeIds.delete(nodeId);
      reachableNodeIds.add(nodeId);
      continue;
    }

    if (reachableNodeIds.has(nodeId)) {
      continue;
    }

    if (visitingNodeIds.has(nodeId)) {
      return `MathAst graph contains a cycle at node ${nodeId}.`;
    }

    visitingNodeIds.add(nodeId);
    stack.push({ edge: frame.edge, exiting: true });

    for (const childEdge of frame.edge.children) {
      stack.push({ edge: childEdge, exiting: false });
    }
  }

  for (const edge of edges) {
    if (!reachableNodeIds.has(edge.node.id)) {
      return `MathAst node is unreachable from root: ${edge.node.id}.`;
    }
  }
}

function readMathAstChildRefs(node: MathAstNode) {
  if (node.kind === "unary") {
    return [{ id: node.operand, role: "operand" }];
  }

  if (node.kind === "binary") {
    return [
      { id: node.left, role: "left operand" },
      { id: node.right, role: "right operand" },
    ];
  }

  return [];
}
