import { Array as Arr } from "effect";
import { BufferGeometry, Float32BufferAttribute } from "three";

/**
 * A classic diamond kite's frame, in metres: the spine from nose to tail,
 * the spreader across it, and how far down the spine the spreader crosses
 * it, as a share of the spine. The wind bellies the sail back by `billow`
 * at the middle of each panel.
 */
export const KITE = {
  billow: 0.12,
  cross: 0.25,
  spine: 3,
  spreader: 2.8,
} as const;

/** Cells along each edge of one of the sail's four triangles. */
const CELLS = 10;

/**
 * The sail of a diamond kite, nose up along +y and facing +z, with the
 * spreader's crossing at the origin. Each of the four triangles between the
 * nose, the wing tips and the tail is a grid that the wind bellies back
 * toward -z, most in its middle and not at all along the spars and the hem.
 * The two upper triangles are the first group and the two lower ones the
 * second, so the sail is sewn from two colours of ripstop. Texture
 * coordinates are in metres.
 */
export function sailGeometry() {
  const nose = KITE.spine * KITE.cross;
  const tail = -KITE.spine * (1 - KITE.cross);
  const tip = KITE.spreader / 2;
  const triangles = [
    [
      [0, nose],
      [-tip, 0],
    ],
    [
      [tip, 0],
      [0, nose],
    ],
    [
      [-tip, 0],
      [0, tail],
    ],
    [
      [0, tail],
      [tip, 0],
    ],
  ] as const;
  const perTriangle = ((CELLS + 1) * (CELLS + 2)) / 2;
  const points = Arr.flatMap(triangles, ([[ax, ay], [bx, by]]) =>
    Arr.flatMap(Arr.range(0, CELLS), (row) =>
      Arr.map(Arr.range(0, CELLS - row), (column) => {
        const a = row / CELLS;
        const b = column / CELLS;
        const belly = 27 * a * b * (1 - a - b);
        return [
          ax * a + bx * b,
          ay * a + by * b,
          -KITE.billow * belly,
        ] as const;
      })
    )
  );
  // The first point of each row of one triangle's grid, rows narrowing by one toward its far corner.
  const rowStart = (row: number) => row * (CELLS + 1) - (row * (row - 1)) / 2;
  const faces = Arr.flatMap(Arr.range(0, 3), (triangle) =>
    Arr.flatMap(Arr.range(0, CELLS - 1), (row) => {
      const width = CELLS - row + 1;
      const start = triangle * perTriangle + rowStart(row);
      return Arr.flatMap(Arr.range(0, width - 2), (column) => {
        const here = start + column;
        const above = start + width + column;
        return column < width - 2
          ? [here, here + 1, above, here + 1, above + 1, above]
          : [here, here + 1, above];
      });
    })
  );

  return sheetGeometry(points, faces, true);
}

/**
 * A sheet from its points and its triangles as runs of three point indices,
 * with texture coordinates in metres across it. Split in two equal groups,
 * its halves take two materials.
 */
function sheetGeometry(
  points: readonly (readonly [number, number, number])[],
  faces: readonly number[],
  halves: boolean
) {
  const geometry = new BufferGeometry();
  geometry.setAttribute(
    "position",
    new Float32BufferAttribute(
      Arr.flatMap(points, (point) => [...point]),
      3
    )
  );
  geometry.setAttribute(
    "uv",
    new Float32BufferAttribute(
      Arr.flatMap(points, ([x, y]) => [x, y]),
      2
    )
  );
  geometry.setIndex([...faces]);
  if (halves) {
    geometry.addGroup(0, faces.length / 2, 0);
    geometry.addGroup(faces.length / 2, faces.length / 2, 1);
  }
  geometry.computeVertexNormals();
  return geometry;
}

/**
 * A ribbon tail hanging from the kite's tail, `length` metres long and
 * `width` wide, rippling side to side in `waves` waves and trailing back
 * from the sail as the wind streams it, as a strip of quads.
 */
export function tailGeometry(length: number, width: number, waves: number) {
  const steps = 60;
  const points = Arr.flatMap(Arr.range(0, steps), (step) => {
    const along = step / steps;
    const sway = 0.25 * along * Math.sin(along * waves * Math.PI * 2);
    const back = -0.35 * along * along * length;
    return Arr.map(
      [-1, 1],
      (side) => [sway + (side * width) / 2, -along * length, back] as const
    );
  });
  const faces = Arr.flatMap(Arr.range(0, steps - 1), (step) => {
    const a = step * 2;
    return [a, a + 1, a + 2, a + 1, a + 3, a + 2];
  });
  return sheetGeometry(points, faces, false);
}
