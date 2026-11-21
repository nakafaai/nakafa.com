// @vitest-environment node

import { describe, expect, it } from "@effect/vitest";
import {
  degreeOf,
  degreesOf,
  linksOf,
  roadBetween,
} from "@repo/design-system/components/contents/mathematics/network/graph";
import { Array as Arr, Option } from "effect";

const towns = Arr.map(["A", "B", "C", "D"], (id) => ({ id, name: id }));
const roads = [
  { from: "A", length: 12, to: "B" },
  { from: "C", length: 9, to: "A" },
  { from: "B", length: 4, to: "C" },
  { from: "C", length: 5, to: "D" },
];

describe("network graph", () => {
  it("lists the roads leaving a town in the order of the town list", () => {
    expect(linksOf(towns, roads, "C")).toEqual([
      { length: 9, road: 1, town: "A" },
      { length: 4, road: 2, town: "B" },
      { length: 5, road: 3, town: "D" },
    ]);
    expect(linksOf(towns, roads, "X")).toEqual([]);
    expect(
      linksOf(towns, [{ from: "X", length: 2, to: "B" }, ...roads], "B")
    ).toEqual([
      { length: 12, road: 1, town: "A" },
      { length: 4, road: 3, town: "C" },
      { length: 2, road: 0, town: "X" },
    ]);
  });

  it("counts each town's degree, which add up to twice the roads", () => {
    expect(degreeOf(roads, "C")).toBe(3);
    expect(degreesOf(towns, roads)).toEqual([2, 2, 3, 1]);
    expect(Arr.reduce(degreesOf(towns, roads), 0, (a, b) => a + b)).toBe(
      2 * roads.length
    );
  });

  it("finds a road whichever way it was listed", () => {
    expect(roadBetween(roads, "A", "C")).toEqual(Option.some(roads[1]));
    expect(roadBetween(roads, "C", "A")).toEqual(Option.some(roads[1]));
    expect(roadBetween(roads, "A", "D")).toEqual(Option.none());
  });
});
