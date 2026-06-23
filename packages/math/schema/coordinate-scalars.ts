import type { ExactPoint3, ExactScalar } from "@repo/math/schema/ast";
import { readExactNumericExpression } from "@repo/math/schema/coordinate-exact-numeric";

const DECIMAL_HINT_TOLERANCE = 1e-4;

/** Reads a finite numeric sort key from an exact scalar display contract. */
export function readSortableExactScalar(scalar: ExactScalar) {
  if (isBlankExactExpression(scalar.expression)) {
    return;
  }

  const exactValue = readExactNumericExpression(scalar.expression);

  if (exactValue !== undefined) {
    if (hasInconsistentDecimalHint(scalar, exactValue)) {
      return;
    }

    return exactValue;
  }
}

/** Checks whether every coordinate has a parseable exact zero expression. */
export function isExactZeroPoint(point: ExactPoint3) {
  return (
    isExactZeroScalar(point.x) &&
    isExactZeroScalar(point.y) &&
    isExactZeroScalar(point.z)
  );
}

/** Reads the first point coordinate that lacks a finite sortable scalar value. */
export function readNonSortablePointAxis(point: ExactPoint3) {
  if (readSortableExactScalar(point.x) === undefined) {
    return "x";
  }

  if (readSortableExactScalar(point.y) === undefined) {
    return "y";
  }

  if (readSortableExactScalar(point.z) === undefined) {
    return "z";
  }
}

function isExactZeroScalar(scalar: ExactScalar) {
  if (isBlankExactExpression(scalar.expression)) {
    return false;
  }

  const exactValue = readExactNumericExpression(scalar.expression);

  if (exactValue !== undefined) {
    return exactValue === 0;
  }
  return false;
}

function isBlankExactExpression(expression: string) {
  return expression.trim().length === 0;
}

function readFiniteDecimalHint(scalar: ExactScalar) {
  return scalar.decimal;
}

function hasInconsistentDecimalHint(scalar: ExactScalar, exactValue: number) {
  const decimal = readFiniteDecimalHint(scalar);
  if (decimal === undefined) {
    return false;
  }

  const allowedDrift =
    Math.max(1, Math.abs(exactValue)) * DECIMAL_HINT_TOLERANCE;
  return Math.abs(decimal - exactValue) > allowedDrift;
}
