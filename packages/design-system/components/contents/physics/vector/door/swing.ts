import { Schema } from "effect";

/**
 * A door seen from above, turning on its hinges. A push at a distance r
 * from the hinge line, at an angle θ to the door, gives a torque r F sin θ,
 * the size of the cross product of the arm and the force; it points up out
 * of the floor for a push that turns the door counterclockwise. A door is a
 * flat slab turning about one edge, so its moment of inertia is M W² / 3,
 * and the torque gives it an angular acceleration τ / I.
 */

/** The door: mass in kg, width in m, and the push in N. */
export const DoorSchema = Schema.Struct({
  force: Schema.Finite.pipe(Schema.check(Schema.isGreaterThan(0))),
  mass: Schema.Finite.pipe(Schema.check(Schema.isGreaterThan(0))),
  width: Schema.Finite.pipe(Schema.check(Schema.isGreaterThan(0))),
});
type Door = typeof DoorSchema.Type;

/** The push at `arm` metres from the hinge and `angle` degrees from the door: the part square to the door, the torque, and the angular acceleration. */
export function doorTorque(door: Door, arm: number, angle: number) {
  const square = door.force * Math.sin((angle * Math.PI) / 180);
  const torque = arm * square;
  return {
    spin: torque / ((door.mass * door.width ** 2) / 3),
    square,
    torque,
  };
}

/** How far the door has turned after `time` seconds from rest, in degrees, up to wide open at 90°. */
export function swingAngle(spin: number, time: number) {
  return Math.min(90, (0.5 * spin * time ** 2 * 180) / Math.PI);
}
