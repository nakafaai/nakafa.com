// @vitest-environment node
import { describe, expect, it } from "@effect/vitest";
import { idOf } from "@repo/backend/confect/island/blocks";
import { MutableHashMap, Option } from "effect";
import type { Edit } from "@/lib/island/edits";
import {
  cropOf,
  GROW,
  hoeOf,
  ripeningOf,
  ripenOf,
  sownOf,
  waterOf,
} from "@/lib/island/farming";
import { blockAt, cellOf, emptyCells } from "@/lib/island/world";

/** A meadow of grass at y = 8, with a rose at (6, 9, 6) and stone over (7, 8, 7). */
function meadow() {
  const cells = emptyCells();
  for (let z = 0; z < 16; z += 1) {
    for (let x = 0; x < 16; x += 1) {
      cells[cellOf(x, 8, z)] = idOf("grass");
    }
  }
  cells[cellOf(6, 9, 6)] = idOf("rose");
  cells[cellOf(7, 9, 7)] = idOf("stone");
  return cells;
}

/** Writes edits into the world, as the store does. */
function apply(cells: Uint8Array, edits: readonly Edit[]) {
  for (const edit of edits) {
    cells[cellOf(edit.x, edit.y, edit.z)] = edit.after;
  }
}

describe("island/farming", () => {
  it("tills grass into farmland and clears a wild plant over it, but not under a stone", () => {
    const cells = meadow();
    const tilled = hoeOf(cells, [6, 8, 6]);
    expect(Option.map(tilled, (edits) => edits.length)).toEqual(Option.some(2));
    Option.map(tilled, (edits) => apply(cells, edits));
    expect(blockAt(cells, 6, 8, 6)).toBe(idOf("farmland"));
    expect(blockAt(cells, 6, 9, 6)).toBe(0);
    expect(hoeOf(cells, [7, 8, 7])).toEqual(Option.none());
    expect(hoeOf(cells, [7, 9, 7])).toEqual(Option.none());
  });

  it("sows a crop placed on farmland as its sprout, waters the soil, ripens it after its time, and harvests it with the hoe", () => {
    const cells = meadow();
    Option.map(hoeOf(cells, [3, 8, 3]), (edits) => apply(cells, edits));
    expect(sownOf(cells, [3, 9, 3], idOf("corn"))).toBe(idOf("corn-sprout"));
    expect(sownOf(cells, [4, 9, 4], idOf("corn"))).toBe(idOf("corn"));
    expect(sownOf(cells, [3, 9, 3], idOf("rose"))).toBe(idOf("rose"));
    cells[cellOf(3, 9, 3)] = idOf("corn-sprout");
    expect(ripenOf(cells, [3, 9, 3], GROW)).toEqual(Option.none());
    Option.map(waterOf(cells, [3, 9, 3]), (edit) => apply(cells, [edit]));
    expect(blockAt(cells, 3, 8, 3)).toBe(idOf("wet-farmland"));
    expect(waterOf(cells, [3, 8, 3])).toEqual(Option.none());
    expect(ripenOf(cells, [3, 9, 3], GROW - 1)).toEqual(Option.none());
    const planted = MutableHashMap.empty<number, number>();
    expect(ripeningOf(cells, planted, 100)).toEqual([]);
    const ripe = ripeningOf(cells, planted, 100 + GROW);
    apply(cells, ripe);
    expect(blockAt(cells, 3, 9, 3)).toBe(idOf("corn"));
    expect(blockAt(cells, 3, 8, 3)).toBe(idOf("farmland"));
    expect(cropOf(idOf("corn"))).toEqual(Option.some(["corn", "corn-sprout"]));
    const harvest = hoeOf(cells, [3, 9, 3]);
    expect(Option.map(harvest, (edits) => edits[0].after)).toEqual(
      Option.some(0)
    );
  });

  it("sows and harvests on wet farmland too, and leaves a crop standing on grass to the pickaxe", () => {
    const cells = meadow();
    cells[cellOf(2, 8, 2)] = idOf("wet-farmland");
    expect(sownOf(cells, [2, 9, 2], idOf("rice"))).toBe(idOf("rice-sprout"));
    cells[cellOf(2, 9, 2)] = idOf("rice");
    expect(
      Option.map(hoeOf(cells, [2, 9, 2]), (edits) => edits[0].after)
    ).toEqual(Option.some(0));
    cells[cellOf(4, 9, 4)] = idOf("rice");
    expect(hoeOf(cells, [4, 9, 4])).toEqual(Option.none());
  });
});
