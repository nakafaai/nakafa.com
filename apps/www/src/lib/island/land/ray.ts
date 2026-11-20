import { Option } from "effect";
import type { Land } from "@/lib/island/land/ground";
import { depthAt, heightAt, surfaceAt } from "@/lib/island/land/ground";

/** How far a ray is followed before it is taken to meet nothing, in blocks. */
const FAR = 520;

/** How deep water must stand over a place for a press there to count as on the water. */
const WADE = 0.03;

/** A point in the world, or a direction in it. */
type Vector = readonly [number, number, number];

/**
 * Where a ray first meets the land or the water over it (ADR 0050, W2): the
 * place, and whether water stands there. The ray is followed in steps that
 * grow with the distance, then the meeting is narrowed between the last two.
 * None when the ray meets nothing within reach.
 */
export function landHit(land: Land, origin: Vector, direction: Vector) {
  const under = (reach: number) => {
    const x = origin[0] + direction[0] * reach;
    const z = origin[2] + direction[2] * reach;
    return (
      origin[1] + direction[1] * reach <
      Math.max(heightAt(land, x, z), surfaceAt(land, x, z))
    );
  };
  let before = 0;
  for (let reach = 1; reach < FAR; reach += Math.max(0.6, reach * 0.025)) {
    if (under(reach)) {
      let near = before;
      let far = reach;
      for (let pass = 0; pass < 9; pass += 1) {
        const middle = (near + far) / 2;
        if (under(middle)) {
          far = middle;
        } else {
          near = middle;
        }
      }
      const x = origin[0] + direction[0] * far;
      const z = origin[2] + direction[2] * far;
      return Option.some({
        water: depthAt(land, x, z) > WADE,
        x,
        y: origin[1] + direction[1] * far,
        z,
      });
    }
    before = reach;
  }
  return Option.none();
}
