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

  return readFiniteDecimalHint(scalar);
}

/** Checks whether every coordinate is exactly zero or has a finite zero hint. */
export function isExactZeroPoint(point: ExactPoint3) {
  return (
    isExactZeroScalar(point.x) &&
    isExactZeroScalar(point.y) &&
    isExactZeroScalar(point.z)
  );
}

function isExactZeroScalar(scalar: ExactScalar) {
  if (isBlankExactExpression(scalar.expression)) {
    return false;
  }

  const exactValue = readFiniteExactExpression(scalar.expression);

  if (exactValue !== undefined) {
    return exactValue === 0;
  }

  const decimal = readFiniteDecimalHint(scalar);
  return decimal === 0;
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
  if (scalar.decimal === undefined) {
    return;
  }

  return Number.isFinite(scalar.decimal) ? scalar.decimal : undefined;
}

function hasInconsistentDecimalHint(scalar: ExactScalar, exactValue: number) {
  const decimal = readFiniteDecimalHint(scalar);
  return decimal !== undefined && decimal !== exactValue;
}
