// @vitest-environment node
import { describe, expect, it } from "@effect/vitest";
import { idOf } from "@repo/backend/confect/island/blocks";
import { SPAN } from "@repo/backend/confect/island/world";
import { Array as Arr, Option } from "effect";
import { isleGround, islesOf } from "@/lib/island/isles";
import { SHORE_FROM, SHORE_SIDE, shoreOf } from "@/lib/island/shore";
import { cellOf, emptyCells, SEA_LEVEL } from "@/lib/island/world";

/** How near land the map says the world column (x, z) is. */
function nearAt(map: Uint8Array, x: number, z: number) {
  return map[(z - SHORE_FROM) * SHORE_SIDE + (x - SHORE_FROM)];
}

describe("island/shore", () => {
  it("covers the learner's island and every isle of the ring", () => {
    // The surf reaches three cells out, and every stamp must stay inside the map.
    expect(SHORE_FROM).toBeLessThan(-3);
    expect(SHORE_FROM + SHORE_SIDE).toBeGreaterThan(SPAN + 3);
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

  it("is full on a column that fills the layer under the surface, fades over the water round it, and is empty in open sea", () => {
    const cells = emptyCells();
    cells[cellOf(20, SEA_LEVEL - 1, 30)] = idOf("sand");
    const map = shoreOf(cells, 7, false);
    expect(map).toHaveLength(SHORE_SIDE * SHORE_SIDE);
    expect(nearAt(map, 20, 30)).toBe(255);
    expect(nearAt(map, 21, 30)).toBe(191);
    expect(nearAt(map, 23, 30)).toBe(64);
    expect(nearAt(map, 24, 30)).toBe(0);
    expect(nearAt(map, 40, 40)).toBe(0);
  });

  it("takes water and a block under the surface for sea, not for land", () => {
    const cells = emptyCells();
    cells[cellOf(20, SEA_LEVEL - 1, 30)] = idOf("water");
    cells[cellOf(40, SEA_LEVEL - 2, 30)] = idOf("stone");
    expect(
      Arr.every(
        Arr.fromIterable(shoreOf(cells, 7, false)),
        (near) => near === 0
      )
    ).toBe(true);
  });

  it("keeps the nearness of land that reaches the map's own edge inside the map", () => {
    const cells = emptyCells();
    cells[cellOf(0, SEA_LEVEL - 1, 0)] = idOf("sand");
    cells[cellOf(SPAN - 1, SEA_LEVEL - 1, SPAN - 1)] = idOf("sand");
    const map = shoreOf(cells, 7, false);
    expect(nearAt(map, 0, 0)).toBe(255);
    expect(nearAt(map, SPAN - 1, SPAN - 1)).toBe(255);
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
      expect(nearAt(ringed, x, z)).toBe(255);
      expect(nearAt(alone, x, z)).toBe(0);
    }
  });
});
