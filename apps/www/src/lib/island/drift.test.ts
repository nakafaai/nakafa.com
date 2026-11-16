// @vitest-environment node

import { describe, expect, it } from "@effect/vitest";
import { idOf } from "@repo/backend/confect/island/blocks";
import { PLANT_KEYS } from "@repo/backend/confect/island/flora";
import { Array as Arr } from "effect";
import { butterfliesOf, crownsOf, shedOf } from "@/lib/island/drift";
import { colorOf } from "@/lib/island/palette";
import { cellOf, emptyCells } from "@/lib/island/world";

describe("island/drift", () => {
  it("lets leaves fall from the underside of a crown, with the ground under it, and from nowhere else", () => {
    const cells = emptyCells();
    cells[cellOf(10, 8, 10)] = idOf("grass");
    cells[cellOf(10, 9, 10)] = idOf("log");
    cells[cellOf(10, 10, 10)] = idOf("log");
    // The crown sits on the trunk; its one overhang lets leaves go.
    cells[cellOf(10, 11, 10)] = idOf("leaves");
    cells[cellOf(11, 11, 10)] = idOf("leaves");
    cells[cellOf(10, 12, 10)] = idOf("leaves");
    // A crown over an empty column lets its leaves fall to the sea floor.
    cells[cellOf(30, 12, 30)] = idOf("leaves");
    expect(Arr.fromIterable(crownsOf(cells))).toEqual([
      11.5, 11, 10.5, 0, 30.5, 12, 30.5, 0,
    ]);
    cells[cellOf(11, 8, 10)] = idOf("grass");
    expect(Arr.take(Arr.fromIterable(crownsOf(cells)), 4)).toEqual([
      11.5, 11, 10.5, 9,
    ]);
  });

  it("sheds most in autumn in its orange, blossom in spring, and nothing in winter", () => {
    const autumn = shedOf("autumn");
    const spring = shedOf("spring");
    expect(autumn.share).toBeGreaterThan(spring.share);
    expect(shedOf("winter").share).toBe(0);
    expect(spring.color).toEqual([240 / 255, 166 / 255, 191 / 255]);
    expect(shedOf("summer").color).toEqual(
      Arr.map(colorOf("leaf", 2), (channel) => channel / 255)
    );
  });

  it("homes a butterfly over about one flower in three, the same flowers for the same seed", () => {
    const cells = emptyCells();
    for (let x = 0; x < 60; x += 1) {
      cells[cellOf(x, 9, 5)] = idOf("flowers");
      cells[cellOf(x, 9, 7)] = idOf(PLANT_KEYS[0]);
      cells[cellOf(x, 9, 9)] = idOf("grass");
    }
    const homes = butterfliesOf(cells, 4);
    const flowers = homes.length / 3;
    expect(flowers).toBeGreaterThan(20);
    expect(flowers).toBeLessThan(60);
    expect(
      Arr.every(
        Arr.makeBy(flowers, (index) => homes[index * 3 + 2]),
        (z) => z === 5.5 || z === 7.5
      )
    ).toBe(true);
    expect(butterfliesOf(cells, 4)).toEqual(homes);
  });
});
