// @vitest-environment node
import { describe, expect, it } from "@effect/vitest";
import {
  blockAt,
  cellOf,
  emptyCells,
  footprintOf,
  HEIGHT,
  isInside,
  SPAN,
} from "@/lib/island/world";

describe("island/world", () => {
  it("indexes every cell once, rows of x, then z, then layers of y", () => {
    expect(cellOf(0, 0, 0)).toBe(0);
    expect(cellOf(1, 0, 0)).toBe(1);
    expect(cellOf(0, 0, 1)).toBe(SPAN);
    expect(cellOf(0, 1, 0)).toBe(SPAN * SPAN);
    expect(emptyCells()).toHaveLength(SPAN * SPAN * HEIGHT);
  });

  it("reads air outside the world", () => {
    const cells = emptyCells();
    cells[cellOf(3, 4, 5)] = 9;
    expect(blockAt(cells, 3, 4, 5)).toBe(9);
    expect(blockAt(cells, -1, 4, 5)).toBe(0);
    expect(blockAt(cells, 3, HEIGHT, 5)).toBe(0);
    expect(isInside(SPAN, 0, 0)).toBe(false);
    expect(isInside(0, 0, -1)).toBe(false);
  });

  it("centers each footprint in the world", () => {
    expect(footprintOf(16)).toEqual({ from: 24, to: 39 });
    expect(footprintOf(SPAN)).toEqual({ from: 0, to: SPAN - 1 });
  });
});
