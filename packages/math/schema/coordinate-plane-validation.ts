import type { ExactPoint3, MathAst, MathAstNode } from "@repo/math/schema/ast";
import type { CanonicalFunctionSpec } from "@repo/math/schema/coordinate-primitives";
import { readSortableExactScalar } from "@repo/math/schema/coordinate-scalars";

const PLANE_EQUATION_TOLERANCE = 1e-9;

interface AffinePlaneExpression {
  constant: number;
  x: number;
  y: number;
  z: number;
}

/**
 * Verifies that a plane's implicit equation describes the same point/normal
 * geometry renderers will use.
 */
export function findPlaneEquationConsistencyIssue(
  primitiveId: string,
  equation: CanonicalFunctionSpec,
  normal: ExactPoint3,
  point: ExactPoint3
) {
  const expression = readAffinePlaneExpression(equation.ast);
  if (!expression) {
    return `Coordinate primitive ${primitiveId} plane equation must be a linear implicit expression.`;
  }

  const expected = readExpectedPlaneExpression(normal, point);
  if (!expected) {
    return `Coordinate primitive ${primitiveId} plane geometry must use sortable numeric values.`;
  }

  if (!isSamePlaneExpression(expression, expected)) {
    return `Coordinate primitive ${primitiveId} plane equation is inconsistent with point and normal.`;
  }
}

function readExpectedPlaneExpression(normal: ExactPoint3, point: ExactPoint3) {
  const normalX = readSortableExactScalar(normal.x);
  const normalY = readSortableExactScalar(normal.y);
  const normalZ = readSortableExactScalar(normal.z);
  const pointX = readSortableExactScalar(point.x);
  const pointY = readSortableExactScalar(point.y);
  const pointZ = readSortableExactScalar(point.z);

  if (
    normalX === undefined ||
    normalY === undefined ||
    normalZ === undefined ||
    pointX === undefined ||
    pointY === undefined ||
    pointZ === undefined
  ) {
    return;
  }

  return {
    constant: -(normalX * pointX + normalY * pointY + normalZ * pointZ),
    x: normalX,
    y: normalY,
    z: normalZ,
  };
}

function readAffinePlaneExpression(ast: MathAst) {
  const nodesById = new Map<string, MathAstNode>();

  for (const node of ast.nodes) {
    nodesById.set(node.id, node);
  }

  const root = nodesById.get(ast.root);
  if (!root) {
    return;
  }

  return readNodeExpression(root, nodesById, new Set<string>());
}

function readNodeExpression(
  node: MathAstNode,
  nodesById: ReadonlyMap<string, MathAstNode>,
  visitingNodeIds: Set<string>
): AffinePlaneExpression | undefined {
  if (visitingNodeIds.has(node.id)) {
    return;
  }

  visitingNodeIds.add(node.id);
  const expression = readAcyclicNodeExpression(
    node,
    nodesById,
    visitingNodeIds
  );
  visitingNodeIds.delete(node.id);

  return expression;
}

function readAcyclicNodeExpression(
  node: MathAstNode,
  nodesById: ReadonlyMap<string, MathAstNode>,
  visitingNodeIds: Set<string>
) {
  if (node.kind === "literal") {
    const value = readSortableExactScalar(node.value);
    return value === undefined ? undefined : literal(value);
  }

  if (node.kind === "variable") {
    if (node.name === "t" || node.name === "u" || node.name === "v") {
      return;
    }

    return variable(node.name);
  }

  if (node.kind === "unary") {
    const operand = readChildExpression(
      node.operand,
      nodesById,
      visitingNodeIds
    );

    if (!operand || node.operator !== "negate") {
      return;
    }

    return scale(operand, -1);
  }

  const left = readChildExpression(node.left, nodesById, visitingNodeIds);
  const right = readChildExpression(node.right, nodesById, visitingNodeIds);

  if (!(left && right)) {
    return;
  }

  if (node.operator === "add") {
    return add(left, right);
  }

  if (node.operator === "subtract") {
    return add(left, scale(right, -1));
  }

  if (node.operator === "multiply") {
    return multiply(left, right);
  }

  if (node.operator === "divide") {
    const divisor = readConstant(right);
    if (divisor === undefined || isCloseToZero(divisor)) {
      return;
    }

    return scale(left, 1 / divisor);
  }
}

