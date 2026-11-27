import { describe, expect, it } from "@effect/vitest";
import {
  towerProfile,
  towerRadius,
} from "@repo/design-system/components/three/energy/tower";
import { Array as Arr, Option, Order } from "effect";

describe("towerRadius", () => {
  it("tapers evenly from the foot to the top", () => {
    expect(towerRadius(2, 1, 0)).toBe(2);
    expect(towerRadius(2, 1, 0.5)).toBe(1.5);
    expect(towerRadius(2, 1, 1)).toBe(1);
  });
});

describe("towerProfile", () => {
  it("rises from the foundation to the asked height without stepping back down", () => {
    const profile = towerProfile(80, 2.1, 1.25);
    const heights = Arr.map(profile, ([, height]) => height);
    expect(heights[0]).toBe(0);
    expect(Option.getOrThrow(Arr.last(heights))).toBe(80);
    expect(heights).toEqual(Arr.sort(heights, Order.Number));
  });

  it("stands a flange out of the shell at the foot, at each joint and at the top", () => {
    const proud = Arr.filter(
      towerProfile(80, 2.1, 1.25),
      ([radius, height]) => radius > towerRadius(2.1, 1.25, height / 80) + 0.1
    );
    expect(proud).toHaveLength(2 + 3 * 2 + 2);
  });
});
