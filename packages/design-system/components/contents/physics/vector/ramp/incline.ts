import { Schema } from "effect";

/**
 * A block resting on a ramp. Its weight points straight down; measured
 * from the slope's perpendicular by the ramp angle, it splits into a part
 * down the slope, W sin θ, and a part into the slope, W cos θ, which the
 * ramp's normal force balances. The block slips once the part down the
 * slope beats the most static friction can hold, when tan θ exceeds the
 * friction coefficient. Sliding a distance down the slope, the weight does
 * work W d cos(90° − θ), the dot product of weight and displacement.
 */

/** Gravity at the bench, in m/s². */
export const GRAVITY = 9.8;

/** The block and ramp: mass in kg and the static friction coefficient between them. */
export const BlockSchema = Schema.Struct({
  friction: Schema.Finite.pipe(Schema.check(Schema.isGreaterThanOrEqualTo(0))),
  mass: Schema.Finite.pipe(Schema.check(Schema.isGreaterThan(0))),
});
export type Block = typeof BlockSchema.Type;

/** The forces on the block at a ramp angle in degrees, in newtons, and whether it slips. */
export function rampForces(block: Block, angle: number) {
  const turn = (angle * Math.PI) / 180;
  const weight = block.mass * GRAVITY;
  const along = weight * Math.sin(turn);
  const into = weight * Math.cos(turn);
  return {
    along,
    into,
    normal: into,
    slips: Math.tan(turn) > block.friction,
    weight,
  };
}

/** The work the weight does as the block slides `distance` metres down the slope, in joules, from the angle between them. */
export function slopeWork(block: Block, angle: number, distance: number) {
  const between = ((90 - angle) * Math.PI) / 180;
  return block.mass * GRAVITY * distance * Math.cos(between);
}
