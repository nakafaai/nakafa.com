// @vitest-environment node
import { describe, expect, it } from "@effect/vitest";
import { idOf } from "@repo/backend/confect/island/blocks";
import { Array as Arr, Result } from "effect";
import {
  ITEM_KEYS,
  itemOpensAt,
  itemPlanOf,
  partsOf,
  stampItem,
  turnOf,
} from "@/lib/island/items";
import { SCALE } from "@/lib/island/scale";
import { cellOf, emptyCells } from "@/lib/island/world";

/** How many blocks an item spans along one axis. */
function spanOf(
  parts: readonly ReturnType<typeof partsOf>[number][],
  axis: "x" | "y" | "z"
) {
  const values = Arr.map(parts, (cell) => cell[axis]);
  return Math.max(...values) - Math.min(...values) + 1;
}

/** A flat world of grass whose top row is y = 8, so items stand at y = 9. */
function meadow() {
  const cells = emptyCells();
  for (let z = 0; z < 64; z += 1) {
    for (let x = 0; x < 64; x += 1) {
      cells[cellOf(x, 8, z)] = idOf("grass");
    }
  }
  return cells;
}

describe("island/items", () => {
  it("builds every item at the world's one scale: a cottage taller than a person, a tree about its height, a lamp post", () => {
    const house = partsOf("house", 0);
    const walls = Arr.filter(house, (cell) => cell.y === 0);
    expect(spanOf(walls, "x")).toBe(SCALE.house.width);
    expect(spanOf(walls, "z")).toBe(SCALE.house.depth);
    expect(spanOf(house, "y")).toBe(SCALE.house.height);
    expect(SCALE.house.height).toBeGreaterThan(SCALE.person * 3);
    const tree = spanOf(partsOf("tree", 0), "y");
    expect(tree).toBeGreaterThanOrEqual(SCALE.tree.from);
    expect(tree).toBeLessThanOrEqual(SCALE.tree.to);
    expect(Math.abs(tree - SCALE.house.height)).toBeLessThanOrEqual(1);
    expect(spanOf(partsOf("lamp", 0), "y")).toBe(SCALE.lamp);
    expect(spanOf(partsOf("well", 0), "x")).toBe(3);
  });

  it("leaves a doorway two blocks high in the middle of the cottage's front, and turns it with the item", () => {
    const door = (turn: number) =>
      Arr.filter(
        partsOf("house", turn),
        (cell) =>
          cell.y < SCALE.storey &&
          Math.abs(cell.x) + Math.abs(cell.z) === 2 &&
          (turn % 2 === 0 ? cell.x === 0 : cell.z === 0)
      );
    expect(
      Arr.map(
        Arr.filter(door(0), (cell) => cell.z === 2),
        (cell) => cell.y
      )
    ).toEqual([SCALE.door]);
    expect(
      Arr.map(
        Arr.filter(door(1), (cell) => cell.x === 2),
        (cell) => cell.y
      )
    ).toEqual([SCALE.door]);
    expect(partsOf("tree", 5)).toEqual(partsOf("tree", 1));
  });

  it("faces an item's front to the camera, and opens it at the latest level of its blocks", () => {
    expect(turnOf(0)).toBe(0);
    expect(turnOf(Math.PI / 2)).toBe(1);
    expect(turnOf(Math.PI)).toBe(2);
    expect(turnOf(-Math.PI / 2)).toBe(3);
    expect(Arr.map(ITEM_KEYS, itemOpensAt)).toEqual([3, 1, 3, 4]);
  });

  it("plans an item on open flat ground as one batch from the ground up, and refuses it off the footprint, into a block, or over nothing", () => {
    const cells = meadow();
    const planned = itemPlanOf(cells, "house", [32, 9, 32], 0, 44);
    expect(Result.isSuccess(planned)).toBe(true);
    if (Result.isSuccess(planned)) {
      expect(planned.success).toHaveLength(partsOf("house", 0).length);
      expect(planned.success[0].y).toBe(9);
      expect(Arr.every(planned.success, (edit) => edit.before === 0)).toBe(
        true
      );
    }
    expect(itemPlanOf(cells, "house", [11, 9, 32], 0, 44)).toEqual(
      Result.fail("outside")
    );
    cells[cellOf(32, 12, 32)] = idOf("stone");
    expect(itemPlanOf(cells, "tree", [32, 9, 32], 0, 44)).toEqual(
      Result.fail("room")
    );
    expect(itemPlanOf(cells, "lamp", [20, 14, 20], 0, 44)).toEqual(
      Result.fail("ground")
    );
    cells[cellOf(40, 9, 40)] = idOf("flowers");
    expect(
      Result.isSuccess(itemPlanOf(cells, "lamp", [40, 9, 40], 0, 44))
    ).toBe(true);
  });

  it("stamps an item straight into the world, leaving out what falls outside it", () => {
    const cells = meadow();
    stampItem(cells, "lamp", [5, 9, 5], 0);
    expect(cells[cellOf(5, 11, 5)]).toBe(idOf("lantern"));
    stampItem(cells, "house", [0, 9, 0], 0);
    expect(cells[cellOf(3, 9, 0)]).toBe(idOf("plaster"));
  });
});
