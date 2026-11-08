import { Array as Arr, Schema } from "effect";

/** One cell drawn in a frame: its center and its radius, in canvas pixels. */
export const CellSchema = Schema.Struct({
  radius: Schema.Finite,
  x: Schema.Finite,
  y: Schema.Finite,
});
export type Cell = typeof CellSchema.Type;

/** Share of a generation spent growing before the cells divide. */
export const GROWTH_SHARE = 0.6;
/** Share of a grid slot a cell's diameter fills, so neighbours never touch. */
const FILL = 0.72;

/**
 * Places a number of cells on the smallest even grid that fits a box, each
 * in the middle of its slot, filling the box in reading order.
 */
export function cellGrid(count: number, width: number, height: number) {
  if (count <= 0 || width <= 0 || height <= 0) {
    return [];
  }
  const columns = Math.max(1, Math.ceil(Math.sqrt((count * width) / height)));
  const rows = Math.ceil(count / columns);
  const slot = Math.min(width / columns, height / rows);
  const left = (width - columns * slot) / 2;
  const top = (height - rows * slot) / 2;
  return Arr.makeBy(
    count,
    (index): Cell => ({
      radius: (slot * FILL) / 2,
      x: left + ((index % columns) + 0.5) * slot,
      y: top + (Math.floor(index / columns) + 0.5) * slot,
    })
  );
}

/** Eases a share in and out, so a division starts and ends softly. */
function ease(share: number) {
  return share * share * (3 - 2 * share);
}

/** The value a share of the way from one number to another. */
function between(from: number, to: number, share: number) {
  return from + (to - from) * share;
}

/**
 * The cells of one moment of growth. For most of a generation the cells only
 * grow; in its last part every cell divides, and each daughter moves from its
 * parent's place to its own place in the next generation's grid. A daughter's
 * parent is the cell at the same share of the line, so a ratio of three gives
 * each parent three daughters.
 */
export function divisionCells(
  current: number,
  next: number,
  phase: number,
  width: number,
  height: number
) {
  const parents = cellGrid(current, width, height);
  const daughters = cellGrid(next, width, height);
  if (phase < GROWTH_SHARE || next === current) {
    const grown = 1 + 0.12 * Math.min(1, phase / GROWTH_SHARE);
    return Arr.map(parents, (cell) => ({
      ...cell,
      radius: cell.radius * grown,
    }));
  }
  const share = ease((phase - GROWTH_SHARE) / (1 - GROWTH_SHARE));
  return Arr.flatMap(daughters, (daughter, index) =>
    Arr.map(
      Arr.take(Arr.drop(parents, Math.floor((index * current) / next)), 1),
      (parent) => ({
        radius: between(parent.radius * 1.12, daughter.radius, share),
        x: between(parent.x, daughter.x, share),
        y: between(parent.y, daughter.y, share),
      })
    )
  );
}
