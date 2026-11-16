import { describe, expect, it } from "@effect/vitest";
import { Array as Arr } from "effect";
import { mergeCells } from "@/lib/content/renderer/client/base/visual/area";

/** The square of the cell at one column and row of a unit grid. */
function cell(column: number, row: number) {
  return [
    [column, row],
    [column + 1, row],
    [column + 1, row + 1],
    [column, row + 1],
  ] as const;
}

describe("the merged cells of a region's shading", () => {
  it("joins a block of whole cells into one box", () => {
    const merged = mergeCells(
      Arr.flatMap(Arr.range(0, 2), (row) =>
        Arr.map(Arr.range(0, 3), (column) => cell(column, row))
      )
    );
    expect(merged).toStrictEqual([
      [
        [0, 0],
        [4, 0],
        [4, 3],
        [0, 3],
      ],
    ]);
  });

  it("keeps rows of other widths, gaps in a row, and every cell the outline cuts", () => {
    const cut = [
      [5, 0],
      [5.5, 0],
      [5, 0.5],
    ] as const;
    const merged = mergeCells([
      cell(0, 0),
      cell(1, 0),
      cell(3, 0),
      cell(0, 1),
      cut,
    ]);
    expect(merged).toHaveLength(4);
    expect(merged).toContainEqual([
      [0, 0],
      [2, 0],
      [2, 1],
      [0, 1],
    ]);
    expect(merged).toContainEqual([
      [3, 0],
      [4, 0],
      [4, 1],
      [3, 1],
    ]);
    expect(merged).toContainEqual([
      [0, 1],
      [1, 1],
      [1, 2],
      [0, 2],
    ]);
    expect(merged).toContainEqual(cut);
  });

  it("keeps a four-point cut cell that is not an upright square", () => {
    const slanted = [
      [0, 0],
      [1, 0],
      [1, 1],
      [0.5, 1],
    ] as const;
    expect(mergeCells([slanted])).toStrictEqual([slanted]);
  });
});
