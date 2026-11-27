// @vitest-environment node

import { describe, expect, it } from "@effect/vitest";
import {
  landAt,
  PEAK,
} from "@repo/design-system/components/contents/mathematics/journey/land";
import {
  BOARD,
  HALF,
  LAND,
} from "@repo/design-system/components/contents/mathematics/journey/layout";
import { Array as Arr } from "effect";

describe("the land of the road diorama", () => {
  it("lies flat along the road and its verges", () => {
    expect(landAt(0, 0)).toBe(0);
    expect(landAt(BOARD.width / 2, 0.2)).toBe(0);
    expect(landAt(-BOARD.width / 2, -0.2)).toBe(0);
  });

  it("rises into hills behind the road, higher than the banks in front", () => {
    const behind = Arr.map(Arr.range(-5, 5), (step) =>
      landAt(-0.24, step * 0.05)
    );
    const before = Arr.map(Arr.range(-5, 5), (step) =>
      landAt(0.09, step * 0.05)
    );
    expect(Math.max(...behind)).toBeGreaterThan(Math.max(...before));
    expect(Math.max(...behind)).toBeLessThanOrEqual(PEAK.back);
    expect(Math.max(...before)).toBeLessThanOrEqual(PEAK.front);
    expect(Math.min(...behind)).toBeGreaterThan(0);
  });

  it("falls back to the baseboard at every edge", () => {
    expect(landAt(-LAND.back, 0)).toBe(0);
    expect(landAt(LAND.front, 0)).toBe(0);
    expect(landAt(-0.24, HALF)).toBe(0);
    expect(landAt(-0.24, -HALF)).toBe(0);
  });

  it("gives the same place the same height", () => {
    expect(landAt(-0.2, 0.1)).toBe(landAt(-0.2, 0.1));
  });
});
