import type { ExactPoint3, ExactScalar } from "@repo/math/schema/ast";

/** Reads a finite numeric sort key from an exact scalar display contract. */
export function readSortableExactScalar(scalar: ExactScalar) {
  if (isBlankExactExpression(scalar.expression)) {
    return;
  }

  const exactValue = readFiniteExactExpression(scalar.expression);

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

  const exactValue = readFiniteExactExpression(scalar.expression);

  if (exactValue !== undefined) {
    return exactValue === 0;
  }
  return false;
}

function readFiniteExactExpression(expression: string) {
  const trimmed = expression.trim();
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function isBlankExactExpression(expression: string) {
  return expression.trim().length === 0;
}

function readFiniteDecimalHint(scalar: ExactScalar) {
  return scalar.decimal;
}

function hasInconsistentDecimalHint(scalar: ExactScalar, exactValue: number) {
  const decimal = readFiniteDecimalHint(scalar);
  return decimal !== undefined && decimal !== exactValue;
}
