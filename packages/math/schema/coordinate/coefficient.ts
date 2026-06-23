const PLANE_EQUATION_RELATIVE_TOLERANCE = 1e-9;

/**
 * Adds coefficients and rejects finite nonzero terms rounded out of the sum.
 */
export function addPlaneCoefficient(left: number, right: number) {
  const sum = left + right;
  if (!Number.isFinite(sum)) {
    return;
  }

  if (left !== 0 && right !== 0 && (sum === left || sum === right)) {
    return;
  }

  return sum;
}

/**
 * Multiplies geometry scalars and rejects nonzero products lost to zero.
 */
export function multiplyFinitePlaneScalars(left: number, right: number) {
  if (left === 0 || right === 0) {
    return 0;
  }

  const product = left * right;
  if (!Number.isFinite(product) || product === 0) {
    return;
  }

  return product;
}

/**
 * Scales one coefficient and rejects nonzero products lost to zero.
 */
export function scalePlaneCoefficient(coefficient: number, factor: number) {
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

/**
 * Compares one scaled coefficient using relative tolerance around expectation.
 */
export function isPlaneCoefficientMatch(
  actual: number,
  expected: number,
  scaledExpected: number | undefined
) {
  if (scaledExpected === undefined || !Number.isFinite(scaledExpected)) {
    return false;
  }

  if (expected === 0) {
    return actual === 0;
  }

  const allowedDrift =
    Math.abs(scaledExpected) * PLANE_EQUATION_RELATIVE_TOLERANCE;
  return Math.abs(actual - scaledExpected) <= allowedDrift;
}
