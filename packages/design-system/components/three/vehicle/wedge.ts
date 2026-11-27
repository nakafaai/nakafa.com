import { WAKE_ANGLE } from "@repo/design-system/components/three/vehicle/motion";
import { Array as Arr } from "effect";

/** Rows of the wedge from the stern to its far end, and columns across it. */
const ROWS = 40;
const COLUMNS = 16;

/** How wide the wedge already is at the stern, as a share of its length. */
const STERN = 0.035;

/**
 * Kelvin's wedge as one flat sheet, with its point at the origin and its
 * length of 1 running toward −x. Each vertex carries its place, its texture
 * coordinates (`tiles` foam tiles along the wedge, one across), and how much
 * of the foam is left there as the opacity of its colour: none at the very
 * stern, most just astern, and none again at the far end.
 *
 * @param tiles - How many foam tiles lie along the wedge
 */
export function wedgeSheet(tiles: number) {
  const spread = Math.tan(WAKE_ANGLE);
  const vertices = Arr.flatMap(Arr.range(0, ROWS), (row) => {
    const along = (row / ROWS) ** 1.4;
    const left = Math.min(1, along / 0.02) * (1 - along) ** 1.3;
    return Arr.map(Arr.range(0, COLUMNS), (column) => {
      const across = column / COLUMNS;
      return {
        color: [1, 1, 1, left],
        position: [-along, 0, (across * 2 - 1) * (STERN + along * spread)],
        uv: [along * tiles, across],
      };
    });
  });
  const indices = Arr.flatMap(Arr.range(0, ROWS - 1), (row) =>
    Arr.flatMap(Arr.range(0, COLUMNS - 1), (column) => {
      const a = row * (COLUMNS + 1) + column;
      const b = a + COLUMNS + 1;
      return [a, b, a + 1, a + 1, b, b + 1];
    })
  );
  return {
    colors: Arr.flatMap(vertices, (vertex) => vertex.color),
    indices,
    positions: Arr.flatMap(vertices, (vertex) => vertex.position),
    uvs: Arr.flatMap(vertices, (vertex) => vertex.uv),
  };
}
