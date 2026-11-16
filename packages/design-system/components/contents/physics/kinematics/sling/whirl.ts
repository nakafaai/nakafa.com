import { Schema } from "effect";

/**
 * A ball whirled on a string in a horizontal circle, seen from above, then
 * let go. While it whirls its velocity is tangent to the circle and its
 * acceleration points to the centre; once released nothing pulls it in, so
 * it flies off in a straight line along the tangent where it was let go.
 */

/** Where the ball can be let go: the compass point of the circle, east first, anticlockwise. */
export const ReleasePointSchema = Schema.Literals([
  "east",
  "north",
  "west",
  "south",
]);
export type ReleasePoint = typeof ReleasePointSchema.Type;

/** The angle of each release point, in radians anticlockwise from east. */
export const RELEASE_ANGLES = {
  east: 0,
  north: Math.PI / 2,
  south: (3 * Math.PI) / 2,
  west: Math.PI,
} as const satisfies Record<ReleasePoint, number>;

/** How many full turns the ball makes before it is released. */
const TURNS_BEFORE_RELEASE = 2;

/** The speed and centripetal acceleration of a whirl of `radius` metres and `period` seconds. */
export function whirl(radius: number, period: number) {
  const angular = (2 * Math.PI) / period;
  return {
    acceleration: angular * angular * radius,
    angular,
    speed: angular * radius,
  };
}

/**
 * Where the ball is `time` seconds after it starts at the east point,
 * whirling anticlockwise, and released at `release` after the set turns:
 * on the circle before, and on the tangent line after.
 */
export function slingPlace(
  radius: number,
  period: number,
  release: ReleasePoint,
  time: number
) {
  const { angular, speed } = whirl(radius, period);
  const releaseAngle =
    TURNS_BEFORE_RELEASE * 2 * Math.PI + RELEASE_ANGLES[release];
  const releaseTime = releaseAngle / angular;
  if (time <= releaseTime) {
    const angle = angular * Math.max(time, 0);
    return {
      released: false,
      x: radius * Math.cos(angle),
      y: radius * Math.sin(angle),
    };
  }
  const flight = time - releaseTime;
  const angle = RELEASE_ANGLES[release];
  return {
    released: true,
    x: radius * Math.cos(angle) - speed * Math.sin(angle) * flight,
    y: radius * Math.sin(angle) + speed * Math.cos(angle) * flight,
  };
}

/** The moment of release, in seconds after the start. */
export function releaseTime(period: number, release: ReleasePoint) {
  return (
    (TURNS_BEFORE_RELEASE + RELEASE_ANGLES[release] / (2 * Math.PI)) * period
  );
}
