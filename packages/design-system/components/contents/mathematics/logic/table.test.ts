// @vitest-environment node

import { describe, expect, it } from "@effect/vitest";
import {
  CASE_SECONDS,
  caseAt,
  playSeconds,
  setCase,
  setMode,
  startBoard,
  tableRows,
} from "@repo/design-system/components/contents/mathematics/logic/table";
import { Array as Arr, Option } from "effect";

describe("the truth table on the card", () => {
  it("starts with both switches open and that row tried", () => {
    expect(startBoard("and")).toEqual({
      mode: "and",
      state: { p: false, q: false },
      tried: [3],
    });
    expect(startBoard("not").tried).toEqual([1]);
  });

  it("fills a row once its case is tried, in table order, and marks the current row", () => {
    const board = setCase(
      setCase(setCase(startBoard("or"), { p: true, q: false }), {
        p: true,
        q: true,
      }),
      { p: true, q: false }
    );
    expect(board.tried).toEqual([0, 1, 3]);
    const rows = tableRows(board);
    expect(Arr.map(rows, (row) => row.current)).toEqual([
      false,
      true,
      false,
      false,
    ]);
    expect(Arr.map(rows, (row) => row.truth)).toEqual([
      Option.some(true),
      Option.some(true),
      Option.none(),
      Option.some(false),
    ]);
  });

  it("starts the table afresh when the board is rewired, keeping the switches", () => {
    const board = setMode(
      setCase(startBoard("and"), { p: true, q: true }),
      "not"
    );
    expect(board).toEqual({
      mode: "not",
      state: { p: true, q: true },
      tried: [0],
    });
    expect(Arr.map(tableRows(board), (row) => row.truth)).toEqual([
      Option.some(false),
      Option.none(),
    ]);
  });

  it("plays each case in turn and holds the last", () => {
    expect(playSeconds("or")).toBe(4 * CASE_SECONDS);
    expect(playSeconds("not")).toBe(2 * CASE_SECONDS);
    expect(caseAt("and", 0)).toEqual({ p: true, q: true });
    expect(caseAt("and", CASE_SECONDS * 2.5)).toEqual({ p: false, q: true });
    expect(caseAt("and", CASE_SECONDS * 9)).toEqual({ p: false, q: false });
    expect(caseAt("not", -1)).toEqual({ p: true, q: false });
  });
});
