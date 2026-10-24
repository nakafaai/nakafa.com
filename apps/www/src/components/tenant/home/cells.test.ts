import { describe, expect, it } from "@effect/vitest";
import { Array as Arr } from "effect";
import {
  type CellSpan,
  fillRows,
  placeCells,
} from "@/components/tenant/home/cells";

/** A cell that is shown, with its preferred spans, which the tests draw as nothing. */
const cell = (
  key: string,
  narrow: 1 | 2,
  wide: CellSpan["wide"],
  shown = true
) => ({
  draw: () => null,
  key,
  narrow,
  shown,
  wide,
});

/** The spans that the placed cells take, by their keys, in their order. */
const spansOf = (cells: ReturnType<typeof placeCells>) =>
  Arr.map(cells, (placed) => [placed.key, placed.narrow, placed.wide]);

describe("tenant home cells", () => {
  it("keeps every cell at its preferred width when the rows fill exactly", () => {
    expect(fillRows([3, 3, 3, 3], 12)).toStrictEqual([3, 3, 3, 3]);
  });

  it("lets the last cell of a row take the columns that the row has left", () => {
    expect(fillRows([8, 3], 12)).toStrictEqual([8, 4]);
  });

  it("makes a lone cell take the whole row", () => {
    expect(fillRows([8], 12)).toStrictEqual([12]);
  });

  it("starts a new row when the next cell no longer fits the row above", () => {
    expect(fillRows([8, 8], 12)).toStrictEqual([12, 12]);
  });

  it("has no widths for an empty dashboard", () => {
    expect(fillRows([], 12)).toStrictEqual([]);
  });

  it("places the four counts in one row, and the schedule beside the live rooms", () => {
    const placed = placeCells([
      cell("count-live", 1, 3),
      cell("count-next", 1, 3),
      cell("count-waiting", 1, 3),
      cell("count-drafts", 1, 3),
      cell("schedule", 2, 8),
      cell("live", 1, 4),
    ]);
    // The live rooms are alone in their narrow row, so they take both of its columns.
    expect(spansOf(placed)).toStrictEqual([
      ["count-live", 1, 3],
      ["count-next", 1, 3],
      ["count-waiting", 1, 3],
      ["count-drafts", 1, 3],
      ["schedule", 2, 8],
      ["live", 2, 4],
    ]);
  });

  it("gives the last count of a row the columns it has left when a count is not shown", () => {
    const placed = placeCells([
      cell("count-live", 1, 3),
      cell("count-next", 1, 3),
      cell("count-waiting", 1, 3, false),
      cell("count-drafts", 1, 3),
    ]);
    expect(spansOf(placed)).toStrictEqual([
      ["count-live", 1, 3],
      ["count-next", 1, 3],
      ["count-drafts", 2, 6],
    ]);
  });

  it("gives the quiet state its own row when the schedule and the rooms are left out", () => {
    const placed = placeCells([
      cell("count-live", 1, 3),
      cell("count-next", 1, 3),
      cell("count-waiting", 1, 3),
      cell("count-drafts", 1, 3),
      cell("schedule", 2, 8, false),
      cell("live", 1, 4, false),
      cell("quiet", 2, 12),
    ]);
    expect(spansOf(placed)).toStrictEqual([
      ["count-live", 1, 3],
      ["count-next", 1, 3],
      ["count-waiting", 1, 3],
      ["count-drafts", 1, 3],
      ["quiet", 2, 12],
    ]);
  });

  it("gives a lone count the whole row, as a lone cell takes the row it is in", () => {
    const placed = placeCells([cell("count-live", 1, 3)]);
    expect(spansOf(placed)).toStrictEqual([["count-live", 2, 12]]);
  });

  it("keeps the order of the cells that are shown", () => {
    const placed = placeCells([
      cell("results", 1, 8),
      cell("drafts", 1, 4, false),
      cell("setup", 2, 12),
    ]);
    expect(Arr.map(placed, (entry) => entry.key)).toStrictEqual([
      "results",
      "setup",
    ]);
  });

  it("has no cells when none is shown", () => {
    expect(placeCells([cell("drafts", 1, 4, false)])).toStrictEqual([]);
  });
});
