import type {
  ExactPoint3,
  MathAst,
  MathAstNode,
} from "@repo/math/schema/ast/schema";
import {
  type AffinePlaneExpression,
  addAffinePlaneExpressions,
  isSamePlaneExpression,
  literalAffinePlaneExpression,
  readConstantAffinePlaneExpression,
  readExpectedPlaneExpression,
  scaleAffinePlaneExpression,
  variableAffinePlaneExpression,
} from "@repo/math/schema/coordinate/equation";
import type { CanonicalFunctionSpec } from "@repo/math/schema/coordinate/primitive";
import { readSortableExactScalar } from "@repo/math/schema/coordinate/scalar";

/**
 * Verifies a plane implicit equation against renderer point/normal geometry.
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

/**
 * Reads one affine expression from a MathAst without recursive stack growth.
 */
function readAffinePlaneExpression(ast: MathAst) {
  const nodesById = new Map<string, MathAstNode>();

  for (const node of ast.nodes) {
    nodesById.set(node.id, node);
  }

  const root = nodesById.get(ast.root);
  if (!root) {
    return;
  }

  return readNodeExpression(
    root,
    nodesById,
    new Map<string, AffinePlaneExpression | undefined>(),
    new Set<string>()
  );
}

/**
 * Reads one node with memoized affine-expression state.
 */
function readNodeExpression(
  node: MathAstNode,
  nodesById: ReadonlyMap<string, MathAstNode>,
  expressionsByNodeId: Map<string, AffinePlaneExpression | undefined>,
  visitingNodeIds: Set<string>
): AffinePlaneExpression | undefined {
  if (visitingNodeIds.has(node.id)) {
    return;
  }

  if (expressionsByNodeId.has(node.id)) {
    return expressionsByNodeId.get(node.id);
  }

  visitingNodeIds.add(node.id);
  const expression = readAcyclicNodeExpression(
    node,
    nodesById,
    expressionsByNodeId,
    visitingNodeIds
  );
  visitingNodeIds.delete(node.id);
  expressionsByNodeId.set(node.id, expression);

  return expression;
}

/**
 * Evaluates one acyclic MathAst node as an affine plane expression.
 */
function readAcyclicNodeExpression(
  node: MathAstNode,
  nodesById: ReadonlyMap<string, MathAstNode>,
  expressionsByNodeId: Map<string, AffinePlaneExpression | undefined>,
  visitingNodeIds: Set<string>
) {
  if (node.kind === "literal") {
    const value = readSortableExactScalar(node.value);
    return value === undefined
      ? undefined
      : literalAffinePlaneExpression(value);
  }

  if (node.kind === "variable") {
    if (node.name === "t" || node.name === "u" || node.name === "v") {
      return;
    }

    return variableAffinePlaneExpression(node.name);
  }

  if (node.kind === "unary") {
    const operand = readChildExpression(
      node.operand,
      nodesById,
      expressionsByNodeId,
      visitingNodeIds
    );

    if (!operand || node.operator !== "negate") {
      return;
    }

    return scaleAffinePlaneExpression(operand, -1);
  }

  const left = readChildExpression(
    node.left,
    nodesById,
    expressionsByNodeId,
    visitingNodeIds
  );
  const right = readChildExpression(
    node.right,
    nodesById,
    expressionsByNodeId,
    visitingNodeIds
  );

  if (!(left && right)) {
    return;
  }

  if (node.operator === "add") {
    return addAffinePlaneExpressions(left, right);
  }

  if (node.operator === "subtract") {
    return addAffinePlaneExpressions(left, {
      constant: -right.constant,
      x: -right.x,
      y: -right.y,
      z: -right.z,
    });
  }

  if (node.operator === "multiply") {
    return multiply(left, right);
  }

  if (node.operator === "divide") {
    const divisor = readConstantAffinePlaneExpression(right);
    if (divisor === undefined || divisor === 0) {
      return;
    }

    return scaleAffinePlaneExpression(left, 1 / divisor);
  }
}

/**
 * Reads a referenced child expression when the child node exists.
 */
function readChildExpression(
  nodeId: string,
  nodesById: ReadonlyMap<string, MathAstNode>,
  expressionsByNodeId: Map<string, AffinePlaneExpression | undefined>,
  visitingNodeIds: Set<string>
) {
  const child = nodesById.get(nodeId);
  if (!child) {
    return;
  }

  return readNodeExpression(
    child,
    nodesById,
    expressionsByNodeId,
    visitingNodeIds
  );
}

/**
 * Multiplies affine expressions only when one side is constant.
 */
function multiply(left: AffinePlaneExpression, right: AffinePlaneExpression) {
  const leftConstant = readConstantAffinePlaneExpression(left);
  if (leftConstant !== undefined) {
    return scaleAffinePlaneExpression(right, leftConstant);
  }

  const rightConstant = readConstantAffinePlaneExpression(right);
  if (rightConstant !== undefined) {
    return scaleAffinePlaneExpression(left, rightConstant);
  }
}
