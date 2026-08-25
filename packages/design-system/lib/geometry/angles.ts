const DEGREES_IN_HALF_CIRCLE = 180;
const DEGREES_TO_RADIANS = Math.PI / DEGREES_IN_HALF_CIRCLE;
const EPSILON = 1e-10;

interface TrigonometricReadoutOverrides {
  readonly cos?: string;
  readonly sin?: string;
  readonly tan?: string;
}

/** Converts a degree value to radians for JavaScript trigonometry APIs. */
export function getRadians(angle: number) {
  return angle * DEGREES_TO_RADIANS;
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

/** Formats the values shown by Nakafa's interactive trigonometry controls. */
export function getTrigonometricReadout(
  angle: number,
  overrides?: TrigonometricReadoutOverrides
) {
  const tangent = getTan(angle);

  return {
    cos: overrides?.cos ?? getCos(angle).toFixed(2),
    sin: overrides?.sin ?? getSin(angle).toFixed(2),
    tan:
      overrides?.tan ??
      (Number.isFinite(tangent) ? tangent.toFixed(2) : undefined),
  };
}
