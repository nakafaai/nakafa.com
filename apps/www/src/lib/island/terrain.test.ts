// @vitest-environment node
import { describe, expect, it } from "@effect/vitest";
import { idOf } from "@repo/backend/confect/island/blocks";
import { columnOf, terrainOf } from "@/lib/island/terrain";
import { blockAt, SEA_LEVEL, SPAN } from "@/lib/island/world";

/** How many cells of the world hold this block. */
const countOf = (cells: Uint8Array, id: number) =>
  cells.reduce((count, block) => count + (block === id ? 1 : 0), 0);

describe("island/terrain", () => {
  it("raises a meadow of grass at the middle and keeps the sea at the edges", () => {
    const cells = terrainOf(11, 24);
    const middle = SPAN / 2;
    expect(blockAt(cells, middle, SEA_LEVEL, middle)).toBe(idOf("grass"));
    expect(blockAt(cells, middle, SEA_LEVEL - 1, middle)).toBe(idOf("dirt"));
    expect(blockAt(cells, middle, 0, middle)).toBe(idOf("stone"));
    expect(blockAt(cells, 1, SEA_LEVEL - 1, 1)).toBe(idOf("water"));
    expect(blockAt(cells, 1, SEA_LEVEL, 1)).toBe(0);
  });

  it("lines the shore with sand and grows trees and flowers inland", () => {
    const cells = terrainOf(11, 32);
    expect(countOf(cells, idOf("sand"))).toBeGreaterThan(0);
    expect(countOf(cells, idOf("log"))).toBeGreaterThan(0);
    expect(countOf(cells, idOf("leaves"))).toBeGreaterThan(
      countOf(cells, idOf("log"))
    );
    expect(countOf(cells, idOf("flowers"))).toBeGreaterThan(0);
  });

  it("grows a wider island at a wider footprint, the same from the same seed", () => {
    const small = terrainOf(5, 16);
    const large = terrainOf(5, 48);
    expect(countOf(large, idOf("grass"))).toBeGreaterThan(
      countOf(small, idOf("grass"))
    );
    expect(terrainOf(5, 16)).toEqual(small);
  });

  it("slopes the sea floor down away from the island", () => {
    const near = columnOf(3, 24, 32, 32 - 13);
    const far = columnOf(3, 24, 32, 1);
    expect(near.land || near.top >= far.top).toBe(true);
    expect(far).toEqual({ land: false, top: SEA_LEVEL - 5 });
  });
});
