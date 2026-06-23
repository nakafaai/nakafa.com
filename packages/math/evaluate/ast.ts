import type { MathAst } from "@repo/math/schema/ast/schema";
import { readSortableExactScalar } from "@repo/math/schema/coordinate/scalar";
import { Schema } from "effect";

const MathAstEvaluationValueSchema = Schema.Struct({
  tag: Schema.Literal("value"),
  value: Schema.Number.pipe(Schema.finite()),
}).pipe(Schema.mutable);

const MathAstEvaluationIssueSchema = Schema.Struct({
  message: Schema.String,
  tag: Schema.Literal("issue"),
}).pipe(Schema.mutable);

/** Deterministic numeric evaluation result for render-time MathAst sampling. */
export const MathAstEvaluationResultSchema = Schema.Union(
  MathAstEvaluationValueSchema,
  MathAstEvaluationIssueSchema
);

export type MathAstEvaluationResult = Schema.Schema.Type<
  typeof MathAstEvaluationResultSchema
>;

/**
 * Evaluates a bounded MathAst graph into one finite number for renderer-owned
 * sampling. Failures stay typed so callers can skip invalid sample points
 * without throwing or inventing fallback geometry.
 */
export function readMathAstNumber(
  ast: MathAst,
  variables: ReadonlyMap<string, number>
): MathAstEvaluationResult {
  const nodesById = readMathAstNodesById(ast);
  const valuesById = new Map<string, MathAstEvaluationResult>();
  const expandedNodeIds = new Set<string>();
  const pendingNodeIds = [ast.root];

  while (pendingNodeIds.length > 0) {
    const nodeId = pendingNodeIds.pop();
    if (nodeId === undefined || valuesById.has(nodeId)) {
      continue;
    }

    const node = nodesById.get(nodeId);
    if (!node) {
      return issue(`MathAst node ${nodeId} is missing.`);
    }

    if (expandedNodeIds.has(nodeId)) {
      valuesById.set(nodeId, readNodeValue(node, variables, valuesById));
      continue;
    }

    expandedNodeIds.add(nodeId);
    pendingNodeIds.push(nodeId);
    for (const childId of readMathAstChildNodeIds(node)) {
      if (!valuesById.has(childId)) {
        pendingNodeIds.push(childId);
      }
    }
  }

  return readStoredValue(ast.root, valuesById);
}

/**
 * Indexes nodes once so renderer sampling is linear in the bounded graph size.
 */
function readMathAstNodesById(ast: MathAst) {
  const nodesById = new Map<string, MathAst["nodes"][number]>();

  for (const node of ast.nodes) {
    nodesById.set(node.id, node);
  }

  return nodesById;
}

/**
 * Reads graph edges without recursively walking producer-controlled inputs.
 */
function readMathAstChildNodeIds(node: MathAst["nodes"][number]) {
  if (node.kind === "unary") {
    return [node.operand];
  }

  if (node.kind === "binary") {
    return [node.left, node.right];
  }

  return [];
}

/**
 * Evaluates one node after its dependencies have been recorded.
 */
function readNodeValue(
  node: MathAst["nodes"][number],
  variables: ReadonlyMap<string, number>,
  valuesById: ReadonlyMap<string, MathAstEvaluationResult>
): MathAstEvaluationResult {
  if (node.kind === "literal") {
    const value = readSortableExactScalar(node.value);
    return value === undefined
      ? issue(`Literal ${node.id} is not a finite exact scalar.`)
      : valueResult(value);
  }

  if (node.kind === "variable") {
    const value = variables.get(node.name);
    if (value === undefined || !Number.isFinite(value)) {
      return issue(`Variable ${node.name} is missing or non-finite.`);
    }

    return valueResult(value);
  }

  if (node.kind === "unary") {
    const operand = readStoredValue(node.operand, valuesById);
    if (operand.tag === "issue") {
      return operand;
    }

    return readUnaryValue(node.operator, operand.value);
  }

  const left = readStoredValue(node.left, valuesById);
  if (left.tag === "issue") {
    return left;
  }

  const right = readStoredValue(node.right, valuesById);
  if (right.tag === "issue") {
    return right;
  }

  return readBinaryValue(node.operator, left.value, right.value);
}

/**
 * Reads a dependency result and reports malformed traversal state explicitly.
 */
function readStoredValue(
  nodeId: string,
  valuesById: ReadonlyMap<string, MathAstEvaluationResult>
) {
  return valuesById.get(nodeId) ?? issue(`Node ${nodeId} was not evaluated.`);
}

/**
 * Applies unary math with domain checks before JavaScript can produce NaN.
 */
function readUnaryValue(
  operator: Extract<MathAst["nodes"][number], { kind: "unary" }>["operator"],
  value: number
): MathAstEvaluationResult {
  if (operator === "negate") {
    return valueResult(-value);
  }

  if (operator === "abs") {
    return valueResult(Math.abs(value));
  }

  if (operator === "sqrt") {
    return value < 0
      ? issue("Square root is undefined for negative samples.")
      : finiteValueResult(Math.sqrt(value));
  }

  if (operator === "sin") {
    return finiteValueResult(Math.sin(value));
  }

  if (operator === "cos") {
    return finiteValueResult(Math.cos(value));
  }

  if (operator === "tan") {
    return finiteValueResult(Math.tan(value));
  }

  if (operator === "exp") {
    return finiteValueResult(Math.exp(value));
  }

  return value <= 0
    ? issue("Logarithm is undefined for non-positive samples.")
    : finiteValueResult(Math.log(value));
}

/**
 * Applies binary math and rejects undefined arithmetic before rendering.
 */
function readBinaryValue(
  operator: Extract<MathAst["nodes"][number], { kind: "binary" }>["operator"],
  left: number,
  right: number
): MathAstEvaluationResult {
  if (operator === "add") {
    return finiteValueResult(left + right);
  }

  if (operator === "subtract") {
    return finiteValueResult(left - right);
  }

  if (operator === "multiply") {
    return finiteValueResult(left * right);
  }

  if (operator === "divide") {
    return right === 0
      ? issue("Division by zero is undefined for this sample.")
      : finiteValueResult(left / right);
  }

  if (left === 0 && right === 0) {
    return issue("Zero to the zero power is undefined.");
  }

  return finiteValueResult(left ** right);
}

/**
 * Creates a successful finite evaluation result.
 */
function valueResult(value: number): MathAstEvaluationResult {
  return { tag: "value", value };
}

/**
 * Rejects NaN and infinities produced by JavaScript math operations.
 */
function finiteValueResult(value: number): MathAstEvaluationResult {
  return Number.isFinite(value)
    ? valueResult(value)
    : issue("MathAst evaluation produced a non-finite value.");
}

/**
 * Creates a typed evaluation issue for renderer-owned sample skipping.
 */
function issue(message: string): MathAstEvaluationResult {
  return { message, tag: "issue" };
}
