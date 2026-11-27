import type { CoordinateFrame } from "@repo/design-system/components/three/frame";
import { Array as Arr } from "effect";

/** A place in the scene, as x, y and z in scene units. */
type Place = readonly [number, number, number];

/**
 * The box that holds every one of `places`, grown by `pad` on every side:
 * what a view must hold to show a traced path of light from end to end,
 * wherever the path runs.
 *
 * @param places - The places the box must hold
 * @param pad - How much room the box leaves round them, in scene units
 */
export function extent(
  places: Arr.NonEmptyReadonlyArray<Place>,
  pad: number
): CoordinateFrame {
  const along = (axis: 0 | 1 | 2) => {
    const values = Arr.map(places, (place) => place[axis]);
    return { max: Math.max(...values) + pad, min: Math.min(...values) - pad };
  };
  return { x: along(0), y: along(1), z: along(2) };
}
