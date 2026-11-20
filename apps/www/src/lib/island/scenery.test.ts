// @vitest-environment node
import { describe, expect, it } from "@effect/vitest";
import { Array as Arr } from "effect";
import { floraOf } from "@/lib/island/land/flora";
import { depthAt } from "@/lib/island/land/ground";
import { meters } from "@/lib/island/models/parts";
import { thingSize } from "@/lib/island/models/things";
import { lampsOf, sceneryOf } from "@/lib/island/scenery";
import {
  bareOf,
  coverAll,
  floodAll,
  GROUND,
  plainOf,
  setThings,
} from "@/lib/island/test.world";

/** A run of numbers cut into rows of `size`. */
const rows = (run: Float32Array, size: number) =>
  Arr.chunksOf(Arr.fromIterable(run), size);

describe("island/scenery", () => {
  it("lights nothing on an empty land: eight lamps of zeros", () => {
    const lamps = lampsOf(bareOf(4), 0, [10, 10]);
    expect(lamps).toHaveLength(32);
    expect(Arr.every(Arr.fromIterable(lamps), (value) => value === 0)).toBe(
      true
    );
  });

  it("lights each lamp where it glows on its model, turned with the thing, as brightly as its kind burns", () => {
    const land = bareOf(4);
    setThings(
      land,
      [0, 0],
      [
        ["lantern", 10, 10, 0],
        ["cottage", 20, 10, 1],
        ["mango", 12, 12, 0],
      ]
    );
    const lamps = rows(lampsOf(land, 1, [10, 10]), 4);
    expect(lamps[0][0]).toBeCloseTo(10, 5);
    expect(lamps[0][1]).toBeCloseTo(GROUND + meters(2.4), 5);
    expect(lamps[0][2]).toBeCloseTo(10, 5);
    expect(lamps[0][3]).toBe(1);
    // A quarter turn swings the cottage's front window from before it to beside it.
    expect(lamps[1][0]).toBeCloseTo(20 + meters(2.35), 5);
    expect(lamps[1][1]).toBeCloseTo(GROUND + meters(1.75), 5);
    expect(lamps[1][2]).toBeCloseTo(10 - meters(1.75), 5);
    expect(lamps[1][3]).toBeCloseTo(0.8, 5);
    // The tree glows not at all.
    expect(lamps[2]).toEqual([0, 0, 0, 0]);
  });

  it("keeps the eight lamps nearest the origin, the nearest first, and none from far away", () => {
    const land = bareOf(6);
    setThings(
      land,
      [0, 0],
      Arr.map(
        Arr.range(0, 9),
        (slot) => ["lantern", 2 + slot * 3, 4, 0] as const
      )
    );
    setThings(land, [5, 0], [["lighthouse", 4, 4, 0]]);
    const lamps = rows(lampsOf(land, 0, [2, 4]), 4);
    expect(Arr.map(lamps, ([x]) => Math.round(x))).toEqual([
      2, 5, 8, 11, 14, 17, 20, 23,
    ]);
    const other = rows(lampsOf(land, 0, [29, 4]), 4);
    expect(Math.round(other[0][0])).toBe(29);
    expect(Arr.map(other, ([x]) => Math.round(x))).not.toContain(2);
    // From beside the lighthouse its lantern room is the brightest and the only lamp.
    const far = rows(lampsOf(land, 0, [5 * 32 + 4, 4]), 4);
    expect(far[0][3]).toBeCloseTo(1.6, 5);
    expect(far[0][1]).toBeCloseTo(GROUND + meters(12), 5);
    expect(far[1]).toEqual([0, 0, 0, 0]);
  });

  it("raises smoke from a cottage's chimney and a fire, and sheds leaves from the planted trees that have a crown", () => {
    const land = bareOf(4);
    setThings(
      land,
      [0, 0],
      [
        ["cottage", 20, 10, 0],
        ["campfire", 8, 8, 0],
        ["mango", 12, 12, 0],
        ["palm", 14, 20, 0],
        ["lantern", 4, 4, 0],
      ]
    );
    const scenery = sceneryOf(land, 0, [10, 10]);
    const chimneys = rows(scenery.chimneys, 3);
    expect(chimneys).toHaveLength(2);
    expect(chimneys[0][0]).toBeCloseTo(20 + meters(1.5), 5);
    expect(chimneys[0][1]).toBeCloseTo(GROUND + meters(5.9), 5);
    expect(chimneys[0][2]).toBeCloseTo(10 - meters(0.8), 5);
    expect(chimneys[1][0]).toBeCloseTo(8, 5);
    expect(chimneys[1][1]).toBeCloseTo(GROUND + meters(0.7), 5);
    const crowns = rows(scenery.crowns, 4);
    expect(crowns).toHaveLength(1);
    expect(crowns[0][0]).toBeCloseTo(12, 5);
    expect(crowns[0][1]).toBeCloseTo(
      GROUND + thingSize("mango").height * 0.45,
      5
    );
    expect(crowns[0][2]).toBeCloseTo(12, 5);
    expect(crowns[0][3]).toBeCloseTo(GROUND, 5);
    expect(scenery.butterflies).toHaveLength(0);
    expect(scenery.fireflies).toHaveLength(0);
  });

  it("sheds leaves from the wild trees about the origin too, each from its own crown", () => {
    const land = plainOf(4);
    coverAll(land, [-40, -40], [72, 72], "forest");
    const wild = Arr.filter(
      Arr.flatMap(Arr.range(-1, 1), (cx) =>
        Arr.flatMap(Arr.range(-1, 1), (cz) => floraOf(land, cx, cz))
      ),
      (plant) =>
        plant.kind === "tree" ||
        plant.kind === "flame" ||
        plant.kind === "banana"
    );
    expect(wild.length).toBeGreaterThan(10);
    const crowns = rows(sceneryOf(land, 0, [10, 10]).crowns, 4);
    expect(crowns).toHaveLength(Math.min(240, wild.length));
    expect(
      Arr.every(crowns, ([, crown, , ground]) => crown > ground + 0.5)
    ).toBe(true);
  });

  it("keeps butterflies over about one place in three of the meadow, and no more than the painter is handed", () => {
    const land = bareOf(4);
    coverAll(land, [0, 0], [12, 12], "meadow");
    const few = rows(sceneryOf(land, 0, [6, 6]).butterflies, 3);
    expect(few.length).toBeGreaterThan(0);
    expect(few.length).toBeLessThan(12);
    expect(
      Arr.every(
        few,
        ([x, y, z]) =>
          x >= 0 &&
          x <= 12 &&
          z >= 0 &&
          z <= 12 &&
          Math.abs(y - GROUND - 0.9) < 1e-4
      )
    ).toBe(true);
    coverAll(land, [-60, -60], [72, 72], "meadow");
    expect(rows(sceneryOf(land, 0, [6, 6]).butterflies, 3)).toHaveLength(96);
  });

  it("gathers fireflies over open ground by water or by a wood, never over the water or far out on the grass", () => {
    const land = bareOf(4);
    expect(sceneryOf(land, 0, [6, 6]).fireflies).toHaveLength(0);
    floodAll(land, [10, -20], [20, 30], 1.5, "lake");
    coverAll(land, [-30, -30], [-20, 30], "forest");
    const flies = rows(sceneryOf(land, 0, [6, 6]).fireflies, 3);
    expect(flies.length).toBeGreaterThan(4);
    expect(
      Arr.every(flies, ([x, y, z]) => depthAt(land, x, z) <= 0 && y > GROUND)
    ).toBe(true);
    // By the lake and by the wood, and nowhere in the open between them.
    expect(Arr.some(flies, ([x]) => x > 0 && x < 30)).toBe(true);
    expect(Arr.some(flies, ([x]) => x < -10)).toBe(true);
    expect(Arr.some(flies, ([x]) => x > -10 && x < 0)).toBe(false);
  });
});
