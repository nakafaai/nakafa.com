export function getRadians(angle: number) {
  return angle * (Math.PI / 180);
}

export function getDegrees(angle: number) {
  return angle * (180 / Math.PI);
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
  return Math.abs(Math.cos(getRadians(angle))) < 1e-10
    ? Number.POSITIVE_INFINITY
    : Math.tan(getRadians(angle));
}
