import type { ConstantMathAstValue } from "@repo/math/schema/ast/constant";
import { multiplyFiniteDecimalNumbers } from "@repo/math/schema/ast/decimal";
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

    const squareRoot = readExactSquareRoot(operand.value);
    if (squareRoot === undefined) {
      return INVALID_CONSTANT_MATH_AST;
    }

    return finiteComputedConstantValue(squareRoot);
  }

  if (operator === "sin") {
    return readSyntacticPiSine(operand);
  }

  if (operator === "tan") {
    return readSyntacticPiTangent(operand);
  }

  if (operator === "cos") {
    const piMultiple = operand.piMultiple;
    if (isSyntacticHalfIntegerPiMultiple(piMultiple)) {
      return constantMathAst(0);
    }

    if (piMultiple !== undefined && isSyntacticIntegerPiMultiple(piMultiple)) {
      return constantMathAst(readIntegerPiCosine(piMultiple));
    }

    if (piMultiple !== undefined) {
      return INVALID_CONSTANT_MATH_AST;
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
 * Evaluates square roots only when the finite decimal result is exact.
 */
function readExactSquareRoot(value: number) {
  const squareRoot = Math.sqrt(value);
  const squared = multiplyFiniteDecimalNumbers(squareRoot, squareRoot);
  return squared === value ? squareRoot : undefined;
}

/**
 * Reads exact sine values for supported syntactic pi multiples.
 */
function readSyntacticPiSine(operand: ConstantMathAstValue) {
  const piMultiple = operand.piMultiple;
  if (isSyntacticIntegerPiMultiple(piMultiple)) {
    return constantMathAst(0);
  }

  if (
    piMultiple !== undefined &&
    isSyntacticHalfIntegerPiMultiple(piMultiple)
  ) {
    return constantMathAst(readHalfIntegerPiSine(piMultiple));
  }

  return piMultiple === undefined
    ? finiteComputedConstantValue(Math.sin(operand.value))
    : INVALID_CONSTANT_MATH_AST;
}

/**
 * Reads exact tangent values only for integer pi multiples.
 */
function readSyntacticPiTangent(operand: ConstantMathAstValue) {
  const piMultiple = operand.piMultiple;
  if (isSyntacticIntegerPiMultiple(piMultiple)) {
    return constantMathAst(0);
  }

  return piMultiple === undefined
    ? finiteComputedConstantValue(Math.tan(operand.value))
    : INVALID_CONSTANT_MATH_AST;
}

/**
 * Computes exact sine for multiples shaped as n + 1/2.
 */
function readHalfIntegerPiSine(multiple: number) {
  const offset = Math.round(multiple - 0.5);
  return Math.abs(offset) % 2 === 0 ? 1 : -1;
}

/**
 * Computes exact cosine values for syntactic integer multiples of pi.
 */
function readIntegerPiCosine(multiple: number) {
  return Math.abs(multiple) % 2 === 0 ? 1 : -1;
}
