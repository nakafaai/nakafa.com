// @vitest-environment node

import { describe, expect, it } from "@effect/vitest";
import {
  between,
  easeInOut,
  fitDistance,
  focusPose,
  middleOf,
  overviewPose,
  reachOf,
  spotOf,
} from "@repo/design-system/components/contents/biology/equipment/framing";
import { Array as Arr } from "effect";

/** The distance between two points. */
function gap(from: readonly number[], to: readonly number[]) {
  return Math.hypot(...Arr.zipWith(from, to, (a, b) => a - b));
}

describe("lab equipment framing", () => {
  it("fits a ball inside the narrower side of the frame", () => {
    expect(fitDistance(1, 40, 1, 1)).toBeCloseTo(1 / Math.sin(Math.PI / 9), 12);
    const portrait = Math.atan(Math.tan(Math.PI / 9) * 0.5);
    expect(fitDistance(1, 40, 0.5, 1)).toBeCloseTo(1 / Math.sin(portrait), 12);
    expect(fitDistance(1, 40, 1.43, 0.5)).toBeCloseTo(
      2 / Math.sin(Math.PI / 9),
      12
    );
  });

  it("turns the camera to a picked item's middle from its own side", () => {
    const pose = focusPose("beaker", 40, 1.43);
    expect(pose.target).toEqual(middleOf("beaker"));
    expect(middleOf("beaker")[1]).toBeCloseTo(0.9475, 12);
    expect(reachOf("beaker")).toBeCloseTo(
      Math.hypot(0.07, 0.095, 0.07) / 2,
      12
    );
    expect(gap(pose.position, pose.target)).toBeCloseTo(
      fitDistance(reachOf("beaker"), 40, 1.43, 0.62),
      12
    );
    const wall = focusPose("fireBlanket", 40, 1);
    expect(wall.position[0]).toBeGreaterThan(wall.target[0]);
  });

  it("frames the whole corner first, farther back on a portrait canvas", () => {
    const wide = overviewPose(40, 1.43);
    const tall = overviewPose(40, 0.6);
    expect(gap(wide.position, wide.target)).toBeCloseTo(
      1.8 / Math.sin(Math.PI / 9),
      12
    );
    expect(gap(tall.position, tall.target)).toBeGreaterThan(
      gap(wide.position, wide.target)
    );
  });

  it("lights a picked item from above on the camera's side, its cone just holding it", () => {
    const small = spotOf("slide");
    expect(small.target).toEqual(middleOf("slide"));
    expect(small.position[1]).toBeGreaterThan(small.target[1]);
    const distance = gap(small.position, small.target);
    expect(distance).toBeCloseTo(0.45 + 3 * reachOf("slide"), 12);
    expect(small.intensity).toBeCloseTo(0.9 * distance ** 2, 12);
    expect(Math.tan(small.angle) * distance).toBeCloseTo(
      1.5 * reachOf("slide"),
      12
    );
  });

  it("eases a camera move in and out, held at its ends", () => {
    expect(easeInOut(-1)).toBe(0);
    expect(easeInOut(0.25)).toBeCloseTo(0.0625, 12);
    expect(easeInOut(0.5)).toBeCloseTo(0.5, 12);
    expect(easeInOut(0.75)).toBeCloseTo(0.9375, 12);
    expect(easeInOut(2)).toBe(1);
    expect(between([0, 0, 0], [2, 4, -2], 0.25)).toEqual([0.5, 1, -0.5]);
  });
});
