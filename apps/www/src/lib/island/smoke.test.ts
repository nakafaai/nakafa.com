// @vitest-environment node

import { describe, expect, it } from "@effect/vitest";
import { idOf } from "@repo/backend/confect/island/blocks";
import { Array as Arr } from "effect";
import { stampItem } from "@/lib/island/items";
import { chimneysOf } from "@/lib/island/smoke";
import { cellOf, emptyCells } from "@/lib/island/world";

describe("island/smoke", () => {
  it("finds the top of a cottage's chimney, over the middle of its last brick", () => {
    const cells = emptyCells();
    stampItem(cells, "house", [20, 9, 20], 0);
    const tops = chimneysOf(cells);
    expect(tops).toHaveLength(3);
    const [x, y, z] = tops;
    expect(cells[cellOf(x - 0.5, y - 1, z - 0.5)]).toBe(idOf("brick"));
    expect(cells[cellOf(x - 0.5, y, z - 0.5)]).toBe(0);
  });

  it("smokes from a chimney the learner builds out of a roof, and not from a brick wall or a lone brick", () => {
    const cells = emptyCells();
    // A brick column rising beside a roof block: a chimney.
    cells[cellOf(10, 9, 10)] = idOf("roof");
    cells[cellOf(11, 9, 10)] = idOf("brick");
    cells[cellOf(11, 10, 10)] = idOf("brick");
    // A brick standing alone on the grass, and a brick wall under a roof.
    cells[cellOf(30, 9, 30)] = idOf("brick");
    cells[cellOf(40, 9, 40)] = idOf("brick");
    cells[cellOf(40, 10, 40)] = idOf("slate");
    expect(Arr.fromIterable(chimneysOf(cells))).toEqual([11.5, 11, 10.5]);
  });
});
