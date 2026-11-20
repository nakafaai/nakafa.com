// @vitest-environment node

import { describe, expect, it } from "@effect/vitest";
import {
  BALL_RADIUS,
  BIN_FLOOR,
  binCentre,
  boardPose,
  contactPoint,
  DIVIDER,
  dividerTop,
  dividerXs,
  FOOT_X,
  HOPPER_SLOPE,
  hopperPoints,
  INNER_HALF,
  INNER_TOP,
  LEAN,
  NECK,
  NECK_HALF,
  PIN_RADIUS,
  PITCH,
  pileLevel,
  pinPoint,
  pinPoints,
  ROW_GAP,
  stackPoint,
} from "@repo/design-system/components/contents/mathematics/galton/board";
import { BALLS } from "@repo/design-system/components/contents/mathematics/galton/run";
import { Array as Arr } from "effect";

/** The distance between two points. */
function apart(
  a: { readonly x: number; readonly y: number },
  b: { readonly x: number; readonly y: number }
) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

describe("the Galton board's geometry", () => {
  it("sets the pins in equilateral triangles, one more pin in each row", () => {
    expect(pinPoints(4)).toHaveLength(10);
    expect(pinPoints(12)).toHaveLength(78);
    expect(apart(pinPoint(3, 1), pinPoint(4, 1))).toBeCloseTo(PITCH, 12);
    expect(apart(pinPoint(3, 1), pinPoint(4, 2))).toBeCloseTo(PITCH, 12);
    expect(pinPoint(0, 0).x).toBe(0);
    expect(contactPoint(2, 1).y - pinPoint(2, 1).y).toBeCloseTo(
      PIN_RADIUS + BALL_RADIUS,
      12
    );
  });

  it("puts a bin under every gap of the last row and a divider under every last pin", () => {
    const rows = 8;
    expect(binCentre(rows, 0)).toBeCloseTo(
      pinPoint(rows - 1, 0).x - PITCH / 2,
      12
    );
    expect(dividerXs(rows)).toHaveLength(rows + 2);
    expect(dividerXs(rows)[1]).toBeCloseTo(pinPoint(rows - 1, 0).x, 12);
    expect(dividerTop(rows)).toBeLessThan(pinPoint(rows - 1, 0).y);
    expect(Math.abs(binCentre(12, 12)) + PITCH / 2).toBeLessThan(INNER_HALF);
  });

  it("stacks balls four across and three in the hollows, never overlapping and inside the bin", () => {
    const rows = 6;
    const points = Arr.makeBy(70, (index) => stackPoint(rows, 2, index));
    Arr.forEach(points, (point, index) => {
      expect(Math.abs(point.x - binCentre(rows, 2))).toBeLessThanOrEqual(
        (PITCH - DIVIDER) / 2 - BALL_RADIUS + 1e-12
      );
      expect(point.y).toBeGreaterThanOrEqual(BIN_FLOOR + BALL_RADIUS - 1e-12);
      for (const other of Arr.take(points, index)) {
        expect(apart(point, other)).toBeGreaterThanOrEqual(
          2 * BALL_RADIUS - 1e-9
        );
      }
    });
    expect(stackPoint(rows, 2, 4).y).toBeGreaterThan(stackPoint(rows, 2, 3).y);
  });

  it("reads the level of a pile as the top of its balls", () => {
    const top = stackPoint(6, 0, 6).y + BALL_RADIUS;
    expect(pileLevel(7)).toBeCloseTo(top, 12);
    expect(pileLevel(-3)).toBe(pileLevel(0));
    expect(pileLevel(0)).toBeGreaterThan(BIN_FLOOR);
    expect(pileLevel(14)).toBeGreaterThan(pileLevel(7));
  });

  it("packs a full hopper of balls above the outlet, clear of its floor, its sides and each other", () => {
    const points = hopperPoints(BALLS);
    expect(points).toHaveLength(BALLS);
    expect(points[0]).toEqual({ x: 0, y: NECK + BALL_RADIUS });
    Arr.forEach(points, (point, index) => {
      const above =
        (point.y - NECK) * Math.cos(HOPPER_SLOPE) -
        (Math.abs(point.x) - NECK_HALF) * Math.sin(HOPPER_SLOPE);
      expect(above).toBeGreaterThanOrEqual(BALL_RADIUS - 1e-9);
      expect(Math.abs(point.x)).toBeLessThanOrEqual(INNER_HALF - BALL_RADIUS);
      expect(point.y).toBeLessThanOrEqual(INNER_TOP - BALL_RADIUS);
      for (const other of Arr.drop(Arr.take(points, index), index - 80)) {
        expect(apart(point, other)).toBeGreaterThanOrEqual(
          2 * BALL_RADIUS - 1e-9
        );
      }
    });
  });

  it("stands upright for a fair board and leans toward the favoured side on its low foot, with a wedge under the other", () => {
    expect(boardPose(0.5)).toEqual({ angle: 0, pivot: 0, wedge: [] });
    const right = boardPose(0.7);
    expect(right.angle).toBeCloseTo(-LEAN, 12);
    expect(right.pivot).toBeGreaterThan(FOOT_X);
    expect(right.wedge).toHaveLength(4);
    const [outer, inner, innerTop, outerTop] = right.wedge;
    expect(outer?.x).toBeLessThan(-FOOT_X);
    expect(inner?.y).toBe(0);
    expect(outerTop?.y).toBeGreaterThan(innerTop?.y ?? 0);
    expect((outerTop?.y ?? 0) / (right.pivot - (outer?.x ?? 0))).toBeCloseTo(
      Math.tan(LEAN),
      12
    );
    const left = boardPose(0.3);
    expect(left.angle).toBeCloseTo(LEAN, 12);
    expect(left.pivot).toBeLessThan(-FOOT_X);
    expect(left.wedge[0]?.x).toBeGreaterThan(FOOT_X);
  });

  it("drops one row gap between rows", () => {
    expect(pinPoint(0, 0).y - pinPoint(1, 0).y).toBeCloseTo(ROW_GAP, 12);
  });
});
