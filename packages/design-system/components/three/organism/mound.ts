import type { Form } from "@repo/design-system/components/three/organism/form";
import {
  smoothNormals,
  unitNormals,
  weldNormals,
} from "@repo/design-system/components/three/organism/form";
import { Array as Arr } from "effect";
import { Color } from "three";

/**
 * A body that grows outwards from a middle rather than along a spine: a sea
 * star, a jellyfish bell, a mushroom cap, a limpet. `rim` is how far the
 * body reaches at each `turn` round the middle, from 0 to 1. `height` is how
 * tall it stands at a place, `out` running from 0 at the middle to 1 at the
 * rim. `paint` gives the place its colour. `rings` and `spokes` are how many
 * faces run outwards and round.
 */
export interface Mound {
  readonly height: (out: number, turn: number) => number;
  readonly paint: (out: number, turn: number, color: Color) => void;
  readonly rim: (turn: number) => number;
  readonly rings: number;
  readonly spokes: number;
}

/**
 * Raises a mound over its outline: a smooth upper surface with normals,
 * texture coordinates that keep the outline's own shape, and a colour at
 * every vertex.
 */
export function moundBody(mound: Mound): Form {
  const columns = mound.spokes + 1;
  const count = (mound.rings + 1) * columns;
  const position = new Float32Array(count * 3);
  const color = new Float32Array(count * 3);
  const uv = new Float32Array(count * 2);
  const index = new Uint32Array(mound.rings * mound.spokes * 6);
  const seams: number[][] = [];
  const ink = new Color();

  for (let ring = 0; ring <= mound.rings; ring += 1) {
    const out = ring / mound.rings;
    seams.push([ring * columns, ring * columns + mound.spokes]);
    for (let column = 0; column < columns; column += 1) {
      const turn = (column / mound.spokes) % 1;
      const angle = turn * 2 * Math.PI;
      const reach = out * mound.rim(turn);
      const x = reach * Math.cos(angle);
      const z = reach * Math.sin(angle);
      const vertex = ring * columns + column;
      position.set([x, mound.height(out, turn), z], vertex * 3);
      uv.set([0.5 + x, 0.5 + z], vertex * 2);
      mound.paint(out, turn, ink);
      color.set([ink.r, ink.g, ink.b], vertex * 3);
    }
  }

  for (let ring = 0; ring < mound.rings; ring += 1) {
    for (let column = 0; column < mound.spokes; column += 1) {
      const a = ring * columns + column;
      const b = a + columns;
      index.set(
        [a, a + 1, b, a + 1, b + 1, b],
        (ring * mound.spokes + column) * 6
      );
    }
  }

  const normal = smoothNormals(position, index);
  weldNormals(normal, seams);
  weldNormals(normal, [Arr.makeBy(columns, (column) => column)]);
  unitNormals(normal);
  return { color, index, normal, position, uv };
}