function readChildExpression(
  nodeId: string,
  nodesById: ReadonlyMap<string, MathAstNode>,
  visitingNodeIds: Set<string>
) {
  const child = nodesById.get(nodeId);
  if (!child) {
    return;
  }

  return readNodeExpression(child, nodesById, visitingNodeIds);
}

function multiply(left: AffinePlaneExpression, right: AffinePlaneExpression) {
  const leftConstant = readConstant(left);
  if (leftConstant !== undefined) {
    return scale(right, leftConstant);
  }

  const rightConstant = readConstant(right);
  if (rightConstant !== undefined) {
    return scale(left, rightConstant);
  }
}

function isSamePlaneExpression(
  actual: AffinePlaneExpression,
  expected: AffinePlaneExpression
) {
  if (isZeroAffineExpression(actual)) {
    return false;
  }

  const scaleFactor = readScaleFactor(actual, expected);

  if (scaleFactor === undefined || isCloseToZero(scaleFactor)) {
    return false;
  }

  const pairs = [
    { actual: actual.x, expected: expected.x * scaleFactor },
    { actual: actual.y, expected: expected.y * scaleFactor },
    { actual: actual.z, expected: expected.z * scaleFactor },
    { actual: actual.constant, expected: expected.constant * scaleFactor },
  ];

  for (const pair of pairs) {
    if (!isClose(pair.actual, pair.expected)) {
      return false;
    }
  }

  return true;
}

function readScaleFactor(
  actual: AffinePlaneExpression,
  expected: AffinePlaneExpression
) {
  const pairs = [
    { actual: actual.x, expected: expected.x },
    { actual: actual.y, expected: expected.y },
    { actual: actual.z, expected: expected.z },
    { actual: actual.constant, expected: expected.constant },
  ];

  for (const pair of pairs) {
    if (!isCloseToZero(pair.expected)) {
      return pair.actual / pair.expected;
    }
  }
}

function readConstant(expression: AffinePlaneExpression) {
  if (
    isCloseToZero(expression.x) &&
    isCloseToZero(expression.y) &&
    isCloseToZero(expression.z)
  ) {
    return expression.constant;
  }
}

function isZeroAffineExpression(expression: AffinePlaneExpression) {
  return (
    isCloseToZero(expression.x) &&
    isCloseToZero(expression.y) &&
    isCloseToZero(expression.z) &&
    isCloseToZero(expression.constant)
  );
}

function add(
  left: AffinePlaneExpression,
  right: AffinePlaneExpression
): AffinePlaneExpression {
  return {
    constant: left.constant + right.constant,
    x: left.x + right.x,
    y: left.y + right.y,
    z: left.z + right.z,
  };
}

function scale(
  expression: AffinePlaneExpression,
  factor: number
): AffinePlaneExpression {
  return {
    constant: expression.constant * factor,
    x: expression.x * factor,
    y: expression.y * factor,
    z: expression.z * factor,
  };
}

function literal(value: number): AffinePlaneExpression {
  return { constant: value, x: 0, y: 0, z: 0 };
}

function variable(name: "x" | "y" | "z"): AffinePlaneExpression {
  return {
    constant: 0,
    x: name === "x" ? 1 : 0,
    y: name === "y" ? 1 : 0,
    z: name === "z" ? 1 : 0,
  };
}

function isClose(left: number, right: number) {
  return Math.abs(left - right) <= PLANE_EQUATION_TOLERANCE;
}

function isCloseToZero(value: number) {
  return isClose(value, 0);
}
