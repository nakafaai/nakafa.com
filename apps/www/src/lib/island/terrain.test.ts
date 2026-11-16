// @vitest-environment node

import { describe, expect, it } from "@effect/vitest";
import { idOf } from "@repo/backend/confect/island/blocks";
import { PLANT_KEYS } from "@repo/backend/confect/island/flora";
import { SPAN } from "@repo/backend/confect/island/world";
import { Array as Arr } from "effect";
import { columnOf, terrainOf, worldOf } from "@/lib/island/terrain";
import { blockAt, SEA_LEVEL } from "@/lib/island/world";

/** How many cells of the world hold this block. */
const countOf = (cells: Uint8Array, id: number) =>
  cells.reduce((count, block) => count + (block === id ? 1 : 0), 0);

describe("island/terrain", () => {
  it("lays flat village ground at the middle and keeps the sea at the edges", () => {
    const cells = terrainOf(11, 44);
    const middle = SPAN / 2;
    expect(blockAt(cells, middle, SEA_LEVEL, middle)).toBe(idOf("path"));
    expect(blockAt(cells, middle, SEA_LEVEL - 1, middle)).toBe(idOf("dirt"));
    expect(blockAt(cells, middle, 0, middle)).toBe(idOf("stone"));
    expect(blockAt(cells, 1, SEA_LEVEL - 1, 1)).toBe(idOf("water"));
    expect(blockAt(cells, 1, SEA_LEVEL, 1)).toBe(0);
  });

  it("opens every world on a finished village: a well, cottages with doors on a path, a garden and lamps, all standing on the ground", () => {
    const cells = terrainOf(11, 44);
    const middle = SPAN / 2;
    const floor = SEA_LEVEL + 1;
    expect(blockAt(cells, middle, floor, middle)).toBe(idOf("water"));
    expect(blockAt(cells, middle + 1, floor, middle)).toBe(idOf("cobble"));
    expect(blockAt(cells, middle - 3, floor + 2, middle - 3)).toBe(
      idOf("lantern")
    );
    const door = { x: middle - 7, z: middle - 4 };
    expect(blockAt(cells, door.x, floor, door.z)).toBe(0);
    expect(blockAt(cells, door.x, floor + 1, door.z)).toBe(0);
    expect(blockAt(cells, door.x, floor + 2, door.z)).toBe(idOf("plaster"));
    expect(blockAt(cells, door.x, SEA_LEVEL, door.z + 1)).toBe(idOf("path"));
    expect(blockAt(cells, door.x - 3, floor, door.z)).toBe(idOf("log"));
    expect(blockAt(cells, middle - 7, floor, middle + 5)).toBe(idOf("rice"));
    expect(blockAt(cells, middle - 7, floor, middle + 7)).toBe(idOf("corn"));
    for (let z = 0; z < SPAN; z += 1) {
      for (let x = 0; x < SPAN; x += 1) {
        const built = blockAt(cells, x, floor, z);
        if (built === idOf("plaster") || built === idOf("cobble")) {
          expect(blockAt(cells, x, SEA_LEVEL, z)).not.toBe(0);
        }
      }
    }
  });

  it("lines the shore with sand and grows trees and flowers inland", () => {
    const cells = terrainOf(11, 44);
    expect(countOf(cells, idOf("sand"))).toBeGreaterThan(0);
    expect(countOf(cells, idOf("log"))).toBeGreaterThan(0);
    expect(countOf(cells, idOf("leaves"))).toBeGreaterThan(0);
    expect(
      countOf(cells, idOf("flowers")) +
        Arr.reduce(PLANT_KEYS, 0, (sum, key) => sum + countOf(cells, idOf(key)))
    ).toBeGreaterThan(0);
  });

  it("grows a wider island at a wider footprint, the same from the same seed", () => {
    const small = terrainOf(5, 44);
    const large = terrainOf(5, 64);
    expect(countOf(large, idOf("grass"))).toBeGreaterThan(
      countOf(small, idOf("grass"))
    );
    expect(terrainOf(5, 44)).toEqual(small);
  });

  it("slopes the sea floor down away from the island", () => {
    const near = columnOf(3, 44, 32, 32 - 13);
    const far = columnOf(3, 44, 32, 1);
    expect(near.land || near.top >= far.top).toBe(true);
    expect(far).toEqual({ land: false, top: SEA_LEVEL - 5 });
  });

  it("lays the learner's edits over the terrain, emptied cells included", () => {
    const middle = SPAN / 2;
    const cells = worldOf(11, 44, [
      { block: idOf("planks"), x: middle, y: SEA_LEVEL + 1, z: middle },
      { block: 0, x: middle, y: SEA_LEVEL, z: middle },
    ]);
    expect(blockAt(cells, middle, SEA_LEVEL + 1, middle)).toBe(idOf("planks"));
    expect(blockAt(cells, middle, SEA_LEVEL, middle)).toBe(0);
  });

  it("holds a pond in the meadow of every island, well inside its shore, a block under the ground", () => {
    for (const seed of [7, 11, 2026]) {
      const cells = terrainOf(seed, 64);
      const pond = Arr.filter(
        Arr.flatMap(
          Arr.makeBy(SPAN, (z) => z),
          (z) => Arr.makeBy(SPAN, (x) => [x, z] as const)
        ),
        ([x, z]) =>
          Math.hypot(x + 0.5 - SPAN / 2, z + 0.5 - SPAN / 2) < 21 &&
          blockAt(cells, x, SEA_LEVEL - 1, z) === idOf("water")
      );
      expect(pond.length).toBeGreaterThan(4);
      for (const [x, z] of pond) {
        expect(blockAt(cells, x, SEA_LEVEL, z)).toBe(0);
      }
    }
  });
});
