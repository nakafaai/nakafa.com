import type { ConstantMathAstValue } from "@repo/math/schema/ast/constant";
import {
  divideFiniteDecimalNumbers,
  isRoundedPiSentinel,
  multiplyFiniteDecimalNumbers,
} from "@repo/math/schema/ast/decimal";

const PI_TOKEN_PATTERN = /π|pi/gi;

/**
 * Detects literal expressions whose pi semantics need operation nodes.
 */
export function hasMultipleSyntacticPiTokens(expression: string) {
  const compact = expression.trim().replaceAll(/\s+/g, "");
  return (compact.match(PI_TOKEN_PATTERN)?.length ?? 0) > 1;
}

/**
 * Carries a product of two syntactic pi factors as a pi-squared coefficient.
 */
export function readProductPiSquareMultiple(
  left: ConstantMathAstValue,
  right: ConstantMathAstValue
) {
  if (left.piMultiple === undefined || right.piMultiple === undefined) {
    return;
  }

  return readSafePiProduct(left.piMultiple, right.piMultiple);
}

/**
 * Carries a pi-squared coefficient through numeric scaling.
 */
export function readScaledPiSquareMultiple(
  piSquareMultiple: number,
  scalar: number,
  operator: "divide" | "multiply"
) {
  return operator === "multiply"
    ? readSafePiProduct(piSquareMultiple, scalar)
    : divideFiniteDecimalNumbers(piSquareMultiple, scalar);
}

/**
 * Carries pi-squared metadata through unary negation.
 */
export function readNegatedPiSquareMultiple(multiple: number | undefined) {
  return multiple === undefined ? undefined : -multiple;
}

/**
 * Carries pi-squared metadata through absolute value.
 */
export function readAbsolutePiSquareMultiple(multiple: number | undefined) {
  return multiple === undefined ? undefined : Math.abs(multiple);
}

/**
 * Detects a carried pi-squared term that still needs reduction or scaling.
 */
export function hasPiSquareMultiple(value: ConstantMathAstValue) {
  return value.piSquareMultiple !== undefined;
}

/**
 * Scales an existing pi-squared term by the other plain numeric factor.
 */
export function readScaledPiSquareProduct(
  left: ConstantMathAstValue,
  right: ConstantMathAstValue
) {
  if (left.piSquareMultiple !== undefined) {
    return readScaledPiSquareMultiple(
      left.piSquareMultiple,
      right.value,
      "multiply"
    );
  }

  if (right.piSquareMultiple !== undefined) {
    return readScaledPiSquareMultiple(
      right.piSquareMultiple,
      left.value,
      "multiply"
    );
  }
}

/**
 * Reduces a pi-squared numerator by a single-pi denominator.
 */
export function readReducedPiSquareMultiple(
  left: ConstantMathAstValue,
  right: ConstantMathAstValue
) {
  if (left.piSquareMultiple === undefined || right.piMultiple === undefined) {
    return;
  }

  return divideFiniteDecimalNumbers(left.piSquareMultiple, right.piMultiple);
}

/**
 * Squares a syntactic pi multiple into supported pi-squared metadata.
 */
export function readSquaredPiMultiple(value: ConstantMathAstValue) {
  if (value.piMultiple === undefined) {
    return;
  }

  return readSafePiProduct(value.piMultiple, value.piMultiple);
}

/**
 * Reduces supported pi-squared square roots back to single-pi metadata.
 */
export function readSqrtPiSquareMultiple(value: ConstantMathAstValue) {
  const multiple = value.piSquareMultiple;
  if (multiple === undefined || multiple < 0) {
    return;
  }

  const root = Math.sqrt(multiple);
  if (!Number.isFinite(root) || root * root !== multiple) {
    return;
  }

  return isRoundedPiSentinel(root) ? undefined : root;
}

/**
 * Rejects pi products that would drift into a trig sentinel.
 */
function readSafePiProduct(piMultiple: number, scalar: number) {
  const product = multiplyFiniteDecimalNumbers(piMultiple, scalar);
  if (isRoundedPiSentinel(product)) {
    return;
  }

  return product;
}
