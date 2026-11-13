import { describe, expect, it } from "@effect/vitest";
import { apparentRain } from "@repo/design-system/components/contents/physics/kinematics/rain/drops";

describe("apparentRain", () => {
  it("falls straight down for a parked car", () => {
    expect(apparentRain(6.5, 0)).toEqual({ angle: 0, speed: 6.5 });
  });

  it("slants by atan(car / rain) and speeds up for a moving car", () => {
    const seen = apparentRain(6, 8);
    expect(seen.speed).toBe(10);
    expect(seen.angle).toBeCloseTo(53.13, 2);
  });
});
