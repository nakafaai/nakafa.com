import { Schema } from "effect";

/**
 * A loaded sled pulled across level snow by a rope that rises at an angle.
 * The rope's pull splits into a part along the snow, F cos θ, which moves
 * the sled, and a part up, F sin θ, which lifts some of its weight off the
 * snow. Over a distance s along the snow, the pull does work F s cos θ:
 * the dot product of the pull and the displacement, so only the part along
 * the motion counts.
 */

/** Gravity on the snow, in m/s². */
export const GRAVITY = 9.8;

/** The pull: rope force in N, sled and load mass in kg, and the distance pulled in m. */
export const TowSchema = Schema.Struct({
  distance: Schema.Finite.pipe(Schema.check(Schema.isGreaterThan(0))),
  force: Schema.Finite.pipe(Schema.check(Schema.isGreaterThan(0))),
  mass: Schema.Finite.pipe(Schema.check(Schema.isGreaterThan(0))),
});
export type Tow = typeof TowSchema.Type;

/** The parts of the pull at a rope angle in degrees, the snow's normal force, and the work over the distance. */
export function towParts(tow: Tow, angle: number) {
  const turn = (angle * Math.PI) / 180;
  const along = tow.force * Math.cos(turn);
  const up = tow.force * Math.sin(turn);
  return {
    along,
    normal: Math.max(0, tow.mass * GRAVITY - up),
    up,
    work: along * tow.distance,
  };
}
