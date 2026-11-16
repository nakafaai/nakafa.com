// @vitest-environment node

import { describe, expect, it } from "@effect/vitest";
import { idOf } from "@repo/backend/confect/island/blocks";
import { SPAN } from "@repo/backend/confect/island/world";
import { Array as Arr, MutableHashSet } from "effect";
import { GROUND_SLOT, GROUND_TILES } from "@/lib/island/atlas";
import {
  columnsOf,
  groundOf,
  groundTopSlot,
  skylineOf,
  wangOf,
} from "@/lib/island/ground";
import { terrainOf } from "@/lib/island/terrain";
import { WANG_EDGES, WANG_SET } from "@/lib/island/tiles/wang";
import { cellOf, emptyCells, SEA_LEVEL } from "@/lib/island/world";

/** Whether a tile's index marks one edge. */
const marks = (index: number, edge: number) =>
  Math.floor(index / edge) % 2 === 1;

describe("island/ground", () => {
  it("numbers each ground block by its set's place, later grounds over earlier ones, and no other block", () => {
    expect(groundOf(idOf("sand"))).toBe(1);
    expect(groundOf(idOf("dirt"))).toBe(2);
    expect(groundOf(idOf("path"))).toBe(3);
    expect(groundOf(idOf("grass"))).toBe(GROUND_TILES.length);
    expect(groundOf(idOf("stone"))).toBe(0);
    expect(groundOf(idOf("water"))).toBe(0);
    expect(groundOf(0)).toBe(0);
  });

  it("reads every edge alike from the two tops that share it, so a mark drawn across it joins", () => {
    for (let z = 0; z < SPAN - 1; z += 1) {
      for (let x = 0; x < SPAN - 1; x += 1) {
        expect(marks(wangOf(x, z), WANG_EDGES.east)).toBe(
          marks(wangOf(x + 1, z), WANG_EDGES.west)
        );
        expect(marks(wangOf(x, z), WANG_EDGES.south)).toBe(
          marks(wangOf(x, z + 1), WANG_EDGES.north)
        );
      }
    }
  });

  it("draws every tile of a set somewhere on an island, each top from its own ground's set", () => {
    const used = MutableHashSet.empty<number>();
    for (let column = 0; column < SPAN * SPAN; column += 1) {
      MutableHashSet.add(
        used,
        wangOf(column % SPAN, Math.floor(column / SPAN))
      );
    }
    expect(MutableHashSet.size(used)).toBe(WANG_SET);
    expect(groundTopSlot(1, 7, 9)).toBe(GROUND_SLOT + wangOf(7, 9));
    expect(groundTopSlot(GROUND_TILES.length, 7, 9)).toBe(
      GROUND_SLOT + (GROUND_TILES.length - 1) * WANG_SET + wangOf(7, 9)
    );
  });

  it("reads the skyline of every column, -1 where nothing stops the sky", () => {
    expect(skylineOf(emptyCells())[0]).toBe(-1);
    expect(
      skylineOf(terrainOf(2, 32))[(SPAN / 2) * SPAN + SPAN / 2]
    ).toBeGreaterThanOrEqual(8);
  });

  it("stops a drop on the first thing over a column, so a roof keeps the ground under it dry", () => {
    const cells = emptyCells();
    cells[cellOf(4, 8, 4)] = idOf("grass");
    cells[cellOf(5, 8, 4)] = idOf("grass");
    cells[cellOf(5, 12, 4)] = idOf("planks");
    cells[cellOf(6, 7, 4)] = idOf("water");
    cells[cellOf(7, 8, 4)] = idOf("grass");
    cells[cellOf(7, 9, 4)] = idOf("flowers");
    const columns = columnsOf(cells);
    const roofAt = (x: number, z: number) => columns[(z * SPAN + x) * 2];
    // Open grass: the drop lands on its top, at 9.
    expect(roofAt(4, 4)).toBe(9 * 2);
    // Under the plank roof the drop stops on the roof, at 13, and never reaches the grass.
    expect(roofAt(5, 4)).toBe(13 * 2);
    // On water it stops at the surface and rings.
    expect(roofAt(6, 4)).toBe(8 * 2 + 1);
    // A flower stands in the rain.
    expect(roofAt(7, 4)).toBe(9 * 2);
    // An empty column is open to the sea.
    expect(roofAt(0, 0)).toBe(SEA_LEVEL * 2 + 1);
  });

  it("gives each column the ground of its top, and none under a roof, on water or over the sea", () => {
    const cells = emptyCells();
    cells[cellOf(4, 8, 4)] = idOf("grass");
    cells[cellOf(5, 8, 4)] = idOf("path");
    cells[cellOf(6, 8, 4)] = idOf("sand");
    cells[cellOf(7, 8, 4)] = idOf("grass");
    cells[cellOf(7, 12, 4)] = idOf("planks");
    cells[cellOf(8, 7, 4)] = idOf("water");
    const columns = columnsOf(cells);
    const groundAt = (x: number, z: number) => columns[(z * SPAN + x) * 2 + 1];
    expect(Arr.map([4, 5, 6, 7, 8], (x) => groundAt(x, 4))).toEqual([
      groundOf(idOf("grass")),
      groundOf(idOf("path")),
      groundOf(idOf("sand")),
      0,
      0,
    ]);
    expect(groundAt(0, 0)).toBe(0);
  });
});
