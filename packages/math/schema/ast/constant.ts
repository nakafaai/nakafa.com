import { readBinaryConstantValue } from "@repo/math/schema/ast/binary";
import { readUnaryConstantValue } from "@repo/math/schema/ast/operation";
import {
  hasSyntacticPiToken,
  readSyntacticPiMultiple,
} from "@repo/math/schema/ast/pi";
import { hasMultipleSyntacticPiTokens } from "@repo/math/schema/ast/power";
import type { MathAstNode } from "@repo/math/schema/ast/schema";
import {
  constantMathAst,
  INVALID_CONSTANT_MATH_AST,
} from "@repo/math/schema/ast/value";
import { readSortableExactScalar } from "@repo/math/schema/coordinate/scalar";
import { Schema } from "effect";

/** Schema-owned finite constant value derived from a MathAst subtree. */
export const ConstantMathAstValueSchema = Schema.Struct({
  isExactZero: Schema.Boolean,
  piMultiple: Schema.optional(Schema.Number),
  piSquareMultiple: Schema.optional(Schema.Number),
  value: Schema.Number.pipe(Schema.finite()),
});

export type ConstantMathAstValue = Schema.Schema.Type<
  typeof ConstantMathAstValueSchema
>;

/** Schema-owned result of reading deterministic constant semantics. */
export const ConstantMathAstReadSchema = Schema.Union(
  Schema.Struct({
    tag: Schema.Literal("Constant"),
    value: ConstantMathAstValueSchema,
  }),
  Schema.Struct({ tag: Schema.Literal("InvalidConstant") }),
  Schema.Struct({ tag: Schema.Literal("Nonconstant") })
);

export type ConstantMathAstRead = Schema.Schema.Type<
  typeof ConstantMathAstReadSchema
>;

const NONCONSTANT_MATH_AST: ConstantMathAstRead = { tag: "Nonconstant" };

/** Reads deterministic constant semantics from a MathAst subtree when possible.
 */
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
    return NONCONSTANT_MATH_AST;
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

/** Reads one node after the caller has marked it visiting for cycle safety.
 */
function readAcyclicConstantMathAstValue(
  node: MathAstNode,
  nodesById: ReadonlyMap<string, MathAstNode>,
  constantValuesByNodeId: Map<string, ConstantMathAstRead>,
  visitingNodeIds: Set<string>
): ConstantMathAstRead {
  if (node.kind === "literal") {
    const hasPiToken = hasSyntacticPiToken(node.value.expression);
    const value = readSortableExactScalar(node.value);
    if (hasMultipleSyntacticPiTokens(node.value.expression)) {
      return INVALID_CONSTANT_MATH_AST;
    }

    if (hasPiToken) {
      const piMultiple = readSyntacticPiMultiple(
        node.value.expression,
        value ?? Number.NaN
      );
      if (piMultiple === undefined) {
        return INVALID_CONSTANT_MATH_AST;
      }

      const piValue = piMultiple * Math.PI;
      if (!Number.isFinite(piValue) || (piMultiple !== 0 && piValue === 0)) {
        return INVALID_CONSTANT_MATH_AST;
      }

      return constantMathAst(piValue, piMultiple);
    }

    return value === undefined
      ? INVALID_CONSTANT_MATH_AST
      : constantMathAst(value);
  }

  if (node.kind === "variable") {
    return NONCONSTANT_MATH_AST;
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
    return INVALID_CONSTANT_MATH_AST;
  }

  if (left.tag === "Nonconstant" || right.tag === "Nonconstant") {
    return NONCONSTANT_MATH_AST;
  }

  return readBinaryConstantValue(node.operator, left.value, right.value);
}

/** Reads a child node through the memoized constant traversal.
 */
function readChildConstantMathAstValue(
  nodeId: string,
  nodesById: ReadonlyMap<string, MathAstNode>,
  constantValuesByNodeId: Map<string, ConstantMathAstRead>,
  visitingNodeIds: Set<string>
) {
  const child = nodesById.get(nodeId);
  if (!child) {
    return NONCONSTANT_MATH_AST;
  }

  return readConstantMathAst(
    child,
    nodesById,
    constantValuesByNodeId,
    visitingNodeIds
  );
}
