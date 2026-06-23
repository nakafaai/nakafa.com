import type { MathAstNode } from "@repo/math/schema/ast";
import { readSortableExactScalar } from "@repo/math/schema/coordinate-scalars";

/** Finite constant value derived from a MathAst subtree. */
export interface ConstantMathAstValue {
  isExactZero: boolean;
  value: number;
}

/** Reads a finite deterministic constant from a MathAst subtree when possible. */
export function readConstantMathAstValue(
  node: MathAstNode,
  nodesById: ReadonlyMap<string, MathAstNode>,
  constantValuesByNodeId = new Map<string, ConstantMathAstValue | undefined>(),
  visitingNodeIds = new Set<string>()
): ConstantMathAstValue | undefined {
  if (constantValuesByNodeId.has(node.id)) {
    return constantValuesByNodeId.get(node.id);
  }

  if (visitingNodeIds.has(node.id)) {
    return;
  }

  visitingNodeIds.add(node.id);
  const value = readAcyclicConstantMathAstValue(
    node,
    nodesById,
    constantValuesByNodeId,
    visitingNodeIds
  );
  visitingNodeIds.delete(node.id);
  constantValuesByNodeId.set(node.id, value);

  return value;
}

function readAcyclicConstantMathAstValue(
  node: MathAstNode,
  nodesById: ReadonlyMap<string, MathAstNode>,
  constantValuesByNodeId: Map<string, ConstantMathAstValue | undefined>,
  visitingNodeIds: Set<string>
): ConstantMathAstValue | undefined {
  if (node.kind === "literal") {
    const value = readSortableExactScalar(node.value);
    return value === undefined ? undefined : constantMathAstValue(value);
  }

  if (node.kind === "variable") {
    return;
  }

  if (node.kind === "unary") {
    const operand = readChildConstantMathAstValue(
      node.operand,
      nodesById,
      constantValuesByNodeId,
      visitingNodeIds
    );

    return operand ? readUnaryConstantValue(node.operator, operand) : undefined;
  }

  const left = readChildConstantMathAstValue(
    node.left,
    nodesById,
    constantValuesByNodeId,
    visitingNodeIds
  );
  const right = readChildConstantMathAstValue(
    node.right,
    nodesById,
    constantValuesByNodeId,
    visitingNodeIds
  );

  if (!(left && right)) {
    return;
  }

  return readBinaryConstantValue(node.operator, left, right);
}

function readChildConstantMathAstValue(
  nodeId: string,
  nodesById: ReadonlyMap<string, MathAstNode>,
  constantValuesByNodeId: Map<string, ConstantMathAstValue | undefined>,
  visitingNodeIds: Set<string>
) {
  const child = nodesById.get(nodeId);
  if (!child) {
    return;
  }

  return readConstantMathAstValue(
    child,
    nodesById,
    constantValuesByNodeId,
    visitingNodeIds
  );
}

function readUnaryConstantValue(
  operator: Extract<MathAstNode, { kind: "unary" }>["operator"],
  operand: ConstantMathAstValue
) {
  if (operator === "negate") {
    return constantMathAstValue(-operand.value);
  }

  if (operator === "abs") {
    return constantMathAstValue(Math.abs(operand.value));
  }

  if (operator === "sqrt") {
    return operand.value < 0
      ? undefined
      : finiteComputedConstantValue(Math.sqrt(operand.value));
  }

  if (operator === "sin") {
    return operand.isExactZero
      ? constantMathAstValue(0)
      : finiteComputedConstantValue(Math.sin(operand.value));
  }

  if (operator === "tan") {
    return operand.isExactZero
      ? constantMathAstValue(0)
      : finiteComputedConstantValue(Math.tan(operand.value));
  }

  if (operator === "cos") {
    return finiteComputedConstantValue(Math.cos(operand.value));
  }

  if (operator === "exp") {
    return finiteComputedConstantValue(Math.exp(operand.value));
  }

  return operand.value <= 0
    ? undefined
    : finiteComputedConstantValue(Math.log(operand.value));
}

function readBinaryConstantValue(
  operator: Extract<MathAstNode, { kind: "binary" }>["operator"],
  left: ConstantMathAstValue,
  right: ConstantMathAstValue
) {
  if (operator === "add") {
    return finiteComputedConstantValue(left.value + right.value);
  }

  if (operator === "subtract") {
    return finiteComputedConstantValue(left.value - right.value);
  }

  if (operator === "multiply") {
    if (left.isExactZero || right.isExactZero) {
      return constantMathAstValue(0);
    }

    return finiteComputedConstantValue(left.value * right.value);
  }

  if (operator === "divide") {
    if (right.isExactZero) {
      return;
    }

    if (left.isExactZero) {
      return constantMathAstValue(0);
    }

    return finiteComputedConstantValue(left.value / right.value);
  }

  if (left.isExactZero && right.value > 0) {
    return constantMathAstValue(0);
  }

  return finiteComputedConstantValue(left.value ** right.value);
}

function constantMathAstValue(value: number): ConstantMathAstValue {
  return { isExactZero: value === 0, value };
}

function finiteComputedConstantValue(
  value: number
): ConstantMathAstValue | undefined {
  if (!Number.isFinite(value)) {
    return;
  }

  return constantMathAstValue(value);
}
