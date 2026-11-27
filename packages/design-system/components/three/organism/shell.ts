import { fractalAt } from "@repo/design-system/components/three/field/noise";
import type { Form } from "@repo/design-system/components/three/organism/form";
import {
  smoothNormals,
  unitNormals,
  weldNormals,
} from "@repo/design-system/components/three/organism/form";
import { Array as Arr } from "effect";
import { Color } from "three";

/**
 * A curved plate of living tissue with a real thickness: a bone of the
 * skull's vault, the cup of a socket, the cartilage that lines it, a joint
 * capsule cut open. It lies on a ball `radius` out from the origin, between
 * two longitudes (`across`, in radians about y, 0 towards +x and a quarter
 * turn towards +z) and two latitudes (`along`, in radians). `thick` is how
 * thick it is at its middle; its rim rounds off to nothing. `edge` shifts
 * its two side edges at a place along it, in radians, so a suture can be
 * serrated and two plates can interlock. `lump` is how far slow noise swells
 * and dents it, as a share of its thickness. `paint` gives a place its
 * colour: `side` runs from -1 on the inner face through 0 at the rim to 1 on
 * the outer face, so a cut edge can show what lies inside the plate.
 */
export interface Shell {
  readonly across: readonly [number, number];
  readonly along: readonly [number, number];
  readonly columns: number;
  readonly edge: (along: number) => readonly [number, number];
  readonly lump: number;
  readonly paint: (
    along: number,
    across: number,
    side: number,
    color: Color
  ) => void;
  readonly radius: number;
  readonly rows: number;
  readonly seed: number;
  readonly thick: number;
}

/**
 * How much of its full thickness a plate keeps at `place`, from 0 to 1
 * across it, when its rim rounds off over `rim` of that way: a quarter
 * circle, so the cut edge is blunt, never a knife.
 */
function rounded(place: number, rim: number) {
  const inset = Math.min(1, Math.min(place, 1 - place) / rim);
  return Math.sqrt(1 - (1 - inset) ** 2);
}

/**
 * Raises a plate over its patch of a ball: a smooth closed surface with an
 * outer face, an inner face and a rounded rim, normals, texture coordinates
 * that run along and round it, and a colour at every vertex.
 */
export function shellBody(shell: Shell): Form {
  const rings = shell.rows + 1;
  const loop = shell.columns * 2;
  const columns = loop + 1;
  const position = new Float32Array(rings * columns * 3);
  const color = new Float32Array(rings * columns * 3);
  const uv = new Float32Array(rings * columns * 2);
  const index = new Uint32Array(shell.rows * loop * 6);
  const wide = shell.across[1] - shell.across[0];
  const long = shell.along[1] - shell.along[0];
  const rimAcross = shell.thick / (2 * shell.radius * Math.abs(wide));
  const rimAlong = shell.thick / (2 * shell.radius * Math.abs(long));
  const ink = new Color();

  for (let ring = 0; ring < rings; ring += 1) {
    const along = ring / shell.rows;
    const latitude = shell.along[0] + along * long;
    const [first, last] = shell.edge(along);
    for (let column = 0; column < columns; column += 1) {
      const outer = column <= shell.columns;
      const across = outer
        ? column / shell.columns
        : (loop - column) / shell.columns;
      const longitude =
        shell.across[0] +
        across * wide +
        first * (1 - across) +
        last * across;
      const kept = rounded(across, rimAcross) * rounded(along, rimAlong);
      const side = (outer ? 1 : -1) * kept;
      const swell =
        shell.lump *
        shell.thick *
        2 *
        (fractalAt(across, along, 4, 4, shell.seed, 3) - 0.5);
      const reach = shell.radius + swell + (side * shell.thick) / 2;
      const vertex = ring * columns + column;
      position.set(
        [
          reach * Math.cos(longitude) * Math.cos(latitude),
          reach * Math.sin(latitude),
          reach * Math.sin(longitude) * Math.cos(latitude),
        ],
        vertex * 3
      );
      uv.set([along, column / loop], vertex * 2);
      shell.paint(along, across, side, ink);
      color.set([ink.r, ink.g, ink.b], vertex * 3);
    }
  }

  for (let ring = 0; ring < shell.rows; ring += 1) {
    for (let column = 0; column < loop; column += 1) {
      const a = ring * columns + column;
      const b = a + columns;
      index.set([a, b, a + 1, a + 1, b, b + 1], (ring * loop + column) * 6);
    }
  }

  const normal = smoothNormals(position, index);
  weldNormals(
    normal,
    Arr.makeBy(rings, (ring) => [ring * columns, ring * columns + loop])
  );
  unitNormals(normal);
  return { color, index, normal, position, uv };
}
