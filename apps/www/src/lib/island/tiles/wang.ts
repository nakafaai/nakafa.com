import { Array as Arr, Option, Record as Rec } from "effect";
import type { Ink, Pixels } from "@/lib/island/tiles/paint";
import { put, TILE } from "@/lib/island/tiles/paint";

/**
 * Wang sets for the ground (ADR 0047, D39). Each edge of a ground tile either
 * carries its set's mark or not, so one set holds sixteen tiles, one for each
 * way its four edges can fall. Two neighbours read the edge they share alike,
 * so a mark drawn across it, half in each tile, joins into one: a clover patch
 * or a ripple that crosses the line between two blocks hides the grid, and no
 * two blocks of a meadow look the same.
 */

/** The tiles of one Wang set: every way four edges can each be marked or not. */
export const WANG_SET = 16;

/** The bit of a tile's index that marks each of its edges: north is its first row, west its first column. */
export const WANG_EDGES = { east: 2, north: 1, south: 4, west: 8 } as const;

/** Where a mark sits along its edge: a north or south edge's mark centers on this column, a west or east edge's on this row, so marks never meet at a corner. */
const ALONG = { columns: 9, rows: 5 } as const;

/**
 * A mark that straddles an edge, drawn as rows of characters the way it shows
 * on the ground, its legend naming each character's tone. A row mark lies
 * across a north or south edge, which runs between its rows `split - 1` and
 * `split`; a column mark lies across a west or east edge, between its columns
 * `split - 1` and `split`.
 */
export function markOf(
  split: number,
  rows: readonly string[],
  legend: Readonly<Record<string, Ink>>
) {
  return { legend, rows, split };
}

type Mark = ReturnType<typeof markOf>;

/** Every painted pixel of a mark, as its place across the edge (negative before it), its place along the edge from its middle, and its tone. */
function pixelsOf(mark: Mark, axis: "columns" | "rows") {
  const height = mark.rows.length;
  const width = Arr.reduce(mark.rows, 0, (widest, row) =>
    Math.max(widest, row.length)
  );
  return Arr.flatMap(mark.rows, (row, y) =>
    Arr.flatMap(row.split(""), (character, x) =>
      Option.match(Rec.get(mark.legend, character), {
        onNone: () => [],
        onSome: ([ramp, tone]) => [
          axis === "rows"
            ? {
                across: y - mark.split,
                along: x - Math.floor(width / 2),
                ramp,
                tone,
              }
            : {
                across: x - mark.split,
                along: y - Math.floor(height / 2),
                ramp,
                tone,
              },
        ],
      })
    )
  );
}

/**
 * One tile of a Wang set: the ground painted from its own seed, so every tile
 * of the set differs inside, then the half of each marked edge's mark that
 * falls inside it. Tile 0 marks no edge and is painted from the set's own
 * seed, so it is the tile the block shows in the hand.
 */
export function wangTile(
  paint: (seed: number) => Pixels,
  marks: readonly [rows: Mark, columns: Mark],
  seed: number,
  index: number
) {
  const [rows, columns] = marks;
  const pixels = paint(seed + index * 131);
  // Each edge's bit is a power of two, so it is set when that place of the index is odd.
  const has = (edge: number) => Math.floor(index / edge) % 2 === 1;
  for (const pixel of pixelsOf(rows, "rows")) {
    const x = ALONG.rows + pixel.along;
    if (has(WANG_EDGES.north) && pixel.across >= 0) {
      put(pixels, x, pixel.across, pixel.ramp, pixel.tone);
    }
    if (has(WANG_EDGES.south) && pixel.across < 0) {
      put(pixels, x, TILE + pixel.across, pixel.ramp, pixel.tone);
    }
  }
  for (const pixel of pixelsOf(columns, "columns")) {
    const y = ALONG.columns + pixel.along;
    if (has(WANG_EDGES.west) && pixel.across >= 0) {
      put(pixels, pixel.across, y, pixel.ramp, pixel.tone);
    }
    if (has(WANG_EDGES.east) && pixel.across < 0) {
      put(pixels, TILE + pixel.across, y, pixel.ramp, pixel.tone);
    }
  }
  return pixels;
}
