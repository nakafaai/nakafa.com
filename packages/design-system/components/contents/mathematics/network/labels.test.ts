// @vitest-environment node

import { describe, expect, it } from "@effect/vitest";
import {
  nameSides,
  plateSpots,
} from "@repo/design-system/components/contents/mathematics/network/labels";
import {
  layoutTowns,
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

describe("the sides the towns' names stand on", () => {
  it("stands a name behind its pin, over its middle, when nothing crowds it", () => {
    expect(nameSides(Arr.take(towns, 1), [], [{ x: 0, z: 0 }])).toEqual([
      { x: 0, z: -1 },
    ]);
  });

  it("moves a name off the road that leaves its pin toward the back", () => {
    const sides = nameSides(
      Arr.take(towns, 2),
      [{ from: "A", length: 1, to: "B" }],
      [
        { x: 0, z: 0 },
        { x: 0, z: -0.3 },
      ]
    );
    expect(sides[0]?.z).toBe(1);
  });

  it("keeps the names of two near towns apart", () => {
    const spots = [
      { x: 0, z: 0 },
      { x: 0.06, z: 0 },
    ];
    const sides = nameSides(Arr.take(towns, 2), [], spots);
    expect(sides[0]).not.toEqual(sides[1]);
  });
});

describe("the plates of the road lengths", () => {
  it("sets each length plate beside its road, clear of towns and roads", () => {
    const three = Arr.take(towns, 3);
    const spots = [
      { x: 0, z: 0 },
      { x: 0.2, z: 0 },
      { x: 0.1, z: 0.05 },
    ];
    const plates = plateSpots(
      three,
      [
        { from: "A", length: 1, to: "B" },
        { from: "B", length: 1, to: "A" },
        { from: "A", length: 1, to: "X" },
        { from: "X", length: 1, to: "A" },
      ],
      spots,
      0.02
    );
    expect(plates).toHaveLength(4);
    const [first] = plates;
    const beside = segmentDistance(first ?? spots[0], spots[0], spots[1]);
    expect(beside).toBeGreaterThanOrEqual(0.02 - 1e-9);
    expect(beside).toBeLessThanOrEqual(0.034 + 1e-9);
  });

  it("keeps the sample's plates clear of one another", () => {
    const spots = layoutTowns(towns, roads, board);
    const plates = plateSpots(towns, roads, spots, 0.026);
    const gaps = Arr.flatMap(plates, (one, a) =>
      Arr.map(Arr.drop(plates, a + 1), (two) =>
        Math.hypot(two.x - one.x, two.z - one.z)
      )
    );
    expect(Math.min(...gaps)).toBeGreaterThan(0.05);
  });
});
