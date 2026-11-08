import { describe, expect, it } from "@effect/vitest";
import {
  cellGrid,
  divisionCells,
  GROWTH_SHARE,
} from "@repo/design-system/components/contents/mathematics/bacterial/layout";
import { Array as Arr } from "effect";

describe("bacteria layout", () => {
  it("fits every cell inside its box on an even grid", () => {
    const cells = cellGrid(8, 400, 200);

    expect(cells).toHaveLength(8);
    for (const { radius, x, y } of cells) {
      expect(x - radius).toBeGreaterThanOrEqual(0);
      expect(x + radius).toBeLessThanOrEqual(400);
      expect(y - radius).toBeGreaterThanOrEqual(0);
      expect(y + radius).toBeLessThanOrEqual(200);
    }
    expect(cellGrid(0, 400, 200)).toStrictEqual([]);
    expect(cellGrid(4, 0, 200)).toStrictEqual([]);
  });

  it("grows the cells before they divide", () => {
    const start = divisionCells(2, 4, 0, 400, 200);
    const grown = divisionCells(2, 4, GROWTH_SHARE / 2, 400, 200);

    expect(grown).toHaveLength(2);
    expect(grown[0]?.radius).toBeGreaterThan(start[0]?.radius ?? 0);
  });

  it("splits each parent into its daughters and lands them on the next grid", () => {
    const parents = cellGrid(2, 400, 200);
    const daughters = cellGrid(6, 400, 200);
    const beginning = divisionCells(2, 6, GROWTH_SHARE, 400, 200);
    const end = divisionCells(2, 6, 1, 400, 200);

    expect(beginning).toHaveLength(6);
    expect(Arr.map(Arr.take(beginning, 3), ({ x }) => x)).toStrictEqual(
      Arr.makeBy(3, () => parents[0]?.x)
    );
    expect(Arr.map(end, ({ x, y }) => [x, y])).toStrictEqual(
      Arr.map(daughters, ({ x, y }) => [x, y])
    );
  });

  it("keeps the same cells when a generation does not change their number", () => {
    expect(divisionCells(3, 3, 0.9, 300, 300)).toHaveLength(3);
  });
});
