// @vitest-environment node

import { describe, expect, it } from "@effect/vitest";
import {
  crossingsOf,
  layoutTowns,
  roadDistances,
  segmentDistance,
} from "@repo/design-system/components/contents/mathematics/network/layout";
import { Array as Arr } from "effect";

const towns = Arr.map(["A", "B", "C", "D", "E", "F"], (id) => ({
  id,
  name: id,
}));
const roads = [
  { from: "A", length: 12, to: "B" },
  { from: "A", length: 9, to: "C" },
  { from: "B", length: 4, to: "C" },
  { from: "B", length: 10, to: "D" },
  { from: "C", length: 14, to: "E" },
  { from: "D", length: 6, to: "E" },
  { from: "D", length: 11, to: "F" },
  { from: "E", length: 7, to: "F" },
];
const board = { depth: 0.4, gap: 0.14, width: 0.7 };

describe("network layout", () => {
  it("measures every two towns by their shortest route", () => {
    const table = roadDistances(towns, roads);
    expect(table[0]).toEqual([0, 12, 9, 22, 23, 30]);
    expect(roadDistances(towns, Arr.take(roads, 1))[0][5]).toBe(
      Number.POSITIVE_INFINITY
    );
  });

  it("lays the same network out the same way, inside the board", () => {
    const spots = layoutTowns(towns, roads, board);
    expect(layoutTowns(towns, roads, board)).toEqual(spots);
    expect(spots).toHaveLength(6);
    for (const spot of spots) {
      expect(Math.abs(spot.x)).toBeLessThanOrEqual(board.width / 2 + 1e-9);
      expect(Math.abs(spot.z)).toBeLessThanOrEqual(board.depth / 2 + 1e-9);
    }
  });

  it("keeps every two towns at least the gap apart", () => {
    const spots = layoutTowns(towns, roads, board);
    const gaps = Arr.flatMap(spots, (one, a) =>
      Arr.map(Arr.drop(spots, a + 1), (two) =>
        Math.hypot(two.x - one.x, two.z - one.z)
      )
    );
    expect(Math.min(...gaps)).toBeGreaterThan(board.gap * 0.97);
  });

  it("puts towns far apart by road far apart on the board", () => {
    const spots = layoutTowns(towns, roads, board);
    const [a, , , , , f] = spots;
    const [, b, c] = spots;
    expect(Math.hypot(f.x - a.x, f.z - a.z)).toBeGreaterThan(
      Math.hypot(c.x - b.x, c.z - b.z)
    );
  });

  it("counts crossing roads and lays the sample out with none", () => {
    const square = Arr.take(towns, 4);
    const corners = [
      { x: 0, z: 0 },
      { x: 1, z: 1 },
      { x: 1, z: 0 },
      { x: 0, z: 1 },
    ];
    const diagonals = [
      { from: "A", length: 1, to: "B" },
      { from: "C", length: 1, to: "D" },
      { from: "A", length: 1, to: "C" },
      { from: "X", length: 1, to: "Y" },
    ];
    expect(crossingsOf(square, diagonals, corners)).toBe(1);
    expect(crossingsOf(towns, roads, layoutTowns(towns, roads, board))).toBe(0);
  });

  it("pushes crowded towns apart without leaving the board", () => {
    const tight = { depth: 0.2, gap: 0.3, width: 0.3 };
    const spots = layoutTowns(towns, roads, tight);
    for (const spot of spots) {
      expect(Math.abs(spot.x)).toBeLessThanOrEqual(tight.width / 2 + 1e-9);
      expect(Math.abs(spot.z)).toBeLessThanOrEqual(tight.depth / 2 + 1e-9);
    }
  });

  it("measures how far a point lies from a segment", () => {
    const a = { x: 0, z: 0 };
    const b = { x: 1, z: 0 };
    expect(segmentDistance({ x: 0.5, z: 0.3 }, a, b)).toBeCloseTo(0.3);
    expect(segmentDistance({ x: -1, z: 0 }, a, b)).toBeCloseTo(1);
    expect(segmentDistance({ x: 3, z: 4 }, a, a)).toBeCloseTo(5);
  });

  it("copes with a lone town and towns no road joins", () => {
    expect(layoutTowns(Arr.take(towns, 1), [], board)).toEqual([
      { x: 0, z: 0 },
    ]);
    const apart = layoutTowns(Arr.take(towns, 3), [], board);
    expect(apart).toHaveLength(3);
    expect(Arr.every(apart, (s) => Number.isFinite(s.x + s.z))).toBe(true);
  });
});
