// @vitest-environment node

import { describe, expect, it } from "@effect/vitest";
import { idOf } from "@repo/backend/confect/island/blocks";
import { SPAN } from "@repo/backend/confect/island/world";
import { Array as Arr, Option } from "effect";
import { firefliesOf } from "@/lib/island/night";
import { cellOf, emptyCells } from "@/lib/island/world";

/** A world of grass over every column at layer 8. */
function meadow() {
  const cells = emptyCells();
  for (let z = 0; z < SPAN; z += 1) {
    for (let x = 0; x < SPAN; x += 1) {
      cells[cellOf(x, 8, z)] = idOf("grass");
    }
  }
  return cells;
}

/** The homes of a world as triples. */
const homesOf = (homes: Float32Array) =>
  Arr.chunksOf(Arr.fromIterable(homes), 3);

describe("island/night", () => {
  it("houses about one firefly in forty columns of open grass, the same ones for the same seed", () => {
    const homes = homesOf(firefliesOf(meadow(), 7));
    expect(homes.length).toBeGreaterThan(60);
    expect(homes.length).toBeLessThan(150);
    for (const [, y] of homes) {
      expect(y).toBe(9);
    }
    expect(firefliesOf(meadow(), 7)).toEqual(firefliesOf(meadow(), 7));
    expect(firefliesOf(meadow(), 8)).not.toEqual(firefliesOf(meadow(), 7));
  });

  it("keeps fireflies out from under a roof and off sand", () => {
    const cells = meadow();
    const open = homesOf(firefliesOf(cells, 7));
    const [x, , z] = Option.getOrThrow(Arr.head(open));
    cells[cellOf(x - 0.5, 12, z - 0.5)] = idOf("planks");
    for (let row = 0; row < SPAN; row += 1) {
      cells[cellOf(0, 8, row)] = idOf("sand");
    }
    const roofed = homesOf(firefliesOf(cells, 7));
    expect(roofed.length).toBeLessThan(open.length);
    expect(Arr.some(roofed, ([hx, , hz]) => hx === x && hz === z)).toBe(false);
    expect(Arr.some(roofed, ([hx]) => hx === 0.5)).toBe(false);
  });
});
