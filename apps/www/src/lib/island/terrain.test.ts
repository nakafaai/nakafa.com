import { describe, expect, it } from "@effect/vitest";
import { Option, Record } from "effect";
import { RAMPS } from "@/lib/island/palette";
import { BODY_DEPTH, drawTerrain, VOXELS_PER_CELL } from "@/lib/island/terrain";
import { cellOf } from "@/lib/island/voxel";

/** The ramps the body's inner layers and a pond floor are made of. */
const UNDERGROUND = /soil|stone/u;
const FLOOR = /sand|stone/u;

/** The ramp of a stored voxel value. */
function rampOf(value: number | undefined) {
  const row = Math.floor(((value ?? 0) - 1) / 4);
  return Option.getOrUndefined(
    Option.map(
      Record.findFirst(RAMPS, (ramp) => ramp.row === row),
      ([name]) => name
    )
  );
}

describe("island terrain", () => {
  it("cuts a body as wide as the island and as deep as its depth", () => {
    const grid = drawTerrain(6, 7, []);
    expect([grid.width, grid.height, grid.depth]).toEqual([48, BODY_DEPTH, 48]);
    expect(rampOf(grid.cells[cellOf(grid, 20, BODY_DEPTH - 1, 20)])).toBe(
      "grass"
    );
    expect(rampOf(grid.cells[cellOf(grid, 20, 0, 20)])).toBe("stone");
    expect(rampOf(grid.cells[cellOf(grid, 0, 10, 20)])).toMatch(UNDERGROUND);
  });

  it("draws the same body for the same size and seed", () => {
    expect(drawTerrain(6, 7, []).cells).toEqual(drawTerrain(6, 7, []).cells);
  });

  it("empties a pond's hole down to a floor of sand and stones", () => {
    const grid = drawTerrain(6, 7, [{ cells: [3, 3, 3, 3], depth: 12 }]);
    const x = 4 * VOXELS_PER_CELL;
    const floor = BODY_DEPTH - 1 - 12;
    expect(grid.cells[cellOf(grid, x, BODY_DEPTH - 1, x)]).toBe(0);
    expect(grid.cells[cellOf(grid, x, floor + 1, x)]).toBe(0);
    expect(rampOf(grid.cells[cellOf(grid, x, floor, x)])).toMatch(FLOOR);
    expect(
      rampOf(grid.cells[cellOf(grid, 2 * VOXELS_PER_CELL, BODY_DEPTH - 1, 2)])
    ).toBe("grass");
  });
});
