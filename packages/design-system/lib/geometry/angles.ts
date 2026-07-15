const DEGREES_IN_HALF_CIRCLE = 180;
const DEGREES_TO_RADIANS = Math.PI / DEGREES_IN_HALF_CIRCLE;
const EPSILON = 1e-10;

/** Converts a degree value to radians for JavaScript trigonometry APIs. */
export function getRadians(angle: number) {
  return angle * DEGREES_TO_RADIANS;
}

/** Converts a radian value to degrees for curriculum-facing geometry. */
export function getDegrees(angle: number) {
  return angle / DEGREES_TO_RADIANS;
}

/** Calculates sine from an angle expressed in degrees. */
export function getSin(angle: number) {
  return Math.sin(getRadians(angle));
}

/** Calculates cosine from an angle expressed in degrees. */
export function getCos(angle: number) {
  return Math.cos(getRadians(angle));
}

/** Returns positive infinity when a degree angle has an effectively zero cosine. */
export function getTan(angle: number) {
  // Check if cos is close to zero to handle tan(90°), tan(270°), etc.
  return Math.abs(Math.cos(getRadians(angle))) < EPSILON
    ? Number.POSITIVE_INFINITY
    : Math.tan(getRadians(angle));
}
