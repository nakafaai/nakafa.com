// @vitest-environment node
import { describe, expect, it } from "@effect/vitest";
import { Array as Arr, Option } from "effect";
import {
  ease,
  elevationOf,
  flowOf,
  pointOf,
  riverOf,
  SEA,
} from "@/lib/island/land/relief";

const SEED = 4242;

/** The places of a wide grid about the origin, with the land the seed grows at each. */
const grid = Arr.flatMap(Arr.range(-40, 40), (j) =>
  Arr.map(Arr.range(-40, 40), (i) => {
    const x = i * 13;
    const z = j * 13;
    return { point: pointOf(SEED, x, z), x, z };
  })
);

describe("island/land/relief", () => {
  it("eases from 0 to 1 between two values, whichever lies higher", () => {
    expect(ease(0, 4, -1)).toBe(0);
    expect(ease(0, 4, 2)).toBe(0.5);
    expect(ease(0, 4, 9)).toBe(1);
    expect(ease(0, -2, -2)).toBe(1);
    expect(ease(0, -2, 1)).toBe(0);
  });

  it("grows the same land for a seed and a place, and another for another seed", () => {
    expect(pointOf(SEED, 31, -77)).toEqual(pointOf(SEED, 31, -77));
    expect(elevationOf(SEED, 900, 400)).not.toBe(elevationOf(7, 900, 400));
  });

  it("lays the sea floor under the sea's face, with no inland water over it", () => {
    const sea = Arr.filter(grid, ({ point }) => point.elevation < -2);
    expect(sea.length).toBeGreaterThan(0);
    for (const { point } of sea) {
      expect(point.height).toBeLessThan(SEA);
      expect(point.surface).toBe(SEA);
      expect(point.forest).toBe(0);
      expect(point.sand).toBe(1);
    }
  });

  it("stands dry land over the sea in terraces, wooded or open, never under water", () => {
    const dry = Arr.filter(
      grid,
      ({ point }) => point.elevation > 2 && point.wet < -3.4
    );
    expect(dry.length).toBeGreaterThan(0);
    for (const { point } of dry) {
      expect(point.height).toBeGreaterThan(point.surface);
    }
    expect(Arr.some(dry, ({ point }) => point.forest > 0.5)).toBe(true);
    expect(Arr.some(dry, ({ point }) => point.meadow > 0.5)).toBe(true);
    expect(Arr.some(dry, ({ point }) => point.elevation > 12)).toBe(true);
  });

  it("fills rivers and lakes to one level over their beds, with sand along their banks", () => {
    const wet = Arr.filter(grid, ({ point }) => point.wet > 0.4);
    expect(wet.length).toBeGreaterThan(0);
    for (const { point } of wet) {
      expect(point.surface).toBeGreaterThan(point.height);
      expect(point.meadow).toBe(0);
      expect(point.forest).toBe(0);
    }
    const bank = Arr.filter(
      grid,
      ({ point }) => point.wet > -0.6 && point.wet < -0.3 && point.elevation > 2
    );
    expect(Arr.some(bank, ({ point }) => point.sand > 0.3)).toBe(true);
  });

  it("runs a river along its own line toward lower land, and nowhere else", () => {
    expect(flowOf(SEED, 0, 0, -5)).toEqual([0, 0]);
    const river = Arr.filter(
      Arr.flatMap(Arr.range(-200, 200), (j) =>
        Arr.map(Arr.range(-60, 60), (i) => ({ x: i * 5, z: j * 2 }))
      ),
      ({ x, z }) =>
        Math.abs(riverOf(SEED, x, z)) * 2 < 0.03 &&
        elevationOf(SEED, x, z) > 0.3
    );
    expect(river.length).toBeGreaterThan(8);
    const flows = Arr.map(river, ({ x, z }) => ({
      flow: flowOf(SEED, x, z, 1),
      x,
      z,
    }));
    for (const { flow, x, z } of flows) {
      expect(Math.hypot(flow[0], flow[1])).toBeCloseTo(1, 5);
      const ahead =
        elevationOf(SEED, x + flow[0] * 3, z + flow[1] * 3) -
        elevationOf(SEED, x - flow[0] * 3, z - flow[1] * 3);
      expect(ahead).toBeLessThanOrEqual(0.5);
    }
    // A place off the zero line carries nothing, even where the ground is wet.
    const off = Arr.findFirst(
      grid,
      ({ x, z }) => Math.abs(riverOf(SEED, x, z)) * 2 >= 0.03
    );
    expect(Option.map(off, ({ x, z }) => flowOf(SEED, x, z, 1))).toEqual(
      Option.some([0, 0])
    );
    // Rivers turn, so the whole set does not flow one way.
    expect(Arr.some(flows, ({ flow }) => flow[0] > 0.2)).toBe(true);
    expect(Arr.some(flows, ({ flow }) => flow[0] < -0.2)).toBe(true);
  });
});
