import type { ConstantMathAstValue } from "@repo/math/schema/ast/constant";
import { readFiniteDecimalSum } from "@repo/math/schema/ast/decimal";
import {
  readCombinedPiMultiple,
  readProductPiMultiple,
  readQuotientPiMultiple,
} from "@repo/math/schema/ast/pi";
import {
  hasPiSquareMultiple,
  readProductPiSquareMultiple,
  readReducedPiSquareMultiple,
  readScaledPiSquareMultiple,
  readScaledPiSquareProduct,
} from "@repo/math/schema/ast/power";
import type { MathAstNode } from "@repo/math/schema/ast/schema";
import {
  constantMathAst,
  finiteComputedConstantValue,
  INVALID_CONSTANT_MATH_AST,
} from "@repo/math/schema/ast/value";

/**
 * Applies binary operators and rejects computed values that would hide exact
 * zero, pi, or pi-squared evidence from later divisor and renderer checks.
 */
export function readBinaryConstantValue(
  operator: Extract<MathAstNode, { kind: "binary" }>["operator"],
  left: ConstantMathAstValue,
  right: ConstantMathAstValue
) {
  if (operator === "add" || operator === "subtract") {
    return readAdditiveConstantValue(operator, left, right);
  }

  if (operator === "multiply") {
    return readMultiplicativeConstantValue(left, right);
  }

  if (operator === "divide") {
    return readQuotientConstantValue(left, right);
  }

  return readPowerConstantValue(left, right);
}

/**
 * Uses decimal-safe addition so cancellation cannot drift into a false
 * nonzero divisor while pi metadata survives only when exactly representable.
 */
function readAdditiveConstantValue(
  operator: "add" | "subtract",
  left: ConstantMathAstValue,
  right: ConstantMathAstValue
) {
  const piMultiple = readCombinedPiMultiple(
    left.piMultiple,
    right.piMultiple,
    operator
  );
  if (
    left.piMultiple !== undefined &&
    right.piMultiple !== undefined &&
    piMultiple === undefined
  ) {
    return INVALID_CONSTANT_MATH_AST;
  }

  const value = readFiniteDecimalSum(left.value, right.value, operator);
  if (value === undefined) {
    return INVALID_CONSTANT_MATH_AST;
  }

  return finiteComputedConstantValue(value, { piMultiple });
}

/**
 * Preserves supported pi powers through multiplication and rejects products
 * that would underflow or collapse syntactic pi evidence into plain numbers.
 */
function readMultiplicativeConstantValue(
  left: ConstantMathAstValue,
  right: ConstantMathAstValue
) {
  if (left.isExactZero || right.isExactZero) {
    return constantMathAst(0);
  }

  if (left.piMultiple !== undefined && right.piMultiple !== undefined) {
    return readPiSquareProductConstantValue(left, right);
  }

  if (hasPiSquareMultiple(left) || hasPiSquareMultiple(right)) {
    return readScaledPiSquareProductConstantValue(left, right);
  }

  return readPiProductConstantValue(left, right);
}

/**
 * Carries pi-squared metadata for products of two syntactic pi multiples.
 */
function readPiSquareProductConstantValue(
  left: ConstantMathAstValue,
  right: ConstantMathAstValue
) {
  const piSquareMultiple = readProductPiSquareMultiple(left, right);
  if (piSquareMultiple === undefined) {
    return INVALID_CONSTANT_MATH_AST;
  }

  return finiteComputedConstantValue(left.value * right.value, {
    piSquareMultiple,
    rejectZero: true,
  });
}

/**
 * Scales an existing pi-squared term by a plain numeric factor only.
 */
function readScaledPiSquareProductConstantValue(
  left: ConstantMathAstValue,
  right: ConstantMathAstValue
) {
  if (
    left.piMultiple !== undefined ||
    right.piMultiple !== undefined ||
    (left.piSquareMultiple !== undefined &&
      right.piSquareMultiple !== undefined)
  ) {
    return INVALID_CONSTANT_MATH_AST;
  }

  const piSquareMultiple = readScaledPiSquareProduct(left, right);
  if (piSquareMultiple === undefined) {
    return INVALID_CONSTANT_MATH_AST;
  }

  return finiteComputedConstantValue(left.value * right.value, {
    piSquareMultiple,
    rejectZero: true,
  });
}

