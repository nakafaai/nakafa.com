const DEGREES_IN_HALF_CIRCLE = 180;
const DEGREES_TO_RADIANS = Math.PI / DEGREES_IN_HALF_CIRCLE;
const EPSILON = 1e-10;

export function getRadians(angle: number) {
  return angle * DEGREES_TO_RADIANS;
}

export function getDegrees(angle: number) {
  return angle / DEGREES_TO_RADIANS;
}

export function getSin(angle: number) {
  return Math.sin(getRadians(angle));
}

export function getCos(angle: number) {
  return Math.cos(getRadians(angle));
}

/**
 * Get the tangent of an angle
 * @param angle - The angle in degrees
 * @returns The tangent of the angle or positive infinity if the angle is 90° or 270°
 */
export function getTan(angle: number) {
  // Check if cos is close to zero to handle tan(90°), tan(270°), etc.
  return Math.abs(Math.cos(getRadians(angle))) < EPSILON
    ? Number.POSITIVE_INFINITY
    : Math.tan(getRadians(angle));
}
