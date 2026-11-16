// @vitest-environment node
import { describe, expect, it } from "@effect/vitest";
import { idOf } from "@repo/backend/confect/island/blocks";
import { Array as Arr, Option } from "effect";
import { pathOf, standOf } from "@/lib/island/path";
import { cellOf, emptyCells } from "@/lib/island/world";

/** A flat floor of grass at y = 8 over the whole world. */
function floor() {
  const cells = emptyCells();
  for (let z = 0; z < 64; z += 1) {
    for (let x = 0; x < 64; x += 1) {
      cells[cellOf(x, 8, z)] = idOf("grass");
    }
  }
  return cells;
}

describe("island/path", () => {
  it("stands a person over the highest floor with room for two blocks, among plants, never on water or off the world", () => {
    const cells = floor();
    expect(standOf(cells, 10, 10)).toEqual(Option.some(9));
    cells[cellOf(11, 9, 10)] = idOf("tulip");
    expect(standOf(cells, 11, 10)).toEqual(Option.some(9));
    cells[cellOf(11, 9, 11)] = idOf("rose");
    expect(standOf(cells, 11, 11)).toEqual(Option.none());
    cells[cellOf(12, 10, 10)] = idOf("planks");
    expect(standOf(cells, 12, 10)).toEqual(Option.some(11));
    cells[cellOf(13, 9, 10)] = idOf("water");
    expect(standOf(cells, 13, 10)).toEqual(Option.none());
    cells[cellOf(14, 8, 10)] = idOf("water");
    expect(standOf(cells, 14, 10)).toEqual(Option.none());
    expect(standOf(cells, -1, 10)).toEqual(Option.none());
    expect(standOf(emptyCells(), 5, 5)).toEqual(Option.none());
  });

  it("walks the shortest way around a wall, up one block a step, and finds no way up two, to nowhere, or out of the water", () => {
    const cells = floor();
    for (let z = 0; z < 20; z += 1) {
      cells[cellOf(20, 9, z)] = idOf("stone");
      cells[cellOf(20, 10, z)] = idOf("stone");
    }
    const around = pathOf(cells, [18, 5], [22, 5]);
    expect(Option.map(around, (route) => route.length)).toEqual(
      Option.some(34)
    );
    expect(Option.flatMap(around, Arr.last)).toEqual(Option.some([22, 5]));
    cells[cellOf(30, 9, 30)] = idOf("dirt");
    expect(
      Option.map(pathOf(cells, [29, 30], [30, 30]), (route) => route.length)
    ).toEqual(Option.some(1));
    cells[cellOf(40, 9, 40)] = idOf("dirt");
    cells[cellOf(40, 10, 40)] = idOf("dirt");
    for (const [x, z] of [
      [39, 40],
      [41, 40],
      [40, 39],
      [40, 41],
    ] as const) {
      cells[cellOf(x, 9, z)] = idOf("water");
      cells[cellOf(x, 8, z)] = idOf("water");
    }
    expect(pathOf(cells, [38, 40], [40, 40])).toEqual(Option.none());
    expect(pathOf(emptyCells(), [1, 1], [2, 2])).toEqual(Option.none());
    expect(pathOf(cells, [39, 40], [22, 5])).toEqual(Option.none());
  });
});
