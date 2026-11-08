import { describe, expect, it } from "@effect/vitest";
import { Array as Arr, Order } from "effect";
import { paletteIndex } from "@/lib/island/palette";
import { cellOf, drawModel, noise } from "@/lib/island/voxel";

/** The different values a grid holds, in order. */
const valuesOf = (cells: Uint8Array) =>
  Arr.sort(Arr.dedupe(Arr.fromIterable(cells)), Order.Number);

/** The palette value a grid stores for one tone of a ramp. */
const stored = (ramp: Parameters<typeof paletteIndex>[0], tone: number) =>
  paletteIndex(ramp, tone) + 1;

describe("island voxels", () => {
  it("finds a voxel's cell, and none outside the grid", () => {
    const grid = drawModel([2, 3, 4], []);
    expect(cellOf(grid, 1, 2, 3)).toBe((2 * 4 + 3) * 2 + 1);
    expect(cellOf(grid, 2, 0, 0)).toBe(-1);
    expect(cellOf(grid, 0, -1, 0)).toBe(-1);
    expect(cellOf(grid, 0, 0, 4)).toBe(-1);
  });

  it("rolls the same number for the same voxel and seed, always from 0 to 1", () => {
    expect(noise(3, 4, 5, 1)).toBe(noise(3, 4, 5, 1));
    expect(noise(3, 4, 5, 1)).not.toBe(noise(3, 4, 5, 2));
    for (const x of Arr.range(0, 50)) {
      const roll = noise(x, x * 2, -x, 7);
      expect(roll).toBeGreaterThanOrEqual(0);
      expect(roll).toBeLessThan(1);
    }
  });

  it("fills a box, empties a carve and clips both to the grid", () => {
    const grid = drawModel(
      [4, 4, 4],
      [
        {
          _tag: "box",
          from: [-2, 0, 0],
          ramp: "stone",
          to: [9, 1, 3],
          tone: 1,
        },
        { _tag: "carve", from: [1, 0, 1], to: [2, 1, 2] },
      ]
    );
    expect(grid.cells[cellOf(grid, 0, 0, 0)]).toBe(stored("stone", 1));
    expect(grid.cells[cellOf(grid, 3, 1, 3)]).toBe(stored("stone", 1));
    expect(grid.cells[cellOf(grid, 1, 1, 1)]).toBe(0);
    expect(grid.cells[cellOf(grid, 0, 2, 0)]).toBe(0);
  });

  it("narrows a gable by one voxel a layer across its ridge", () => {
    const grid = drawModel(
      [6, 4, 6],
      [
        {
          _tag: "roof",
          axis: "x",
          from: [0, 0, 0],
          ramp: "roof",
          to: [5, 3, 5],
          tone: 2,
        },
      ]
    );
    const across = (y: number) =>
      Arr.filter(
        Arr.range(0, 5),
        (z) => grid.cells[cellOf(grid, 2, y, z)] !== 0
      );
    expect(across(0)).toEqual([0, 1, 2, 3, 4, 5]);
    expect(across(1)).toEqual([1, 2, 3, 4]);
    expect(across(2)).toEqual([2, 3]);
    expect(across(3)).toEqual([]);
    const along = drawModel(
      [6, 2, 6],
      [
        {
          _tag: "roof",
          axis: "z",
          from: [0, 0, 0],
          ramp: "roof",
          to: [5, 1, 5],
          tone: 2,
        },
      ]
    );
    expect(along.cells[cellOf(along, 0, 1, 3)]).toBe(0);
    expect(along.cells[cellOf(along, 1, 1, 3)]).not.toBe(0);
  });

  it("rounds a cylinder and a blob, both inside their bounds", () => {
    const grid = drawModel(
      [9, 9, 9],
      [
        {
          _tag: "cylinder",
          bottom: 0,
          center: [4.5, 4.5],
          radius: 2.4,
          ramp: "wood",
          top: 3,
          tone: 1,
        },
        {
          _tag: "blob",
          center: [4, 7, 4],
          radius: [3, 1, 3],
          ramp: "leaf",
          tone: 2,
        },
      ]
    );
    expect(grid.cells[cellOf(grid, 4, 0, 4)]).toBe(stored("wood", 1));
    expect(grid.cells[cellOf(grid, 0, 0, 0)]).toBe(0);
    expect(grid.cells[cellOf(grid, 4, 7, 4)]).toBe(stored("leaf", 2));
    expect(grid.cells[cellOf(grid, 8, 7, 8)]).toBe(0);
  });

  it("repaints every few voxels of what stands, along any axis, and leaves empty voxels empty", () => {
    for (const axis of ["x", "y", "z"] as const) {
      const grid = drawModel(
        [4, 4, 4],
        [
          {
            _tag: "box",
            from: [0, 0, 0],
            ramp: "wood",
            to: [3, 3, 1],
            tone: 3,
          },
          {
            _tag: "stripe",
            axis,
            every: 2,
            from: [0, 0, 0],
            to: [3, 3, 3],
            tone: 0,
          },
        ]
      );
      expect(grid.cells[cellOf(grid, 0, 0, 0)]).toBe(stored("wood", 0));
      expect(grid.cells[cellOf(grid, 1, 1, 1)]).toBe(stored("wood", 3));
      expect(grid.cells[cellOf(grid, 0, 0, 2)]).toBe(0);
    }
  });

  it("moves jittered voxels one tone up or down and never past the ramp", () => {
    const grid = drawModel(
      [16, 1, 16],
      [
        {
          _tag: "box",
          from: [0, 0, 0],
          jitter: 1,
          ramp: "grass",
          to: [15, 0, 15],
          tone: 0,
        },
      ],
      4
    );
    expect(valuesOf(grid.cells)).toEqual([
      stored("grass", 0),
      stored("grass", 1),
    ]);
    const high = drawModel(
      [16, 1, 16],
      [
        {
          _tag: "box",
          from: [0, 0, 0],
          jitter: 1,
          ramp: "grass",
          to: [15, 0, 15],
          tone: 3,
        },
      ],
      4
    );
    expect(valuesOf(high.cells)).toEqual([
      stored("grass", 2),
      stored("grass", 3),
    ]);
  });
});
