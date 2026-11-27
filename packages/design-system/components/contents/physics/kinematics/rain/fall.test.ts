import { describe, expect, it } from "@effect/vitest";
import {
  carAlong,
  dropAlong,
  dropHeight,
} from "@repo/design-system/components/contents/physics/kinematics/rain/fall";

describe("dropHeight", () => {
  it("falls from its own height at the rain's speed", () => {
    expect(dropHeight(0, 0, 10)).toBe(10);
    expect(dropHeight(0.25, 0, 10)).toBeCloseTo(7.5, 9);
    expect(dropHeight(0.25, 3, 10)).toBeCloseTo(4.5, 9);
  });

  it("starts again at the top once it reaches the road", () => {
    expect(dropHeight(0.25, 8, 10)).toBeCloseTo(9.5, 9);
  });
});

describe("dropAlong", () => {
  it("keeps a drop where it is in the air while the camera stays near", () => {
    expect(dropAlong(0.5, 0, 40)).toBeCloseTo(0, 9);
    expect(dropAlong(0.6, 0, 40)).toBeCloseTo(4, 9);
    expect(dropAlong(0.6, 3, 40)).toBeCloseTo(4, 9);
  });

  it("meets a drop again ahead once the camera has left it behind", () => {
    expect(dropAlong(0.6, 30, 40)).toBeCloseTo(44, 9);
    expect(Math.abs(dropAlong(0.6, 1234.5, 40) - 1234.5)).toBeLessThanOrEqual(
      20
    );
  });
});

describe("carAlong", () => {
  it("drives from the middle of its loop and comes in again at the far end", () => {
    expect(carAlong(0, 44)).toBeCloseTo(0, 9);
    expect(carAlong(10, 44)).toBeCloseTo(10, 9);
    expect(carAlong(30, 44)).toBeCloseTo(-14, 9);
    expect(carAlong(44, 44)).toBeCloseTo(0, 9);
  });
});
