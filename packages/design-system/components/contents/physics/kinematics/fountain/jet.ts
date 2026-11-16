import { Schema } from "effect";

/**
 * A garden hose held at the ground, spraying at a steady speed. Every drop
 * leaves the nozzle at the same speed and angle, so the stream traces one
 * parabola: the horizontal part of the velocity carries the drops along
 * while gravity bends them down. Gravity is rounded to 10 m/s², as the
 * lessons do; air drag on the drops is left out.
 */

/** Gravitational acceleration, in m/s². */
export const JET_GRAVITY = 10;

/** The angles a learner can hold the nozzle at, in degrees above the ground. */
export const JetAngleSchema = Schema.Literals([15, 30, 45, 60, 75, 90]);
export type JetAngle = typeof JetAngleSchema.Type;

/** Where a drop is `time` seconds after it leaves the nozzle, in metres. */
export function jetDrop(speed: number, angle: number, time: number) {
  const radians = (angle * Math.PI) / 180;
  return {
    x: speed * Math.cos(radians) * time,
    y: speed * Math.sin(radians) * time - 0.5 * JET_GRAVITY * time * time,
  };
}

/** The stream's time in the air, top height, and range on level ground. */
export function jetShape(speed: number, angle: number) {
  const radians = (angle * Math.PI) / 180;
  const flight = (2 * speed * Math.sin(radians)) / JET_GRAVITY;
  return {
    flight,
    range: speed * Math.cos(radians) * flight,
    top: (speed * Math.sin(radians)) ** 2 / (2 * JET_GRAVITY),
  };
}
