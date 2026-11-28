import type { Object3D } from "three";
import { Vector3 } from "three";

/** The way a strap's own length runs before it is stretched. */
const LENGTH = new Vector3(1, 0, 0);

/** The one vector every stretch reuses, so a frame allocates nothing. */
const reach = new Vector3();

/**
 * Stretches a part one unit long along x between two places, `girth` thick:
 * a tendon from its muscle to its bone, a muscle from its origin to its
 * tendon. It writes the part's place, turn and size, and allocates nothing.
 */
export function stretchBetween(
  part: Object3D,
  from: Vector3,
  to: Vector3,
  girth: number
) {
  reach.subVectors(to, from);
  const length = reach.length();
  part.position.copy(from);
  part.quaternion.setFromUnitVectors(LENGTH, reach.divideScalar(length));
  part.scale.set(length, girth, girth);
}

/**
 * How thick a muscle of resting length `rest` and resting thickness `girth`
 * is once it is `length` long: it keeps its volume, so it bulges as it
 * shortens.
 */
export function bulge(girth: number, rest: number, length: number) {
  return girth * Math.sqrt(rest / length);
}