/**
 * Preserves the single-pi multiplication case and rejects rounded-away pi
 * coefficients before they can influence trig exact-zero checks.
 */
function readPiProductConstantValue(
  left: ConstantMathAstValue,
  right: ConstantMathAstValue
) {
  const piMultiple = readProductPiMultiple(left, right);
  if (hasExactlyOnePiMultiple(left, right) && piMultiple === undefined) {
    return INVALID_CONSTANT_MATH_AST;
  }

  return finiteComputedConstantValue(left.value * right.value, {
    piMultiple,
    rejectZero: true,
  });
}

/**
 * Handles zero divisors and pi-power reduction before plain finite division.
 */
function readQuotientConstantValue(
  left: ConstantMathAstValue,
  right: ConstantMathAstValue
) {
  if (right.isExactZero) {
    return INVALID_CONSTANT_MATH_AST;
  }

  if (left.isExactZero) {
    return constantMathAst(0);
  }

  const piSquareMultiple = left.piSquareMultiple;
  if (piSquareMultiple !== undefined) {
    return readPiSquareQuotientConstantValue(left, right, piSquareMultiple);
  }

  return readPiQuotientConstantValue(left, right);
}

/**
 * Reduces pi-squared by pi or safely scales it by a plain denominator.
 */
function readPiSquareQuotientConstantValue(
  left: ConstantMathAstValue,
  right: ConstantMathAstValue,
  leftPiSquareMultiple: number
) {
  if (right.piMultiple !== undefined) {
    const piMultiple = readReducedPiSquareMultiple(left, right);
    if (piMultiple === undefined) {
      return INVALID_CONSTANT_MATH_AST;
    }

    return finiteComputedConstantValue(left.value / right.value, {
      piMultiple,
      rejectZero: true,
    });
  }

  const piSquareMultiple = readScaledPiSquareMultiple(
    leftPiSquareMultiple,
    right.value,
    "divide"
  );
  if (piSquareMultiple === undefined) {
    return INVALID_CONSTANT_MATH_AST;
  }

  return finiteComputedConstantValue(left.value / right.value, {
    piSquareMultiple,
    rejectZero: true,
  });
}

/**
 * Preserves single-pi quotients only when the coefficient survives exactly.
 */
function readPiQuotientConstantValue(
  left: ConstantMathAstValue,
  right: ConstantMathAstValue
) {
  const piMultiple = readQuotientPiMultiple(left, right);
  if (
    left.piMultiple !== undefined &&
    right.piMultiple === undefined &&
    piMultiple === undefined
  ) {
    return INVALID_CONSTANT_MATH_AST;
  }

  return finiteComputedConstantValue(left.value / right.value, {
    piMultiple,
    rejectZero: true,
  });
}

/**
 * Rejects undefined zero powers and preserves identity powers of pi exactly.
 */
function readPowerConstantValue(
  left: ConstantMathAstValue,
  right: ConstantMathAstValue
) {
  if (left.isExactZero && right.value === 0) {
    return INVALID_CONSTANT_MATH_AST;
  }

  if (left.isExactZero && right.value > 0) {
    return constantMathAst(0);
  }

  if (right.value === 1 && left.piMultiple !== undefined) {
    return finiteComputedConstantValue(left.value, {
      piMultiple: left.piMultiple,
      rejectZero: true,
    });
  }

  return finiteComputedConstantValue(left.value ** right.value, {
    rejectZero: true,
  });
}

/**
 * Detects the only plain multiplication case where pi metadata must survive.
 */
function hasExactlyOnePiMultiple(
  left: ConstantMathAstValue,
  right: ConstantMathAstValue
) {
  return (left.piMultiple === undefined) !== (right.piMultiple === undefined);
}
