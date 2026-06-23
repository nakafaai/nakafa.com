import type { ExactPoint3 } from "@repo/math/schema/ast/schema";
import {
  addPlaneCoefficient,
  isPlaneCoefficientMatch,
  multiplyFinitePlaneScalars,
  scalePlaneCoefficient,
} from "@repo/math/schema/coordinate/coefficient";
import { readSortableExactScalar } from "@repo/math/schema/coordinate/scalar";
import { Schema } from "effect";

/** Schema-owned affine expression coefficients for implicit plane equations. */
export const AffinePlaneExpression = Schema.Struct({
  constant: Schema.Number.pipe(Schema.finite()),
  x: Schema.Number.pipe(Schema.finite()),
  y: Schema.Number.pipe(Schema.finite()),
  z: Schema.Number.pipe(Schema.finite()),
});

export type AffinePlaneExpression = Schema.Schema.Type<
  typeof AffinePlaneExpression
>;

/**
 * Builds the expected affine plane expression from point-normal geometry.
 */
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

/**
 * Adds two affine plane expressions coefficient-wise.
 */
export function addAffinePlaneExpressions(
  left: AffinePlaneExpression,
  right: AffinePlaneExpression
): AffinePlaneExpression | undefined {
  const constant = addPlaneCoefficient(left.constant, right.constant);
  const x = addPlaneCoefficient(left.x, right.x);
  const y = addPlaneCoefficient(left.y, right.y);
  const z = addPlaneCoefficient(left.z, right.z);

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

/**
 * Scales one affine plane expression by a finite scalar without underflow.
 */
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

/**
 * Creates a constant affine plane expression.
 */
export function literalAffinePlaneExpression(
  value: number
): AffinePlaneExpression {
  return { constant: value, x: 0, y: 0, z: 0 };
}

/**
 * Creates an affine expression for one coordinate variable.
 */
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

/**
 * Reads the constant term when an affine expression has no variables.
 */
export function readConstantAffinePlaneExpression(
  expression: AffinePlaneExpression
) {
  if (expression.x === 0 && expression.y === 0 && expression.z === 0) {
    return expression.constant;
  }
}

/**
 * Compares two nonzero affine plane expressions up to nonzero scale.
 */
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
    isPlaneCoefficientMatch(
      actual.x,
      expected.x,
      scalePlaneCoefficient(expected.x, scaleFactor)
    ) &&
    isPlaneCoefficientMatch(
      actual.y,
      expected.y,
      scalePlaneCoefficient(expected.y, scaleFactor)
    ) &&
    isPlaneCoefficientMatch(
      actual.z,
      expected.z,
      scalePlaneCoefficient(expected.z, scaleFactor)
    ) &&
    isPlaneCoefficientMatch(
      actual.constant,
      expected.constant,
      scalePlaneCoefficient(expected.constant, scaleFactor)
    )
  );
}

/**
 * Computes the point-normal offset without accepting underflowed products.
 */
function readPlaneOffset(terms: readonly (readonly [number, number])[]) {
  let offset = 0;

  for (const [normal, point] of terms) {
    const product = multiplyFinitePlaneScalars(normal, point);
    if (product === undefined) {
      return;
    }

    const nextOffset = addPlaneCoefficient(offset, product);
    if (nextOffset === undefined) {
      return;
    }
    offset = nextOffset;
  }

  return offset;
}

/**
 * Reads the first nonzero expected coefficient ratio as the plane scale.
 */
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

/**
 * Detects zero affine equations, which cannot define a unique plane.
 */
function isZeroAffineExpression(expression: AffinePlaneExpression) {
  return (
    expression.x === 0 &&
    expression.y === 0 &&
    expression.z === 0 &&
    expression.constant === 0
  );
}
