// @vitest-environment node
import { describe, expect, it } from "@effect/vitest";
import { idOf } from "@repo/backend/confect/island/blocks";
import { PLANT_KEYS } from "@repo/backend/confect/island/flora";
import { Array as Arr, Option } from "effect";
import { BODY_STRIDE } from "@/lib/island/bodies";
import {
  isPassable,
  isPlantBlock,
  isTallPlant,
  plantBodies,
} from "@/lib/island/plants";
import { cellOf, emptyCells } from "@/lib/island/world";

/** A plant's index in the catalog. */
const indexOf = (key: (typeof PLANT_KEYS)[number]) =>
  Option.getOrThrow(Arr.findFirstIndex(PLANT_KEYS, (plant) => plant === key));

describe("island/plants", () => {
  it("tells plants of the catalog from other blocks, and lets a body push aside only those under a knee", () => {
    expect(isPlantBlock(idOf("rose"))).toBe(true);
    expect(isPlantBlock(idOf("flowers"))).toBe(false);
    expect(isPlantBlock(idOf("stone"))).toBe(false);
    expect(isTallPlant(idOf("rose"))).toBe(true);
    expect(isTallPlant(idOf("tulip"))).toBe(false);
    expect(isTallPlant(idOf("stone"))).toBe(false);
    expect(isPassable(0)).toBe(true);
    expect(isPassable(idOf("tulip"))).toBe(true);
    expect(isPassable(idOf("flowers"))).toBe(true);
    expect(isPassable(idOf("rose"))).toBe(false);
    expect(isPassable(idOf("stone"))).toBe(false);
  });

  it("stands every plant of the world in the middle of its cell, one model a plant, its shadow at its foot", () => {
    const cells = emptyCells();
    cells[cellOf(3, 9, 4)] = idOf("rose");
    cells[cellOf(7, 9, 2)] = idOf("rose");
    cells[cellOf(5, 10, 5)] = idOf("tulip");
    cells[cellOf(6, 9, 6)] = idOf("flowers");
    const bodies = plantBodies(cells);
    expect(Arr.map(bodies, ([model]) => model)).toEqual(
      Arr.sort(
        [
          { _tag: "plant", index: indexOf("rose") },
          { _tag: "plant", index: indexOf("tulip") },
        ],
        (a, b) => (a.index < b.index ? -1 : 1)
      )
    );
    const of = (key: (typeof PLANT_KEYS)[number]) =>
      Arr.chunksOf(
        Array.from(
          Option.getOrThrow(
            Arr.findFirst(bodies, ([model]) => model.index === indexOf(key))
          )[1]
        ),
        BODY_STRIDE
      );
    const roses = of("rose");
    expect(roses).toHaveLength(2);
    for (const [x, y, z, yaw, bob, ground] of roses) {
      expect([x % 1, y, z % 1, bob, ground]).toEqual([0.5, 9, 0.5, 0, 9]);
      expect(yaw).toBeGreaterThanOrEqual(0);
      expect(yaw).toBeLessThan(Math.PI * 2 + 1e-6);
    }
    expect(Arr.take(Option.getOrThrow(Arr.head(of("tulip"))), 3)).toEqual([
      5.5, 10, 5.5,
    ]);
    expect(plantBodies(emptyCells())).toEqual([]);
  });
});
