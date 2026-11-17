import { Array as Arr } from "effect";

/**
 * The half-width of a simple, pointed leaf at `u` of the way from its base
 * (0) to its tip (1), as a share of its widest half-width: it swells quickly
 * from the petiole, is widest a little below the middle, and narrows to a
 * fine tip.
 */
export function leafHalfWidth(u: number) {
  return Math.sin(Math.PI * u) ** 0.75 * (1 - 0.35 * u);
}

/**
 * The surface of a leaf blade `length` long and `width` wide at its widest,
 * lying along +x from its base at the origin with its upper surface facing
 * +y, as flat arrays for a buffer geometry. The blade droops by `droop` at
 * its tip and its two halves rise a little from the midrib, as a real leaf's
 * do. `rows` samples run along the leaf, `columns` across it.
 */
export function leafSurface({
  columns,
  droop,
  length,
  rows,
  width,
}: {
  readonly columns: number;
  readonly droop: number;
  readonly length: number;
  readonly rows: number;
  readonly width: number;
}) {
  const positions = Arr.flatMap(Arr.range(0, rows), (row) => {
    const u = row / rows;
    const half = (width / 2) * leafHalfWidth(u);
    return Arr.flatMap(Arr.range(0, columns), (column) => {
      const v = (2 * column) / columns - 1;
      const fold = 0.18 * half * v * v;
      return [u * length, fold - droop * u * u, v * half];
    });
  });
  const indices = Arr.flatMap(Arr.range(0, rows - 1), (row) =>
    Arr.flatMap(Arr.range(0, columns - 1), (column) => {
      const corner = row * (columns + 1) + column;
      const below = corner + columns + 1;
      return [corner, corner + 1, below, corner + 1, below + 1, below];
    })
  );
  return { indices, positions };
}
