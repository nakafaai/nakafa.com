// @vitest-environment node

import { describe, expect, it } from "@effect/vitest";
import {
  BOARD,
  graphSpot,
  laneX,
  letterSide,
  namesWidth,
  PAPER,
  pointAt,
  reachOf,
  roadX,
  sheetOf,
  treeSpots,
  viewOf,
} from "@repo/design-system/components/contents/mathematics/journey/layout";
import { Array as Arr, Option } from "effect";

const TOPS = { km: 20, minute: 100 } as const;

/** Five numbered steps of time across and four of distance back, as for a 20 km trip of 90 minutes. */
const STEPS = { km: 4, minute: 5 } as const;

/** A wide card's view, with room for stop names up to "Station". */
const FRAME = { aspect: 1.43, fov: 30, names: 66, width: 700 } as const;

describe("the road and the graph on the table", () => {
  it("lays the graph deeper than wide on a narrow card, and wider on a wide one", () => {
    const narrow = sheetOf(true, STEPS);
    const wide = sheetOf(false, STEPS);
    expect(narrow.depth).toBeGreaterThan(narrow.width);
    expect(wide.width).toBeGreaterThan(wide.depth);
  });

  it("prints true squares, five or ten to a numbered step", () => {
    const narrow = sheetOf(true, STEPS);
    expect(narrow.squares).toEqual({ across: 5, back: 10 });
    expect(narrow.width / (STEPS.minute * 5)).toBeCloseTo(
      narrow.depth / (STEPS.km * 10)
    );
    const wide = sheetOf(false, STEPS);
    expect(wide.squares).toEqual({ across: 5, back: 5 });
    expect(wide.width / (STEPS.minute * 5)).toBeCloseTo(
      wide.depth / (STEPS.km * 5)
    );
  });

  it("takes finer squares one way when they fill the room better", () => {
    const sheet = sheetOf(false, { km: 8, minute: 5 });
    expect(sheet.squares).toEqual({ across: 10, back: 5 });
    expect(sheet.width).toBeCloseTo(0.92);
  });

  it("puts the origin at the front left, time across and distance back", () => {
    const sheet = sheetOf(false, STEPS);
    expect(graphSpot(sheet, TOPS, 0, 0)).toEqual({
      x: sheet.left,
      z: sheet.front,
    });
    const corner = graphSpot(sheet, TOPS, 100, 20);
    expect(corner.x).toBeCloseTo(sheet.left + sheet.width);
    expect(corner.z).toBeCloseTo(sheet.front - sheet.depth);
    expect(pointAt(corner, 0.5)).toEqual([corner.x, 0.5, corner.z]);
  });

  it("runs the road beside the paper, its lanes either side of its middle", () => {
    const sheet = sheetOf(true, STEPS);
    const middle = roadX(sheet);
    expect(middle + BOARD.width / 2 + BOARD.gap).toBeCloseTo(
      sheet.left - PAPER.left
    );
    expect(laneX(sheet, 0)).toBeCloseTo(middle - BOARD.lane);
    expect(laneX(sheet, 1)).toBeCloseTo(middle + BOARD.lane);
  });

  it("reaches from the road's far side to the paper's edges", () => {
    const sheet = sheetOf(false, STEPS);
    const reach = reachOf(sheet);
    expect(reach.left).toBeCloseTo(roadX(sheet) - BOARD.width / 2);
    expect(reach.right).toBeCloseTo(sheet.left + sheet.width + PAPER.right);
    expect(reach.front - reach.back).toBeCloseTo(
      sheet.depth + PAPER.front + PAPER.back
    );
  });
});

describe("the roadside", () => {
  it("plants trees along the verge, keeping clear of every stop", () => {
    const trees = treeSpots(-0.5, 0.5, [0]);
    expect(trees.length).toBeGreaterThan(5);
    expect(Arr.every(trees, (z) => Math.abs(z) >= 0.042)).toBe(true);
    expect(treeSpots(-0.5, 0.5, []).length).toBeGreaterThan(trees.length);
  });

  it("measures the room the longest stop name takes, and none without stops", () => {
    expect(namesWidth([])).toBe(0);
    expect(namesWidth(["Station", "Market"])).toBeCloseTo(7 * 7.2 + 16);
  });
});

describe("the camera's view", () => {
  it("aims at the middle of the road, the names and the paper", () => {
    const sheet = sheetOf(false, STEPS);
    const reach = reachOf(sheet);
    const view = viewOf(sheet, FRAME, 1);
    expect(view.target.x).toBeLessThan((reach.left + reach.right) / 2);
    expect(view.target.z).toBeCloseTo((reach.front + reach.back) / 2);
    expect(viewOf(sheet, { ...FRAME, names: 0 }, 1).target.x).toBeCloseTo(
      (reach.left + reach.right) / 2
    );
  });

  it("stands further back for a deep view than a wide card needs across", () => {
    const sheet = sheetOf(true, STEPS);
    const square = viewOf(sheet, { ...FRAME, aspect: 1 }, 1.15);
    const wide = viewOf(sheet, { ...FRAME, aspect: 3 }, 1.15);
    expect(square.distance).toBeGreaterThan(wide.distance);
    expect(
      viewOf(sheet, { ...FRAME, aspect: 3 }, 1.5).distance
    ).toBeGreaterThan(wide.distance);
  });
});

describe("where a corner's letter goes", () => {
  const sheet = sheetOf(false, STEPS);
  const at = (minute: number, km: number) => graphSpot(sheet, TOPS, minute, km);

  it("sets a letter outside the bend, away from both segments", () => {
    const side = letterSide(
      sheet,
      at(15, 12),
      Option.some(at(0, 0)),
      Option.some(at(25, 12))
    );
    expect(side.x).toBeLessThan(0);
    expect(side.z).toBeLessThan(0);
    expect(Math.hypot(side.x, side.z)).toBeCloseTo(1);
  });

  it("sets an end's letter away from its one segment", () => {
    const side = letterSide(
      sheet,
      at(90, 0),
      Option.some(at(60, 20)),
      Option.none()
    );
    expect(side.x).toBeGreaterThan(0);
  });

  it("sets a letter above a straight run", () => {
    expect(
      letterSide(
        sheet,
        at(20, 10),
        Option.some(at(10, 5)),
        Option.some(at(30, 15))
      )
    ).toEqual({ x: 0, z: -1 });
  });

  it("keeps a letter off the axes' numbers", () => {
    const onTime = letterSide(
      sheet,
      at(60, 0),
      Option.some(at(30, 10)),
      Option.some(at(90, 10))
    );
    expect(onTime.z).toBeLessThan(0);
    const onDistance = letterSide(
      sheet,
      at(0, 10),
      Option.some(at(10, 10)),
      Option.none()
    );
    expect(onDistance.x).toBeGreaterThanOrEqual(0);
  });
});
