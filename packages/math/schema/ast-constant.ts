import type { MathAstNode } from "@repo/math/schema/ast";
import {
  isSyntacticHalfIntegerPiMultiple,
  isSyntacticIntegerPiMultiple,
  readAbsolutePiMultiple,
  readCombinedPiMultiple,
  readNegatedPiMultiple,
  readProductPiMultiple,
  readQuotientPiMultiple,
  readSyntacticPiMultiple,
} from "@repo/math/schema/ast-pi-multiple";
import { readSortableExactScalar } from "@repo/math/schema/coordinate-scalars";

/** Finite constant value derived from a MathAst subtree. */
export interface ConstantMathAstValue {
  isExactZero: boolean;
  piMultiple?: number;
  value: number;
}

/** Result of reading deterministic constant semantics from a MathAst subtree. */
export type ConstantMathAstRead =
  | {
      tag: "Constant";
      value: ConstantMathAstValue;
    }
  | {
      tag: "InvalidConstant";
    }
  | {
      tag: "Nonconstant";
    };

/** Reads deterministic constant semantics from a MathAst subtree when possible. */
export function readConstantMathAst(
  node: MathAstNode,
  nodesById: ReadonlyMap<string, MathAstNode>,
  constantValuesByNodeId = new Map<string, ConstantMathAstRead>(),
  visitingNodeIds = new Set<string>()
): ConstantMathAstRead {
  const cachedValue = constantValuesByNodeId.get(node.id);
  if (cachedValue) {
    return cachedValue;
  }

  if (visitingNodeIds.has(node.id)) {
    return nonconstantMathAst();
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
  constantValuesByNodeId: Map<string, ConstantMathAstRead>,
  visitingNodeIds: Set<string>
): ConstantMathAstRead {
  if (node.kind === "literal") {
    const value = readSortableExactScalar(node.value);
    return value === undefined
      ? invalidConstantMathAst()
      : constantMathAst(
          value,
          readSyntacticPiMultiple(node.value.expression, value)
        );
  }

  if (node.kind === "variable") {
    return nonconstantMathAst();
  }

  if (node.kind === "unary") {
    const operand = readChildConstantMathAstValue(
      node.operand,
      nodesById,
      constantValuesByNodeId,
      visitingNodeIds
    );

    if (operand.tag !== "Constant") {
      return operand;
    }

    return readUnaryConstantValue(node.operator, operand.value);
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

  if (left.tag === "InvalidConstant" || right.tag === "InvalidConstant") {
    return invalidConstantMathAst();
  }

  if (left.tag === "Nonconstant" || right.tag === "Nonconstant") {
    return nonconstantMathAst();
  }

  return readBinaryConstantValue(node.operator, left.value, right.value);
}

function readChildConstantMathAstValue(
  nodeId: string,
  nodesById: ReadonlyMap<string, MathAstNode>,
  constantValuesByNodeId: Map<string, ConstantMathAstRead>,
  visitingNodeIds: Set<string>
) {
  const child = nodesById.get(nodeId);
  if (!child) {
    return nonconstantMathAst();
  }

  return readConstantMathAst(
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
    return constantMathAst(
      -operand.value,
      readNegatedPiMultiple(operand.piMultiple)
    );
  }

  if (operator === "abs") {
    return constantMathAst(
      Math.abs(operand.value),
      readAbsolutePiMultiple(operand.piMultiple)
    );
  }

  if (operator === "sqrt") {
    return operand.value < 0
      ? invalidConstantMathAst()
      : finiteComputedConstantValue(Math.sqrt(operand.value));
  }

  if (operator === "sin") {
    return isSyntacticIntegerPiMultiple(operand.piMultiple)
      ? constantMathAst(0)
      : finiteComputedConstantValue(Math.sin(operand.value));
  }

  if (operator === "tan") {
    if (isSyntacticHalfIntegerPiMultiple(operand.piMultiple)) {
      return invalidConstantMathAst();
    }

    return isSyntacticIntegerPiMultiple(operand.piMultiple)
      ? constantMathAst(0)
      : finiteComputedConstantValue(Math.tan(operand.value));
  }

  if (operator === "cos") {
    return isSyntacticHalfIntegerPiMultiple(operand.piMultiple)
      ? constantMathAst(0)
      : finiteComputedConstantValue(Math.cos(operand.value));
  }

  if (operator === "exp") {
    return finiteComputedConstantValue(Math.exp(operand.value));
  }

  return operand.value <= 0
    ? invalidConstantMathAst()
    : finiteComputedConstantValue(Math.log(operand.value));
}

function readBinaryConstantValue(
  operator: Extract<MathAstNode, { kind: "binary" }>["operator"],
  left: ConstantMathAstValue,
  right: ConstantMathAstValue
) {
  if (operator === "add") {
    return finiteComputedConstantValue(left.value + right.value, {
      piMultiple: readCombinedPiMultiple(
        left.piMultiple,
        right.piMultiple,
        "add"
      ),
    });
  }

  if (operator === "subtract") {
    return finiteComputedConstantValue(left.value - right.value, {
      piMultiple: readCombinedPiMultiple(
        left.piMultiple,
        right.piMultiple,
        "subtract"
      ),
    });
  }

  if (operator === "multiply") {
    if (left.isExactZero || right.isExactZero) {
      return constantMathAst(0);
    }

    return finiteComputedConstantValue(left.value * right.value, {
      piMultiple: readProductPiMultiple(left, right),
      rejectZero: true,
    });
  }

  if (operator === "divide") {
    if (right.isExactZero) {
      return invalidConstantMathAst();
    }

    if (left.isExactZero) {
      return constantMathAst(0);
    }

    return finiteComputedConstantValue(left.value / right.value, {
      piMultiple: readQuotientPiMultiple(left, right),
      rejectZero: true,
    });
  }

  if (left.isExactZero && right.value > 0) {
    return constantMathAst(0);
  }

  return finiteComputedConstantValue(left.value ** right.value, {
    rejectZero: true,
  });
}

function constantMathAst(
  value: number,
  piMultiple?: number
): ConstantMathAstRead {
  return {
    tag: "Constant",
    value:
      piMultiple === undefined
        ? { isExactZero: value === 0, value }
        : { isExactZero: value === 0, piMultiple, value },
  };
}

function invalidConstantMathAst(): ConstantMathAstRead {
  return { tag: "InvalidConstant" };
}

function nonconstantMathAst(): ConstantMathAstRead {
  return { tag: "Nonconstant" };
}

function finiteComputedConstantValue(
  value: number,
  options: { piMultiple?: number; rejectZero?: boolean } = {}
): ConstantMathAstRead {
  if (!Number.isFinite(value)) {
    return invalidConstantMathAst();
  }

  if (options.rejectZero && value === 0) {
    return invalidConstantMathAst();
  }

  return constantMathAst(value, options.piMultiple);
}
