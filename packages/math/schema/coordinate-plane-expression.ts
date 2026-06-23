import type { ExactPoint3 } from "@repo/math/schema/ast";
import { readSortableExactScalar } from "@repo/math/schema/coordinate-scalars";

const PLANE_EQUATION_RELATIVE_TOLERANCE = 1e-9;

export interface AffinePlaneExpression {
  constant: number;
  x: number;
  y: number;
  z: number;
}

/** Builds the expected affine plane expression from point-normal geometry. */
export function readExpectedPlaneExpression(
  normal: ExactPoint3,
  point: ExactPoint3
) {
  const normalX = readSortableExactScalar(normal.x);
  const normalY = readSortableExactScalar(normal.y);
  const normalZ = readSortableExactScalar(normal.z);
  const pointX = readSortableExactScalar(point.x);
  const pointY = readSortableExactScalar(point.y);
  const pointZ = readSortableExactScalar(point.z);

  if (
    normalX === undefined ||
    normalY === undefined ||
    normalZ === undefined ||
    pointX === undefined ||
    pointY === undefined ||
    pointZ === undefined
  ) {
    return;
  }

  const offset = readPlaneOffset([
    [normalX, pointX],
    [normalY, pointY],
    [normalZ, pointZ],
  ]);

  if (offset === undefined) {
    return;
  }

  return {
    constant: -offset,
    x: normalX,
    y: normalY,
    z: normalZ,
  };
}

/** Adds two affine plane expressions coefficient-wise. */
export function addAffinePlaneExpressions(
  left: AffinePlaneExpression,
  right: AffinePlaneExpression
): AffinePlaneExpression {
  return {
    constant: left.constant + right.constant,
    x: left.x + right.x,
    y: left.y + right.y,
    z: left.z + right.z,
  };
}

/** Scales one affine plane expression by a finite scalar without underflow. */
export function scaleAffinePlaneExpression(
  expression: AffinePlaneExpression,
  factor: number
): AffinePlaneExpression | undefined {
  const constant = scalePlaneCoefficient(expression.constant, factor);
  const x = scalePlaneCoefficient(expression.x, factor);
  const y = scalePlaneCoefficient(expression.y, factor);
  const z = scalePlaneCoefficient(expression.z, factor);

  if (
    constant === undefined ||
    x === undefined ||
    y === undefined ||
    z === undefined
  ) {
    return;
  }

  return {
    constant,
    x,
    y,
    z,
  };
}

/** Creates a constant affine plane expression. */
export function literalAffinePlaneExpression(
  value: number
): AffinePlaneExpression {
  return { constant: value, x: 0, y: 0, z: 0 };
}

/** Creates an affine expression for one coordinate variable. */
export function variableAffinePlaneExpression(
  name: "x" | "y" | "z"
): AffinePlaneExpression {
  return {
    constant: 0,
    x: name === "x" ? 1 : 0,
    y: name === "y" ? 1 : 0,
    z: name === "z" ? 1 : 0,
  };
}

/** Reads the constant term when an affine expression has no variables. */
export function readConstantAffinePlaneExpression(
  expression: AffinePlaneExpression
) {
  if (expression.x === 0 && expression.y === 0 && expression.z === 0) {
    return expression.constant;
  }
}

/** Compares two nonzero affine plane expressions up to nonzero scale. */
export function isSamePlaneExpression(
  actual: AffinePlaneExpression,
  expected: AffinePlaneExpression
) {
  if (isZeroAffineExpression(actual)) {
    return false;
  }

  const scaleFactor = readScaleFactor(actual, expected);

  if (
    scaleFactor === undefined ||
    scaleFactor === 0 ||
    !Number.isFinite(scaleFactor)
  ) {
    return false;
  }

  return (
    isPlaneCoefficientMatch(actual.x, expected.x, expected.x * scaleFactor) &&
    isPlaneCoefficientMatch(actual.y, expected.y, expected.y * scaleFactor) &&
    isPlaneCoefficientMatch(actual.z, expected.z, expected.z * scaleFactor) &&
    isPlaneCoefficientMatch(
      actual.constant,
      expected.constant,
      expected.constant * scaleFactor
    )
  );
}

function readPlaneOffset(terms: readonly (readonly [number, number])[]) {
  let offset = 0;

  for (const [normal, point] of terms) {
    const product = multiplyFinitePlaneScalars(normal, point);
    if (product === undefined) {
      return;
    }

    offset += product;
    if (!Number.isFinite(offset)) {
      return;
    }
  }

  return offset;
}

function multiplyFinitePlaneScalars(normal: number, point: number) {
  if (normal === 0 || point === 0) {
    return 0;
  }

  const product = normal * point;
  if (!Number.isFinite(product) || product === 0) {
    return;
  }

  return product;
}

function scalePlaneCoefficient(coefficient: number, factor: number) {
  if (!Number.isFinite(factor)) {
    return;
  }

  if (coefficient === 0 || factor === 0) {
    return 0;
  }

  const product = coefficient * factor;
  if (!Number.isFinite(product) || product === 0) {
    return;
  }

  return product;
}

function readScaleFactor(
  actual: AffinePlaneExpression,
  expected: AffinePlaneExpression
) {
  if (expected.x !== 0) {
    return actual.x / expected.x;
  }

  if (expected.y !== 0) {
    return actual.y / expected.y;
  }

  if (expected.z !== 0) {
    return actual.z / expected.z;
  }
}

function isZeroAffineExpression(expression: AffinePlaneExpression) {
  return (
    expression.x === 0 &&
    expression.y === 0 &&
    expression.z === 0 &&
    expression.constant === 0
  );
}

function isPlaneCoefficientMatch(
  actual: number,
  expected: number,
  scaledExpected: number
) {
  if (!Number.isFinite(scaledExpected)) {
    return false;
  }

  if (expected === 0) {
    return actual === 0;
  }

  const allowedDrift =
    Math.abs(scaledExpected) * PLANE_EQUATION_RELATIVE_TOLERANCE;
  return Math.abs(actual - scaledExpected) <= allowedDrift;
}
