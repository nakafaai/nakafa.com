// @vitest-environment node

import { describe, expect, it } from "@effect/vitest";
import {
  cellOf,
  DIVIDER,
  gridLayout,
  gridShape,
  sortLayout,
  TILE,
} from "@repo/design-system/components/contents/mathematics/counterexample/layout";
import { Array as Arr } from "effect";

/** How far a tile's middle stands from the next one's. */
const PITCH = TILE.side + TILE.gap;

describe("the grid of tiles", () => {
  it("lays the tiles in rows about as wide as they are deep", () => {
    expect(gridShape(1)).toEqual({ columns: 1, rows: 1 });
    expect(gridShape(3)).toEqual({ columns: 3, rows: 1 });
    expect(gridShape(12)).toEqual({ columns: 4, rows: 3 });
    expect(gridShape(16)).toEqual({ columns: 4, rows: 4 });
    expect(gridShape(20)).toEqual({ columns: 5, rows: 4 });
  });

  it("reads row by row from the back, centring a short last row", () => {
    const { board, places } = gridLayout(5);
    expect(places).toHaveLength(5);
    expect(Arr.getUnsafe(places, 0)).toEqual({ x: -PITCH, z: -PITCH / 2 });
    expect(Arr.getUnsafe(places, 2)).toEqual({ x: PITCH, z: -PITCH / 2 });
    expect(Arr.getUnsafe(places, 3).x).toBeCloseTo(-PITCH / 2);
    expect(Arr.getUnsafe(places, 4)).toEqual({ x: PITCH / 2, z: PITCH / 2 });
    expect(board.width).toBeCloseTo(3 * TILE.side + 2 * TILE.gap + 0.07);
    expect(board.depth).toBeCloseTo(2 * TILE.side + TILE.gap + 0.07);
  });
});

describe("the case board", () => {
  it("puts p true at the back, q true on the left", () => {
    expect(cellOf({ p: true, q: true })).toBe(0);
    expect(cellOf({ p: true, q: false })).toBe(1);
    expect(cellOf({ p: false, q: true })).toBe(2);
    expect(cellOf({ p: false, q: false })).toBe(3);
  });

  it("sizes four equal cells for the fullest one and keeps each tile in its cell", () => {
    const cases = [
      { p: false, q: false },
      { p: true, q: false },
      { p: false, q: false },
      { p: false, q: false },
      { p: false, q: false },
      { p: true, q: true },
    ];
    const sort = sortLayout(cases);
    expect(sort.places).toHaveLength(cases.length);
    expect(sort.cell.width).toBeCloseTo(2 * TILE.side + TILE.gap + 0.044);
    expect(sort.board.width).toBeCloseTo(2 * sort.cell.width + DIVIDER + 0.07);
    Arr.forEach(cases, (each, index) => {
      const place = Arr.getUnsafe(sort.places, index);
      const centre = Arr.getUnsafe(sort.centres, cellOf(each));
      expect(Math.abs(place.x - centre.x)).toBeLessThan(sort.cell.width / 2);
      expect(Math.abs(place.z - centre.z)).toBeLessThan(sort.cell.depth / 2);
    });
    const back = Arr.getUnsafe(sort.places, 1);
    const front = Arr.getUnsafe(sort.places, 0);
    expect(back.z).toBeLessThan(0);
    expect(back.x).toBeGreaterThan(0);
    expect(front.z).toBeGreaterThan(0);
    expect(Arr.getUnsafe(sort.places, 2)).not.toEqual(front);
  });

  it("keeps a cell for every case when there are no tiles", () => {
    const sort = sortLayout([]);
    expect(sort.places).toEqual([]);
    expect(sort.centres).toHaveLength(4);
    expect(sort.cell.width).toBeCloseTo(TILE.side + 0.044);
  });
});
