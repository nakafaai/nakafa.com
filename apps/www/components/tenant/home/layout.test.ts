import { describe, expect, it } from "@effect/vitest";
import { Array as Arr } from "effect";
import {
  staffPlan,
  studentPlan,
  tileSpans,
} from "@/components/tenant/home/layout";

const EMPTY = {
  canCreate: false,
  canWatch: false,
  closed: 0,
  drafts: 0,
  live: 0,
  next: 0,
  setup: false,
};

describe("staffPlan", () => {
  it("shows a tile only while it holds rows, in urgency order", () => {
    expect(
      staffPlan({
        ...EMPTY,
        canCreate: true,
        canWatch: true,
        closed: 1,
        drafts: 2,
        live: 1,
        next: 1,
        setup: true,
      })
    ).toEqual({
      quiet: false,
      tiles: ["live", "results", "next", "drafts", "setup"],
    });
  });

  it("hides the drafts of a viewer who may not create an exam", () => {
    expect(
      staffPlan({ ...EMPTY, canWatch: true, drafts: 2, next: 1 }).tiles
    ).toEqual(["next"]);
  });

  it("shows the quiet state, with no tile, when Live and Next are both empty", () => {
    expect(
      staffPlan({ ...EMPTY, canWatch: true, drafts: 1, canCreate: true })
    ).toEqual({ quiet: true, tiles: ["drafts"] });
  });

  it("shows no quiet state to a viewer who may not watch rooms", () => {
    expect(staffPlan({ ...EMPTY, canCreate: true }).quiet).toBe(false);
  });

  it("shows no quiet state while a room runs", () => {
    expect(staffPlan({ ...EMPTY, canWatch: true, live: 1 }).quiet).toBe(false);
  });
});

describe("studentPlan", () => {
  it("shows the sittings before the results", () => {
    expect(studentPlan({ results: 1, sittings: 2 })).toEqual({
      quiet: false,
      tiles: ["sittings", "results"],
    });
  });

  it("shows the quiet state when the student holds no sitting and no result", () => {
    expect(studentPlan({ results: 0, sittings: 0 })).toEqual({
      quiet: true,
      tiles: [],
    });
  });

  it("shows only the results when no sitting is open or scheduled", () => {
    expect(studentPlan({ results: 1, sittings: 0 })).toEqual({
      quiet: false,
      tiles: ["results"],
    });
  });
});

/** The columns of each tile at two columns and at three, as a list of pairs. */
const spansOf = (count: number) =>
  Arr.map(tileSpans(count), (span) => [span.two, span.three]);

describe("tileSpans", () => {
  it("gives one tile the whole row at every width", () => {
    expect(spansOf(1)).toEqual([[2, 3]]);
  });

  it("gives the hero two columns and the single beside it the last column of its row", () => {
    expect(spansOf(2)).toEqual([
      [2, 2],
      [2, 1],
    ]);
  });

  it("stands a lone last tile over its whole row at three columns", () => {
    expect(spansOf(3)).toEqual([
      [2, 2],
      [1, 1],
      [1, 3],
    ]);
  });

  it("stands a lone last tile over its whole row at two columns when the singles are odd", () => {
    expect(spansOf(4)).toEqual([
      [2, 2],
      [1, 1],
      [1, 1],
      [2, 1],
    ]);
  });

  it("keeps the last row whole when its tiles fill it", () => {
    expect(spansOf(5)).toEqual([
      [2, 2],
      [1, 1],
      [1, 1],
      [1, 1],
      [1, 1],
    ]);
  });

  it("stands a lone last tile over its row again after a full row of three", () => {
    expect(spansOf(6)).toEqual([
      [2, 2],
      [1, 1],
      [1, 1],
      [1, 1],
      [1, 1],
      [2, 3],
    ]);
  });

  it("leaves two tiles of the last row side by side at three columns", () => {
    expect(spansOf(7)).toEqual([
      [2, 2],
      [1, 1],
      [1, 1],
      [1, 1],
      [1, 1],
      [1, 1],
      [1, 1],
    ]);
  });
});
