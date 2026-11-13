// @vitest-environment node

import { describe, expect, it } from "@effect/vitest";
import {
  decelerationOf,
  frictionOf,
  GRAVITY,
  isSurface,
  SURFACES,
} from "@repo/design-system/components/contents/physics/kinematics/stopping-distance/friction";
import { brakingDistance } from "@repo/design-system/components/contents/physics/kinematics/stopping-distance/motion";
import { Array as Arr } from "effect";

describe("road friction", () => {
  it("takes the sliding coefficients of the cited table", () => {
    expect(Arr.map(SURFACES, frictionOf)).toEqual([
      0.75, 0.45, 0.55, 0.15, 0.07,
    ]);
  });

  it("brakes with b = μg", () => {
    expect(decelerationOf("dry")).toBeCloseTo(0.75 * GRAVITY, 12);
    expect(decelerationOf("ice")).toBeCloseTo(0.686, 12);
  });

  it("makes a wet road brake about two thirds longer than a dry one", () => {
    const dry = brakingDistance({
      deceleration: decelerationOf("dry"),
      reaction: 0,
      speed: 20,
    });
    const wet = brakingDistance({
      deceleration: decelerationOf("wet"),
      reaction: 0,
      speed: 20,
    });
    expect(dry).toBeCloseTo(400 / (2 * 7.35), 9);
    expect(wet / dry).toBeCloseTo(0.75 / 0.45, 9);
  });

  it("accepts only the lab's surfaces", () => {
    expect(isSurface("gravel")).toBe(true);
    expect(isSurface("sand")).toBe(false);
  });
});
