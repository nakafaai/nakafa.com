import { fractalAt } from "@repo/design-system/components/three/field/noise";
import { Array as Arr } from "effect";

/**
 * The shape of open land far from a lab: it lies dead flat where the lab
 * stands and rolls gently beyond, as real ground does toward a horizon.
 */

/** How far from the lab's middle the land stays dead flat, in reaches. */
export const FLAT_REACHES = 2;

/** How far from the lab's middle the land rolls at its full height, in reaches. */
const ROLLING_REACHES = 7;

/** How far the rolling land reaches before its shape repeats, in reaches: past the haze. */
const ROLL_SPAN = 40;

/** How many broad hills cross one span of rolling land, each way. */
const HILLS = 6;

/**
 * How high the land stands at a place, in reaches, with the lab's middle at
 * the origin and `x` and `z` in reaches. It is zero within the flat of the
 * lab, and beyond it swells smoothly into hills and hollows that stand about
 * `rise` reaches above and below the lab's floor.
 */
export function reliefAt(x: number, z: number, rise: number) {
  const away = Math.hypot(x, z);
  if (rise === 0 || away <= FLAT_REACHES) {
    return 0;
  }
  const along = Math.min(
    1,
    (away - FLAT_REACHES) / (ROLLING_REACHES - FLAT_REACHES)
  );
  const swell = along * along * along * (along * (along * 6 - 15) + 10);
  const hills = fractalAt(
    x / ROLL_SPAN + 0.5,
    z / ROLL_SPAN + 0.5,
    HILLS,
    HILLS,
    307,
    2
  );
  return rise * swell * 4 * (hills - 0.5);
}

/**
 * The numbers of the mesh a ground is drawn with: a round sheet of `radius`
 * around the origin, as a fan over its flat middle of radius `flat` and then
 * `rings` rings out to its rim, each ring a little wider than the one inside
 * it, so the mesh is finest near the lab. Every vertex stands as high as
 * `heightAt` says, and its texture coordinates are its own place on the
 * ground, so a texture lies at its real size however the mesh is cut.
 *
 * @param radius - How far the sheet reaches from the origin
 * @param flat - The radius of the flat middle, drawn as one fan
 * @param rings - How many rings lie between the flat middle and the rim
 * @param spokes - How many vertices each ring has
 * @param heightAt - How high the ground stands at a place
 */
export function landGrid(
  radius: number,
  flat: number,
  rings: number,
  spokes: number,
  heightAt: (x: number, z: number) => number
) {
  const radii = Arr.makeBy(
    rings + 1,
    (ring) => flat * (radius / flat) ** (ring / rings)
  );
  const count = 1 + radii.length * spokes;
  const positions = new Float32Array(count * 3);
  const uvs = new Float32Array(count * 2);
  positions.set([0, heightAt(0, 0), 0], 0);
  Arr.forEach(radii, (away, ring) => {
    for (let spoke = 0; spoke < spokes; spoke += 1) {
      const angle = (spoke / spokes) * 2 * Math.PI;
      const x = away * Math.cos(angle);
      const z = away * Math.sin(angle);
      const vertex = 1 + ring * spokes + spoke;
      positions.set([x, heightAt(x, z), z], vertex * 3);
      uvs.set([x, z], vertex * 2);
    }
  });
  const fan = Arr.flatMap(
    Arr.makeBy(spokes, (spoke) => spoke),
    (spoke) => [0, 1 + ((spoke + 1) % spokes), 1 + spoke]
  );
  const bands = Arr.flatMap(
    Arr.makeBy(rings, (ring) => ring),
    (ring) =>
      Arr.flatMap(
        Arr.makeBy(spokes, (spoke) => spoke),
        (spoke) => {
          const inner = 1 + ring * spokes + spoke;
          const next = 1 + ring * spokes + ((spoke + 1) % spokes);
          return [
            inner,
            next,
            inner + spokes,
            next,
            next + spokes,
            inner + spokes,
          ];
        }
      )
  );

  return { indices: [...fan, ...bands], positions, uvs };
}

/**
 * Lays the vertices of a mesh on the land: lifts each one, in place, by the
 * height of the ground under it. `positions` holds x, y and z for every
 * vertex.
 */
export function drape<
  Positions extends { [index: number]: number; readonly length: number },
>(positions: Positions, heightAt: (x: number, z: number) => number) {
  for (let at = 0; at < positions.length; at += 3) {
    positions[at + 1] =
      Number(positions[at + 1]) +
      heightAt(Number(positions[at]), Number(positions[at + 2]));
  }
  return positions;
}
