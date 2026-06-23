import type { ExactPoint3, MathAst, MathAstNode } from "@repo/math/schema/ast";
import {
  type AffinePlaneExpression,
  addAffinePlaneExpressions,
  isSamePlaneExpression,
  literalAffinePlaneExpression,
  readConstantAffinePlaneExpression,
  readExpectedPlaneExpression,
  scaleAffinePlaneExpression,
  variableAffinePlaneExpression,
} from "@repo/math/schema/coordinate-plane-expression";
import type { CanonicalFunctionSpec } from "@repo/math/schema/coordinate-primitives";
import { readSortableExactScalar } from "@repo/math/schema/coordinate-scalars";

interface AffinePlaneReadContext {
  expressionsByNodeId: Map<string, AffinePlaneExpression | undefined>;
  nodesById: ReadonlyMap<string, MathAstNode>;
  visitingNodeIds: Set<string>;
}

/** Verifies a plane implicit equation against renderer point/normal geometry. */
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

function readAffinePlaneExpression(ast: MathAst) {
  const nodesById = new Map<string, MathAstNode>();

  for (const node of ast.nodes) {
    nodesById.set(node.id, node);
  }

  const root = nodesById.get(ast.root);
  if (!root) {
    return;
  }

  return readNodeExpression(root, {
    expressionsByNodeId: new Map<string, AffinePlaneExpression | undefined>(),
    nodesById,
    visitingNodeIds: new Set<string>(),
  });
}

function readNodeExpression(
  node: MathAstNode,
  context: AffinePlaneReadContext
): AffinePlaneExpression | undefined {
  if (context.visitingNodeIds.has(node.id)) {
    return;
  }

  if (context.expressionsByNodeId.has(node.id)) {
    return context.expressionsByNodeId.get(node.id);
  }

  context.visitingNodeIds.add(node.id);
  const expression = readAcyclicNodeExpression(node, context);
  context.visitingNodeIds.delete(node.id);
  context.expressionsByNodeId.set(node.id, expression);

  return expression;
}

function readAcyclicNodeExpression(
  node: MathAstNode,
  context: AffinePlaneReadContext
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
    const operand = readChildExpression(node.operand, context);

    if (!operand || node.operator !== "negate") {
      return;
    }

    return scaleAffinePlaneExpression(operand, -1);
  }

  const left = readChildExpression(node.left, context);
  const right = readChildExpression(node.right, context);

  if (!(left && right)) {
    return;
  }

  if (node.operator === "add") {
    return addAffinePlaneExpressions(left, right);
  }

  if (node.operator === "subtract") {
    return addAffinePlaneExpressions(
      left,
      scaleAffinePlaneExpression(right, -1)
    );
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

function readChildExpression(nodeId: string, context: AffinePlaneReadContext) {
  const child = context.nodesById.get(nodeId);
  if (!child) {
    return;
  }

  return readNodeExpression(child, context);
}

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
