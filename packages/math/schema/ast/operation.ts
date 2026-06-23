import type { ConstantMathAstValue } from "@repo/math/schema/ast/constant";
import {
  isSyntacticHalfIntegerPiMultiple,
  isSyntacticIntegerPiMultiple,
  readAbsolutePiMultiple,
  readNegatedPiMultiple,
} from "@repo/math/schema/ast/pi";
import {
  readAbsolutePiSquareMultiple,
  readNegatedPiSquareMultiple,
  readSqrtPiSquareMultiple,
} from "@repo/math/schema/ast/power";
import type { MathAstNode } from "@repo/math/schema/ast/schema";
import {
  constantMathAst,
  finiteComputedConstantValue,
  INVALID_CONSTANT_MATH_AST,
} from "@repo/math/schema/ast/value";

/**
 * Applies unary operators while preserving exact-zero and syntactic-pi facts.
 */
export function readUnaryConstantValue(
  operator: Extract<MathAstNode, { kind: "unary" }>["operator"],
  operand: ConstantMathAstValue
) {
  if (operator === "negate") {
    return constantMathAst(
      -operand.value,
      readNegatedPiMultiple(operand.piMultiple),
      readNegatedPiSquareMultiple(operand.piSquareMultiple)
    );
  }

  if (operator === "abs") {
    return constantMathAst(
      Math.abs(operand.value),
      readAbsolutePiMultiple(operand.piMultiple),
      readAbsolutePiSquareMultiple(operand.piSquareMultiple)
    );
  }

  if (operator === "sqrt") {
    if (operand.value < 0) {
      return INVALID_CONSTANT_MATH_AST;
    }

    if (operand.piSquareMultiple !== undefined) {
      const piMultiple = readSqrtPiSquareMultiple(operand);
      if (piMultiple === undefined) {
        return INVALID_CONSTANT_MATH_AST;
      }

      return finiteComputedConstantValue(Math.sqrt(operand.value), {
        piMultiple,
        rejectZero: true,
      });
    }

    return finiteComputedConstantValue(Math.sqrt(operand.value));
  }

  if (operator === "sin") {
    return isSyntacticIntegerPiMultiple(operand.piMultiple)
      ? constantMathAst(0)
      : finiteComputedConstantValue(Math.sin(operand.value));
  }

  if (operator === "tan") {
    if (isSyntacticHalfIntegerPiMultiple(operand.piMultiple)) {
      return INVALID_CONSTANT_MATH_AST;
    }

    return isSyntacticIntegerPiMultiple(operand.piMultiple)
      ? constantMathAst(0)
      : finiteComputedConstantValue(Math.tan(operand.value));
  }

  if (operator === "cos") {
    const piMultiple = operand.piMultiple;
    if (isSyntacticHalfIntegerPiMultiple(piMultiple)) {
      return constantMathAst(0);
    }

    if (piMultiple !== undefined && isSyntacticIntegerPiMultiple(piMultiple)) {
      return constantMathAst(readIntegerPiCosine(piMultiple));
    }

    return finiteComputedConstantValue(Math.cos(operand.value));
  }

  if (operator === "exp") {
    return finiteComputedConstantValue(Math.exp(operand.value), {
      rejectZero: true,
    });
  }

  return operand.value <= 0
    ? INVALID_CONSTANT_MATH_AST
    : finiteComputedConstantValue(Math.log(operand.value));
}

/**
 * Computes exact cosine values for syntactic integer multiples of pi.
 */
function readIntegerPiCosine(multiple: number) {
  return Math.abs(multiple) % 2 === 0 ? 1 : -1;
}
