import {
  fractalAt,
  ridgedAt,
} from "@repo/design-system/components/three/field/noise";
import type { Mesh } from "@repo/design-system/components/three/flora/limb";
import type { Point } from "@repo/design-system/components/three/form/path";
import {
  cross,
  sub,
  unit,
} from "@repo/design-system/components/three/form/path";
import { Array as Arr, Schema } from "effect";

/**
 * A rock that stands out of the ground, the bedrock a pioneer plant settles
 * on: how deep its cracks and ledges are (as a share of its size), how low it
 * lies (1 is as high as it is wide, less is a slab), how finely it is laid
 * out and which rock it is. It is one unit from its middle to its side.
 */
const BoulderSchema = Schema.Struct({
  crag: Schema.Finite,
  rows: Schema.Int,
  seed: Schema.Int,
  squat: Schema.Finite,
});
export type Boulder = typeof BoulderSchema.Type;

/** How far below the ground the rock is still drawn, as an angle, so no gap shows under its foot. */
const FOOT = 0.3;

/**
 * How far the face of a rock stands from its middle in one direction: broad
 * swells, sharp ledges where it has split along its joints, and fine pitting
 * over both.
 */
export function boulderReach(boulder: Boulder, around: number, up: number) {
  const ledges = ridgedAt(around, up, 4, 3, boulder.seed) - 0.5;
  const swells = fractalAt(around, up, 2, 2, boulder.seed + 3) - 0.5;
  const pits = fractalAt(around, up, 14, 10, boulder.seed + 7) - 0.5;
  return 1 + boulder.crag * (ledges + 0.9 * swells + 0.12 * pits);
}

/** The place on the face of a rock `around` it (0 to 1) and `up` it (0 under the ground, 1 at its top). */
function boulderPlace(boulder: Boulder, around: number, up: number): Point {
  const turn = around * 2 * Math.PI;
  const tilt = -FOOT + up * (Math.PI / 2 + FOOT);
  const reach = boulderReach(boulder, around, up);
  return [
    reach * Math.cos(tilt) * Math.cos(turn),
    reach * Math.sin(tilt) * boulder.squat,
    reach * Math.cos(tilt) * Math.sin(turn),
  ];
}

/**
 * The face of a rock as triangles, standing on the ground at the origin with
 * its foot a little under it. Its normals follow every ledge and pit, so the
 * relief is real and the low sun picks it out.
 */
export function boulderMesh(boulder: Boulder): Mesh {
  const columns = boulder.rows * 3;
  const step = 0.2 / boulder.rows;
  const vertices = Arr.flatMap(Arr.range(0, boulder.rows), (row) =>
    Arr.map(Arr.range(0, columns), (column) => {
      const around = column / columns;
      const up = Math.min(0.995, row / boulder.rows);
      const place = boulderPlace(boulder, around, up);
      return {
        normal: unit(
          cross(
            sub(boulderPlace(boulder, around, up + step), place),
            sub(boulderPlace(boulder, around + step, up), place)
          )
        ),
        position: place,
        uv: [around * 3, up],
      };
    })
  );
  const stride = columns + 1;
  return {
    indices: Arr.flatMap(Arr.range(0, boulder.rows - 1), (row) =>
      Arr.flatMap(Arr.range(0, columns - 1), (column) => {
        const corner = row * stride + column;
        const above = corner + stride;
        return [corner, above, corner + 1, corner + 1, above, above + 1];
      })
    ),
    normals: Arr.flatMap(vertices, (vertex) => vertex.normal),
    positions: Arr.flatMap(vertices, (vertex) => vertex.position),
    uvs: Arr.flatMap(vertices, (vertex) => vertex.uv),
  };
}
