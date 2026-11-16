import { Schema } from "effect";

/**
 * A wrench on a wheel nut. The torque is the cross product of the arm, from
 * the nut to the hand, and the force: its size r F sin θ, with θ the angle
 * from the handle to the force, and its direction along the nut's axis by
 * the right-hand rule. Only the part of the force square to the handle,
 * F sin θ, turns the nut; the part along the handle only pulls on it.
 */

/** The pull on the handle: force in N and the grip's distance from the nut in m. */
export const GripSchema = Schema.Struct({
  arm: Schema.Finite.pipe(Schema.check(Schema.isGreaterThan(0))),
  force: Schema.Finite.pipe(Schema.check(Schema.isGreaterThan(0))),
});
export type Grip = typeof GripSchema.Type;

/**
 * The torque for an angle from the handle to the force, in degrees
 * counterclockwise as the wheel faces you: the force's parts square to the
 * handle and along it, in N, and the torque along the axis, out of the wheel
 * positive (counterclockwise), in N·m.
 */
export function wrenchTorque(grip: Grip, angle: number) {
  const turn = (angle * Math.PI) / 180;
  const square = grip.force * Math.sin(turn);
  return {
    along: grip.force * Math.cos(turn),
    square,
    torque: grip.arm * square,
  };
}
