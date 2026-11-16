// @vitest-environment node
import { describe, expect, it } from "@effect/vitest";
import { idOf } from "@repo/backend/confect/island/blocks";
import { SPAN } from "@repo/backend/confect/island/world";
import { Array as Arr, Option } from "effect";
import { isleGround, islesOf } from "@/lib/island/isles";
import {
  SHORE_FROM,
  SHORE_REACH,
  SHORE_SIDE,
  shoreOf,
} from "@/lib/island/shore";
import { cellOf, emptyCells, SEA_LEVEL } from "@/lib/island/world";

/** How far the map says the nearest land is from the world column (x, z), in cells, to the byte's own step. */
function farAt(map: Uint8Array, x: number, z: number) {
  return (
    (map[(z - SHORE_FROM) * SHORE_SIDE + (x - SHORE_FROM)] / 255) * SHORE_REACH
  );
}

describe("island/shore", () => {
  it("covers the learner's island and every isle of the ring", () => {
    // The waves reach sixteen cells out, and the learner's island lies that far inside the map.
    expect(SHORE_FROM).toBeLessThan(-SHORE_REACH);
    expect(SHORE_FROM + SHORE_SIDE).toBeGreaterThan(SPAN + SHORE_REACH);
    for (const isle of islesOf(7)) {
      expect(isle.x - isle.radius * 1.2).toBeGreaterThan(SHORE_FROM + 4);
      expect(isle.x + isle.radius * 1.2).toBeLessThan(
        SHORE_FROM + SHORE_SIDE - 4
      );
      expect(isle.z - isle.radius * 1.2).toBeGreaterThan(SHORE_FROM + 4);
      expect(isle.z + isle.radius * 1.2).toBeLessThan(
        SHORE_FROM + SHORE_SIDE - 4
      );
    }
  });

  it("measures the true distance to the nearest land, from 0 on land to the reach and past it in open sea", () => {
    const cells = emptyCells();
    cells[cellOf(20, SEA_LEVEL - 1, 30)] = idOf("sand");
    const map = shoreOf(cells, 7, false);
    expect(map).toHaveLength(SHORE_SIDE * SHORE_SIDE);
    const step = SHORE_REACH / 255;
    expect(farAt(map, 20, 30)).toBe(0);
    expect(farAt(map, 21, 30)).toBeCloseTo(1, 1);
    expect(farAt(map, 23, 34)).toBeCloseTo(5, 1);
    // Along a diagonal it is the straight line, not the steps along the grid.
    expect(Math.abs(farAt(map, 26, 36) - Math.hypot(6, 6))).toBeLessThan(step);
    expect(farAt(map, 20 + SHORE_REACH + 3, 30)).toBe(SHORE_REACH);
    expect(farAt(map, 120, 120)).toBe(SHORE_REACH);
  });

  it("follows a bay: the water inside a cove lies nearer land than the open sea beside it", () => {
    const cells = emptyCells();
    // A U of sand opening south: the cove at (30, 30) lies two cells from its walls.
    for (const x of [28, 32]) {
      for (const z of [26, 27, 28, 29, 30, 31, 32]) {
        cells[cellOf(x, SEA_LEVEL - 1, z)] = idOf("sand");
      }
    }
    for (const x of [28, 29, 30, 31, 32]) {
      cells[cellOf(x, SEA_LEVEL - 1, 26)] = idOf("sand");
    }
    const map = shoreOf(cells, 7, false);
    expect(farAt(map, 30, 30)).toBeCloseTo(2, 1);
    expect(farAt(map, 37, 30)).toBeCloseTo(5, 1);
  });

  it("takes water and a block under the surface for sea, not for land", () => {
    const cells = emptyCells();
    cells[cellOf(20, SEA_LEVEL - 1, 30)] = idOf("water");
    cells[cellOf(40, SEA_LEVEL - 2, 30)] = idOf("stone");
    expect(
      Arr.every(
        Arr.fromIterable(shoreOf(cells, 7, false)),
        (far) => far === 255
      )
    ).toBe(true);
  });

  it("marks land that reaches the world's own edge", () => {
    const cells = emptyCells();
    cells[cellOf(0, SEA_LEVEL - 1, 0)] = idOf("sand");
    cells[cellOf(SPAN - 1, SEA_LEVEL - 1, SPAN - 1)] = idOf("sand");
    const map = shoreOf(cells, 7, false);
    expect(farAt(map, 0, 0)).toBe(0);
    expect(farAt(map, SPAN - 1, SPAN - 1)).toBe(0);
    expect(farAt(map, -1, 0)).toBeCloseTo(1, 1);
  });

  it("marks the dry ground of the ring's isles only when the ring is asked for", () => {
    const isles = islesOf(7);
    const dry = Arr.flatMap(isles, (isle) =>
      Option.match(
        isleGround(isle, 7, Math.floor(isle.x) + 4, Math.floor(isle.z)),
        {
          onNone: () => [],
          onSome: (ground) =>
            ground.top >= SEA_LEVEL - 1
              ? [[Math.floor(isle.x) + 4, Math.floor(isle.z)] as const]
              : [],
        }
      )
    );
    expect(dry.length).toBeGreaterThan(0);
    const ringed = shoreOf(emptyCells(), 7, true);
    const alone = shoreOf(emptyCells(), 7, false);
    for (const [x, z] of dry) {
      expect(farAt(ringed, x, z)).toBe(0);
      expect(farAt(alone, x, z)).toBe(SHORE_REACH);
    }
  });
});
