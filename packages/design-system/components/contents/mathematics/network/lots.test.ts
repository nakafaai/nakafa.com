// @vitest-environment node

import { describe, expect, it } from "@effect/vitest";
import {
  angleBetween,
  bearingsOf,
  boardLots,
  townLots,
} from "@repo/design-system/components/contents/mathematics/network/lots";
import { Array as Arr } from "effect";

describe("model town lots", () => {
  it("measures the angle between two bearings the short way round", () => {
    expect(angleBetween(0.1, -0.1)).toBeCloseTo(0.2);
    expect(angleBetween(3, -3)).toBeCloseTo(2 * Math.PI - 6);
    expect(angleBetween(Math.PI, 0)).toBeCloseTo(Math.PI);
  });

  it("reads the bearing of each road from a town", () => {
    expect(
      bearingsOf({ x: 0, z: 0 }, [
        { x: 1, z: 0 },
        { x: 0, z: 1 },
      ])
    ).toEqual([0, Math.PI / 2]);
  });

  it("builds three to five houses, the same each time", () => {
    for (const index of Arr.range(0, 7)) {
      const lots = townLots(index, []);
      expect(lots.length).toBeGreaterThanOrEqual(3);
      expect(lots.length).toBeLessThanOrEqual(5);
      expect(townLots(index, [])).toEqual(lots);
    }
  });

  it("keeps every house off the roads", () => {
    const roads = [0, 2.1, -2.1];
    for (const index of Arr.range(0, 7)) {
      for (const lot of townLots(index, roads)) {
        const angle = Math.atan2(lot.z, lot.x);
        for (const road of roads) {
          expect(angleBetween(angle, road)).toBeGreaterThanOrEqual(0.42);
        }
      }
    }
  });

  it("builds no house where roads leave no room", () => {
    const roads = Arr.makeBy(16, (at) => (at * Math.PI) / 8);
    expect(townLots(0, roads)).toEqual([]);
  });

  it("builds each town's houses clear of its own roads", () => {
    const towns = [
      { id: "A", name: "Alor" },
      { id: "B", name: "Bukit" },
      { id: "C", name: "Cempaka" },
    ];
    const spots = [
      { x: 0, z: 0 },
      { x: 1, z: 0 },
      { x: 0, z: 1 },
    ];
    const roads = [
      { from: "A", length: 3, to: "B" },
      { from: "C", length: 4, to: "A" },
    ];
    const lots = boardLots(towns, roads, spots);
    expect(lots[0]).toEqual(townLots(0, [0, Math.PI / 2]));
    expect(lots[1]).toEqual(townLots(1, [Math.PI]));
    expect(lots[2]).toEqual(townLots(2, [-Math.PI / 2]));
  });
});
