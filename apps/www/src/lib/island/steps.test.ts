// @vitest-environment node

import { describe, expect, it } from "@effect/vitest";
import { idOf } from "@repo/backend/confect/island/blocks";
import { HEIGHT } from "@repo/backend/confect/island/world";
import { Option } from "effect";
import { footingAt, footingOf } from "@/lib/island/steps";
import { cellOf, emptyCells } from "@/lib/island/world";

describe("island/steps", () => {
  it("hears each floor by what it is made of, and any other floor as stone", () => {
    expect(footingOf("grass")).toBe("grass");
    expect(footingOf("sand")).toBe("sand");
    expect(footingOf("wet-farmland")).toBe("soil");
    expect(footingOf("path")).toBe("gravel");
    expect(footingOf("planks")).toBe("wood");
    expect(footingOf("cobble")).toBe("stone");
    expect(footingOf("marble")).toBe("stone");
  });

  it("reads the floor under the fox's paws, the top of a column it can stand on, and nothing where it cannot", () => {
    const cells = emptyCells();
    cells[cellOf(4, 8, 4)] = idOf("dirt");
    cells[cellOf(4, 9, 4)] = idOf("grass");
    cells[cellOf(5, 9, 4)] = idOf("path");
    // A column of stone to the top of the world leaves no room over it to stand.
    for (let y = 0; y < HEIGHT - 1; y += 1) {
      cells[cellOf(6, y, 4)] = idOf("stone");
    }
    expect(footingAt(cells, 4.7, 4.2)).toEqual(Option.some("grass"));
    expect(footingAt(cells, 5.1, 4.9)).toEqual(Option.some("gravel"));
    expect(footingAt(cells, 6.5, 4.5)).toEqual(Option.none());
    expect(footingAt(cells, 20.5, 20.5)).toEqual(Option.none());
  });
});
