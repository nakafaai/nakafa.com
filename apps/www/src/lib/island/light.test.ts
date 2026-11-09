// @vitest-environment node
import { describe, expect, it } from "@effect/vitest";
import { idOf } from "@repo/backend/confect/island/blocks";
import { SPAN } from "@repo/backend/confect/island/world";
import { Array as Arr, Order } from "effect";
import { changedChunks, glowOf } from "@/lib/island/light";
import { CHUNKS, cellOf, emptyCells } from "@/lib/island/world";

describe("island/light", () => {
  it("lights a lantern's cell fully and dims one level a step through open air", () => {
    const cells = emptyCells();
    cells[cellOf(20, 10, 20)] = idOf("lantern");
    const glow = glowOf(cells);
    expect(glow[cellOf(20, 10, 20)]).toBe(15);
    expect(glow[cellOf(21, 10, 20)]).toBe(14);
    expect(glow[cellOf(20, 13, 22)]).toBe(10);
    expect(glow[cellOf(40, 10, 20)]).toBe(0);
  });

  it("stops at solid walls but shines through glass, and never wraps around the world's edge", () => {
    const cells = emptyCells();
    cells[cellOf(10, 10, 10)] = idOf("lantern");
    cells[cellOf(11, 10, 10)] = idOf("stone");
    cells[cellOf(9, 10, 10)] = idOf("glass");
    const glow = glowOf(cells);
    expect(glow[cellOf(11, 10, 10)]).toBe(0);
    expect(glow[cellOf(9, 10, 10)]).toBe(14);
    const edge = emptyCells();
    edge[cellOf(SPAN - 1, 5, SPAN - 1)] = idOf("lantern");
    const lit = glowOf(edge);
    expect(lit[cellOf(0, 5, SPAN - 1)]).toBe(0);
    expect(lit[cellOf(SPAN - 1, 5, 0)]).toBe(0);
    const start = emptyCells();
    start[cellOf(0, 0, 0)] = idOf("lantern");
    expect(glowOf(start)[cellOf(SPAN - 1, 0, 0)]).toBe(0);
  });

  it("names the chunks whose light changed", () => {
    const before = emptyCells();
    const after = emptyCells();
    after[cellOf(17, 3, 2)] = 4;
    after[cellOf(63, 3, 63)] = 1;
    expect(
      Arr.sort(Arr.fromIterable(changedChunks(before, after)), Order.Number)
    ).toEqual([1, CHUNKS * CHUNKS - 1]);
  });
});
