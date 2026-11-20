import type { Case } from "@repo/design-system/components/contents/mathematics/counterexample/claim";
import { Array as Arr, Schema } from "effect";

/**
 * Where the tiles lie on the felt board, in metres from the board's middle:
 * x to the right, z towards the camera. The tiles lie in a grid, read row by
 * row from the back. On the case board of an implication, they lie in four
 * cells instead, one for each case of p and q: p true at the back, p false at
 * the front, q true on the left, q false on the right.
 */

/** A spot on the board. */
const PlaceSchema = Schema.Struct({ x: Schema.Number, z: Schema.Number });
export type Place = typeof PlaceSchema.Type;

/** The width (along x) and depth (along z) of a board or a cell. */
const SizeSchema = Schema.Struct({
  depth: Schema.Number,
  width: Schema.Number,
});
export type Size = typeof SizeSchema.Type;

/** How many columns and rows of tiles a grid has. */
const ShapeSchema = Schema.Struct({ columns: Schema.Int, rows: Schema.Int });

/** The tiles in a grid on the board, and the board around them. */
const GridSchema = Schema.Struct({
  board: SizeSchema,
  places: Schema.Array(PlaceSchema),
});
type Grid = typeof GridSchema.Type;

/** The tiles sorted into the four cells of the case board, the board, and each cell's size and middle. */
const SortSchema = Schema.Struct({
  board: SizeSchema,
  cell: SizeSchema,
  centres: Schema.Array(PlaceSchema),
  places: Schema.Array(PlaceSchema),
});
export type Sort = typeof SortSchema.Type;

/** A square tile: its side, its thickness, and the felt between two tiles. */
export const TILE = { gap: 0.018, height: 0.012, side: 0.07 } as const;

/** The felt between the outer tiles and the board's rim. */
const MARGIN = 0.035;

/** The felt between a cell's tiles and its edge. */
const CELL_MARGIN = 0.022;

/** The width of the wooden strip between two cells. */
export const DIVIDER = 0.012;

/** How far one tile's middle stands from the next one's. */
const PITCH = TILE.side + TILE.gap;

/** The rows and columns of a grid of tiles: as many rows as fit a square, and as many columns as they need. */
export function gridShape(count: number): typeof ShapeSchema.Type {
  const rows = Math.max(1, Math.floor(Math.sqrt(count)));
  return { columns: Math.max(1, Math.ceil(count / rows)), rows };
}

/** How wide a run of tiles is, from the outer edge of its first to the outer edge of its last. */
function span(tiles: number) {
  return tiles * TILE.side + (tiles - 1) * TILE.gap;
}

/** The middles of `count` tiles in rows of `columns`, centred on the origin, each row centred on its own. */
function blockPlaces(count: number, columns: number): readonly Place[] {
  const rows = Math.ceil(count / columns);
  return Arr.makeBy(count, (index) => {
    const row = Math.floor(index / columns);
    const inRow = Math.min(columns, count - row * columns);
    return {
      x: ((index % columns) - (inRow - 1) / 2) * PITCH,
      z: (row - (rows - 1) / 2) * PITCH,
    };
  });
}

/** The tiles in one grid, read row by row from the back, and the board that holds them. */
export function gridLayout(count: number): Grid {
  const { columns, rows } = gridShape(count);
  return {
    board: {
      depth: span(rows) + 2 * MARGIN,
      width: span(columns) + 2 * MARGIN,
    },
    places: blockPlaces(count, columns),
  };
}

/** The cell of one case: 0 for p and q, 1 for p and not q, 2 for q alone, 3 for neither. */
export function cellOf(each: Case) {
  return (each.p ? 0 : 2) + (each.q ? 0 : 1);
}

/**
 * The tiles sorted into the four cells of the case board, in the order they
 * come. Every cell is as big as the fullest one needs, so the board stays a
 * square of four equal cells, and the tiles of a cell lie in a grid centred in it.
 */
export function sortLayout(cases: readonly Case[]): Sort {
  const cells = Arr.map(cases, cellOf);
  const counts = Arr.makeBy(
    4,
    (cell) => Arr.filter(cells, (each) => each === cell).length
  );
  const { columns, rows } = gridShape(Math.max(1, ...counts));
  const cell = {
    depth: span(rows) + 2 * CELL_MARGIN,
    width: span(columns) + 2 * CELL_MARGIN,
  };
  const centres = Arr.makeBy(4, (index) => ({
    x: ((index % 2) - 0.5) * (cell.width + DIVIDER),
    z: (Math.floor(index / 2) - 0.5) * (cell.depth + DIVIDER),
  }));
  const blocks = Arr.map(counts, (count) => blockPlaces(count, columns));
  const places = Arr.map(cells, (each, index) => {
    const order = Arr.filter(
      Arr.take(cells, index),
      (earlier) => earlier === each
    ).length;
    const spot = Arr.getUnsafe(Arr.getUnsafe(blocks, each), order);
    const centre = Arr.getUnsafe(centres, each);
    return { x: centre.x + spot.x, z: centre.z + spot.z };
  });
  return {
    board: {
      depth: 2 * cell.depth + DIVIDER + 2 * MARGIN,
      width: 2 * cell.width + DIVIDER + 2 * MARGIN,
    },
    cell,
    centres,
    places,
  };
}
