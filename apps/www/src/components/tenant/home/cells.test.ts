import { describe, expect, it } from "@effect/vitest";
import { Array as Arr } from "effect";
import { fillRows, placeCells } from "@/components/tenant/home/cells";

/** The keys and spans of the placed cells, in order, so each test names only what it checks. */
const spansOf = (cells: ReturnType<typeof placeCells>) =>
  Arr.map(cells, ({ key, three, two }) => ({ key, three, two }));

describe("tenant home cells", () => {
  it("keeps every cell at its preferred width when the rows fill exactly", () => {
    expect(fillRows([2, 1, 2, 1, 3], 3)).toEqual([2, 1, 2, 1, 3]);
  });

  it("lets the last cell of a row take the columns that the row has left", () => {
    expect(fillRows([1, 1, 1], 4)).toEqual([1, 1, 2]);
    expect(fillRows([1, 1, 1, 1], 4)).toEqual([1, 1, 1, 1]);
  });

  it("makes a lone cell take the whole row", () => {
    expect(fillRows([2], 3)).toEqual([3]);
    expect(fillRows([2, 2], 3)).toEqual([3, 3]);
  });

  it("starts a new row when the next cell no longer fits the row above", () => {
    expect(fillRows([2, 2, 1], 3)).toEqual([3, 2, 1]);
  });

  it("has no widths for an empty bento", () => {
    expect(fillRows([], 3)).toEqual([]);
  });

  it("places the shown staff cells in rows with the schedule beside the live rooms", () => {
    const placed = placeCells([
      {
        draw: () => null,
        key: "schedule",
        shown: true,
        three: 2,
        two: 2,
      },
      { draw: () => null, key: "live", shown: true, three: 1, two: 1 },
      { draw: () => null, key: "quiet", shown: false, three: 3, two: 2 },
      { draw: () => null, key: "results", shown: true, three: 2, two: 1 },
      { draw: () => null, key: "drafts", shown: true, three: 1, two: 1 },
      { draw: () => null, key: "setup", shown: true, three: 3, two: 2 },
    ]);

    expect(spansOf(placed)).toEqual([
      { key: "schedule", three: 2, two: 2 },
      { key: "live", three: 1, two: 1 },
      { key: "results", three: 2, two: 1 },
      { key: "drafts", three: 1, two: 2 },
      { key: "setup", three: 3, two: 2 },
    ]);
  });

  it("gives the quiet state the whole first row when the schedule and the rooms are left out", () => {
    const placed = placeCells([
      { draw: () => null, key: "schedule", shown: false, three: 2, two: 2 },
      { draw: () => null, key: "live", shown: false, three: 1, two: 1 },
      { draw: () => null, key: "quiet", shown: true, three: 3, two: 2 },
      { draw: () => null, key: "results", shown: true, three: 2, two: 1 },
    ]);

    expect(spansOf(placed)).toEqual([
      { key: "quiet", three: 3, two: 2 },
      { key: "results", three: 3, two: 2 },
    ]);
  });

  it("keeps the order of the cells that are shown", () => {
    const placed = placeCells([
      { draw: () => null, key: "results", shown: true, three: 2, two: 1 },
      { draw: () => null, key: "schedule", shown: false, three: 2, two: 2 },
      { draw: () => null, key: "drafts", shown: true, three: 1, two: 1 },
    ]);

    expect(Arr.map(placed, (cell) => cell.key)).toEqual(["results", "drafts"]);
  });
});
