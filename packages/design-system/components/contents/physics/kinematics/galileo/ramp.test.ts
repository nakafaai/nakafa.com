import { describe, expect, it } from "@effect/vitest";
import {
  bellGaps,
  bellPlaces,
  rampAcceleration,
  rampDistance,
} from "@repo/design-system/components/contents/physics/kinematics/galileo/ramp";
import { Array as Arr } from "effect";

describe("rampAcceleration", () => {
  it("is five sevenths of g sin(angle) for a rolling solid ball", () => {
    expect(rampAcceleration(3)).toBeCloseTo((50 / 7) * Math.sin(Math.PI / 60));
    expect(rampAcceleration(3)).toBeCloseTo(0.374, 3);
  });
});

describe("bell places", () => {
  it("grow with the square of the time: 1, 4, 9, 16", () => {
    const [first, second, third, fourth] = bellPlaces(4);
    const unit = first ?? 1;
    expect((second ?? 0) / unit).toBeCloseTo(4);
    expect((third ?? 0) / unit).toBeCloseTo(9);
    expect((fourth ?? 0) / unit).toBeCloseTo(16);
  });

  it("leave gaps in the odd-number ratio 1 : 3 : 5 : 7", () => {
    const gaps = bellGaps(2);
    const unit = gaps[0] ?? 1;
    expect(Arr.map(gaps, (gap) => gap / unit)).toEqual(
      Arr.map([1, 3, 5, 7], (ratio) => expect.closeTo(ratio, 9))
    );
  });

  it("starts from rest", () => {
    expect(rampDistance(3, -1)).toBe(0);
    expect(rampDistance(3, 4)).toBeCloseTo(2.99, 2);
  });
});
