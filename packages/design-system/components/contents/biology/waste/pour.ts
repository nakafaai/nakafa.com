import type { Point } from "@repo/design-system/components/contents/biology/waste/station";
import { add } from "@repo/design-system/components/contents/biology/waste/station";
import { Schema } from "effect";

/**
 * A beaker that pours: the inner radius and height of an ISO 3819 low-form
 * beaker (100 mL: 50 mm across and 70 mm tall; 50 mL: 42 mm across and
 * 60 mm tall, each with a wall about 1.2 mm thick), and the volume of liquid
 * in it, in cubic metres.
 *
 * @see https://www.iso.org/standard/9576.html
 */
const VesselSchema = Schema.Struct({
  height: Schema.Finite,
  radius: Schema.Finite,
  volume: Schema.Finite,
});
export type Vessel = typeof VesselSchema.Type;

/** The beakers of the two liquids: 60 mL of dilute salt solution in a 100 mL beaker, and 25 mL of solvent in a 50 mL one. */
export const VESSELS = {
  salt: { height: 0.07, radius: 0.0238, volume: 60e-6 },
  solvent: { height: 0.06, radius: 0.0198, volume: 25e-6 },
} as const satisfies Record<string, Vessel>;

/** How far a beaker tips to pour, in radians: 77°, so the last of the liquid runs along its lower wall to the lip. */
export const POUR_TILT = 1.35;

/** How deep the liquid stands in an upright `vessel`: its volume over the beaker's inner cross-section. */
export function fillOf(vessel: Vessel) {
  return vessel.volume / (Math.PI * vessel.radius ** 2);
}

/** `point` turned by `angle` about the x axis, as a vessel tipping towards the back of the bench turns. */
export function turnX([x, y, z]: Point, angle: number): Point {
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  return [x, y * cos - z * sin, y * sin + z * cos];
}

/** Where the lip a vessel pours from sits on the vessel itself: the back of its rim. */
function lipAt(vessel: Vessel): Point {
  return [0, vessel.height, -vessel.radius];
}

/** The lip of a vessel standing on `origin` and turned `angle` about x. */
export function lipOf(vessel: Vessel, origin: Point, angle: number) {
  return add(origin, turnX(lipAt(vessel), angle));
}

/**
 * Where a vessel turned `angle` about x must stand so that its lip sits at
 * `spout`, over the place it pours into.
 */
export function originFor(vessel: Vessel, spout: Point, angle: number) {
  const [x, y, z] = turnX(lipAt(vessel), angle);
  return add(spout, [-x, -y, -z]);
}

/**
 * The height of the liquid's surface in a vessel standing on `origin` and
 * turned `angle` about x. Tipping a cylinder turns its surface about the
 * point of its axis at the upright depth, until the surface reaches the
 * lip; from then on the liquid runs out and its surface stays at the lip.
 */
export function levelOf(vessel: Vessel, origin: Point, angle: number) {
  const middle = origin[1] + turnX([0, fillOf(vessel), 0], angle)[1];
  return Math.min(middle, lipOf(vessel, origin, angle)[1]);
}

/** Whether a vessel turned `angle` about x is tipped far enough that its liquid runs over the lip. */
export function isSpilling(vessel: Vessel, angle: number) {
  const middle = turnX([0, fillOf(vessel), 0], angle)[1];
  return middle >= turnX(lipAt(vessel), angle)[1];
}
