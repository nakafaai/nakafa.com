// @vitest-environment node

import { describe, expect, it } from "@effect/vitest";
import {
  legLengths,
  longestFirst,
  MAX_ROUTES,
  routeChoices,
  routeLength,
  shortestRoute,
  simpleRoutes,
} from "@repo/design-system/components/contents/mathematics/network/paths";
import { Array as Arr, Option } from "effect";

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

/** Every two towns joined: more simple routes than the toolbar lists. */
const complete = Arr.flatMap(towns, (from, at) =>
  Arr.map(Arr.drop(towns, at + 1), (to) => ({
    from: from.id,
    length: 20 - at,
    to: to.id,
  }))
);

describe("network routes", () => {
  it("lists every simple route in a fixed order", () => {
    const routes = simpleRoutes(towns, roads, "A", "F", 50);
    expect(Arr.map(routes, (route) => Arr.join(route, ""))).toEqual([
      "ABCEDF",
      "ABCEF",
      "ABDEF",
      "ABDF",
      "ACBDEF",
      "ACBDF",
      "ACEDF",
      "ACEF",
    ]);
    expect(simpleRoutes(towns, roads, "A", "F", 3)).toHaveLength(3);
    expect(simpleRoutes(towns, roads, "A", "F", 0)).toEqual([]);
  });

  it("adds up a route's roads", () => {
    expect(routeLength(roads, ["A", "C", "E", "F"])).toBe(30);
    expect(legLengths(roads, ["A", "C", "E", "F"])).toEqual([9, 14, 7]);
    expect(routeLength(roads, ["A", "F"])).toBe(0);
    expect(legLengths(roads, ["A", "F"])).toEqual([0]);
  });

  it("finds the shortest route by Dijkstra's method", () => {
    expect(shortestRoute(towns, roads, "A", "F")).toEqual(
      Option.some({ length: 30, route: ["A", "C", "E", "F"] })
    );
    expect(shortestRoute(towns, roads, "A", "A")).toEqual(
      Option.some({ length: 0, route: ["A"] })
    );
    expect(shortestRoute(towns, Arr.take(roads, 3), "A", "F")).toEqual(
      Option.none()
    );
  });

  it("offers every route, or a capped list that keeps the shortest", () => {
    expect(routeChoices(towns, roads, "A", "F")).toHaveLength(8);
    const capped = routeChoices(towns, complete, "A", "F");
    expect(capped).toHaveLength(MAX_ROUTES);
    expect(Arr.last(capped)).toEqual(Option.some(["A", "F"]));
    expect(routeChoices(towns, Arr.take(roads, 3), "A", "F")).toEqual([]);
  });

  it("orders the routes longest first, ending on the shortest", () => {
    const routes = routeChoices(towns, roads, "A", "F");
    expect(longestFirst(roads, routes)).toEqual([0, 6, 1, 4, 2, 5, 3, 7]);
    expect(
      longestFirst(roads, [
        ["A", "B"],
        ["A", "C", "B"],
      ])
    ).toEqual([1, 0]);
    expect(
      longestFirst(roads, [
        ["A", "B"],
        ["A", "B"],
      ])
    ).toEqual([0, 1]);
  });
});
