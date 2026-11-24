// @vitest-environment node

import { describe, expect, it } from "@effect/vitest";
import { topOf } from "@repo/design-system/components/contents/biology/equipment/framing";
import type { Equipment } from "@repo/design-system/components/contents/biology/equipment/places";
import {
  BENCH,
  BENCH_TOP,
  categoriesOf,
  categoryOf,
  firstIn,
  isEquipment,
  itemsIn,
  nextItem,
  PLACES,
  WALLS,
} from "@repo/design-system/components/contents/biology/equipment/places";
import { Array as Arr, Order, Record as Rec } from "effect";

/** The items the laboratory rules lesson picks, in its order. */
const LESSON = [
  "beaker",
  "measuringCylinder",
  "petriDish",
  "inoculatingLoop",
  "bunsenBurner",
  "microscope",
  "labCoat",
  "goggles",
  "gloves",
  "mask",
  "eyewash",
  "fireBlanket",
  "extinguisher",
  "firstAid",
  "fumeChamber",
] as const satisfies readonly [Equipment, ...Equipment[]];

/** The items that stand or lie on the bench top. */
const ON_BENCH = Arr.filter(
  Rec.keys(PLACES),
  (item) => PLACES[item].base[1] >= BENCH_TOP && PLACES[item].base[1] < 0.92
);

/** Whether the footprints of two items on the bench overlap, seen from above. */
function overlaps(first: Equipment, second: Equipment) {
  const a = PLACES[first];
  const b = PLACES[second];
  return (
    Math.abs(a.base[0] - b.base[0]) < (a.size[0] + b.size[0]) / 2 &&
    Math.abs(a.base[2] - b.base[2]) < (a.size[2] + b.size[2]) / 2
  );
}

describe("lab equipment places", () => {
  it("sorts the lesson's items into the three groups, in the card's order", () => {
    expect(categoryOf("beaker")).toBe("apparatus");
    expect(categoryOf("goggles")).toBe("protective");
    expect(categoryOf("eyewash")).toBe("safety");
    expect(categoriesOf(LESSON)).toEqual(["apparatus", "protective", "safety"]);
    expect(categoriesOf(["fumeChamber", "beaker"])).toEqual([
      "apparatus",
      "safety",
    ]);
    expect(itemsIn(LESSON, "protective")).toEqual([
      "labCoat",
      "goggles",
      "gloves",
      "mask",
    ]);
  });

  it("knows an item's name from any other value", () => {
    expect(isEquipment("eyewash")).toBe(true);
    expect(isEquipment("kettle")).toBe(false);
    expect(isEquipment(undefined)).toBe(false);
  });

  it("turns to the first picked item of a group, or the first item when the group holds none", () => {
    expect(firstIn(LESSON, "safety")).toBe("eyewash");
    expect(firstIn(["beaker", "slide"], "safety")).toBe("beaker");
  });

  it("tours the picked items in order and starts again after the last", () => {
    expect(nextItem(LESSON, "beaker")).toBe("measuringCylinder");
    expect(nextItem(LESSON, "fumeChamber")).toBe("beaker");
    expect(nextItem(LESSON, "slide")).toBe("beaker");
  });

  it("stands the bench at the EN 13150 standing height and every bench item at its real size", () => {
    expect(BENCH_TOP).toBe(0.9);
    expect(PLACES.beaker.size).toEqual([0.07, 0.095, 0.07]);
    expect(PLACES.testTube.size[1]).toBe(0.15);
    expect(PLACES.petriDish.size).toEqual([0.09, 0.015, 0.09]);
    expect(PLACES.slide.size[0]).toBe(0.076);
  });

  it("mounts the eyewash nozzles and the extinguisher handle where the codes ask", () => {
    const nozzles = topOf("eyewash")[1];
    expect(nozzles).toBeGreaterThanOrEqual(0.838);
    expect(nozzles).toBeLessThanOrEqual(1.346);
    expect(topOf("extinguisher")[1]).toBeCloseTo(1, 1);
  });

  it("keeps every bench item on the bench and clear of every other one", () => {
    for (const item of ON_BENCH) {
      const { base, size } = PLACES[item];
      expect(base[0] - size[0] / 2).toBeGreaterThan(WALLS.side);
      expect(base[0] + size[0] / 2).toBeLessThan(BENCH.right);
      expect(base[2] - size[2] / 2).toBeGreaterThan(WALLS.back);
      expect(base[2] + size[2] / 2).toBeLessThan(BENCH.front);
    }
    const clashes = Arr.flatMap(ON_BENCH, (first, index) =>
      Arr.flatMap(Arr.drop(ON_BENCH, index + 1), (second) =>
        overlaps(first, second) ? [[first, second]] : []
      )
    );
    // The burner stands under the tripod's ring by design.
    expect(clashes).toEqual([["bunsenBurner", "tripod"]]);
  });

  it("hangs the wall equipment side by side without touching", () => {
    const wall = Arr.sort(
      Arr.map(
        [
          "labCoat",
          "goggles",
          "firstAid",
          "fireBlanket",
          "extinguisher",
        ] as const,
        (item) =>
          [
            PLACES[item].base[2] - PLACES[item].size[2] / 2,
            PLACES[item].base[2] + PLACES[item].size[2] / 2,
          ] as const
      ),
      Order.mapInput(Order.Number, (span: readonly [number, number]) => span[0])
    );
    for (const [before, after] of Arr.zip(wall, Arr.drop(wall, 1))) {
      expect(after[0]).toBeGreaterThan(before[1]);
    }
  });
});
