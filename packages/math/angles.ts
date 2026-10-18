import { Option } from "effect";

const DEGREES_IN_HALF_CIRCLE = 180;
const DEGREES_TO_RADIANS = Math.PI / DEGREES_IN_HALF_CIRCLE;
const EPSILON = 1e-10;

/** Each acute angle in an isosceles right triangle, in degrees. */
export const ISOSCELES_RIGHT_TRIANGLE_ANGLE = 45;

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

/** Degrees in one quarter of a turn. */
const DEGREES_IN_QUADRANT = 90;
/** Degrees in a whole turn. */
const DEGREES_IN_TURN = 360;

/**
 * The quadrant, 1 to 4, that the terminal side of a degree angle lies in, or
 * none when the side lies on an axis, which belongs to no quadrant.
 */
export function getQuadrant(angle: number) {
  const turned =
    ((angle % DEGREES_IN_TURN) + DEGREES_IN_TURN) % DEGREES_IN_TURN;
  return turned % DEGREES_IN_QUADRANT === 0
    ? Option.none()
    : Option.some(Math.floor(turned / DEGREES_IN_QUADRANT) + 1);
}
