// @vitest-environment node

import { describe, expect, it } from "@effect/vitest";
import {
  contactFactor,
  crowdOf,
  immuneShare,
  nextInfected,
  outbreakOf,
  peakOf,
  reproductionOf,
  SPREAD,
  SQUARE,
  walk,
} from "@repo/design-system/components/contents/biology/epidemic/spread";
import { Array as Arr, Option } from "effect";

const NONE = { distancing: 0, masks: 0, vaccinated: 0, washing: 0 };

describe("reproduction number", () => {
  it("starts at the basic number when the town takes no measure", () => {
    expect(reproductionOf(NONE, "air")).toBe(SPREAD.basic);
    expect(reproductionOf(NONE, "touch")).toBe(SPREAD.basic);
  });

  it("counts masks at both ends of an air contact and washing only by touch", () => {
    expect(contactFactor({ ...NONE, masks: 1 }, "air")).toBeCloseTo(0.25);
    expect(contactFactor({ ...NONE, masks: 1 }, "touch")).toBe(1);
    expect(contactFactor({ ...NONE, washing: 1 }, "touch")).toBeCloseTo(0.5);
    expect(contactFactor({ ...NONE, washing: 1 }, "air")).toBe(1);
    expect(contactFactor({ ...NONE, distancing: 2 }, "air")).toBe(0);
  });

  it("removes the vaccinated immune share from the people a case can reach", () => {
    expect(immuneShare({ ...NONE, vaccinated: 1 })).toBeCloseTo(0.8);
    expect(reproductionOf({ ...NONE, vaccinated: 1 }, "air")).toBeCloseTo(0.6);
    expect(immuneShare({ ...NONE, vaccinated: -1 })).toBe(0);
  });
});

describe("outbreak", () => {
  it("infects most of a town that takes no measure", () => {
    const outbreak = outbreakOf(NONE, "air", 160);
    expect(outbreak).toHaveLength(161);
    // With R0 = 3 the final size solves 1 - s = 1 - exp(-3 (1 - s)), about 94%.
    const last = Option.getOrThrow(Arr.last(outbreak));
    expect(last.recovered + last.infected).toBeCloseTo(0.94, 1);
    expect(peakOf(outbreak)).toBeGreaterThan(0.25);
  });

  it("dies out when R is below one", () => {
    const outbreak = outbreakOf({ ...NONE, vaccinated: 1 }, "air", 160);
    expect(peakOf(outbreak)).toBeCloseTo(0.01, 3);
    const last = Option.getOrThrow(Arr.last(outbreak));
    expect(last.recovered - 0.8 * 0.99).toBeLessThan(0.05);
  });

  it("runs at least one day", () => {
    expect(outbreakOf(NONE, "air", 0)).toHaveLength(2);
  });
});

describe("the square", () => {
  it("keeps the share at home still and inside the square", () => {
    const crowd = crowdOf(10, 0.3);
    expect(Arr.filter(crowd, (walker) => walker.home)).toHaveLength(3);
    const home = crowd[0];
    expect(home && walk(home, 10, 1)).toBe(home);
    const out = crowd[9];
    if (out) {
      const moved = walk(out, 1, 2);
      expect(Math.hypot(moved.x - out.x, moved.y - out.y)).toBeCloseTo(
        SQUARE.speed
      );
    }
  });

  it("bounces walkers back from the edges", () => {
    const moved = walk({ heading: 0, home: false, x: 29.9, y: 19.9 }, 5, 1);
    expect(moved.x).toBeLessThanOrEqual(SQUARE.width / 2);
    expect(Math.cos(moved.heading)).toBeLessThan(0);
    const up = walk({ heading: Math.PI / 2, home: false, x: 0, y: 19.9 }, 5, 3);
    expect(Math.sin(up.heading)).toBeLessThan(0);
  });

  it("infects the susceptible walkers nearest to a case", () => {
    const walkers = [
      { heading: 0, home: false, x: 0, y: 0 },
      { heading: 0, home: false, x: 1, y: 0 },
      { heading: 0, home: false, x: 9, y: 0 },
      { heading: 0, home: true, x: 0.5, y: 0 },
    ];
    expect(
      nextInfected(
        walkers,
        [true, false, false, false],
        [false, true, true, true],
        1
      )
    ).toEqual([1]);
    expect(
      nextInfected(
        walkers,
        [false, false, false, false],
        [true, true, true, true],
        2
      )
    ).toEqual([]);
    expect(
      nextInfected(
        walkers,
        [true, false, false, false],
        [false, true, true, true],
        0
      )
    ).toEqual([]);
  });
});
