import { describe, expect, it } from "@effect/vitest";
import {
  keplerPeriod,
  planetRatios,
} from "@repo/design-system/components/contents/physics/gravity/kepler";

describe("keplerPeriod", () => {
  it("gives about 2.8 hours at 2R when the orbit at 4R takes 8.0 hours", () => {
    expect(keplerPeriod({ period: 8, radius: 4 }, 2)).toBeCloseTo(2.83, 2);
  });
});

describe("planetRatios", () => {
  it("halves gravity, keeps both speeds and doubles the period for twice the mass and twice the radius", () => {
    const planet = planetRatios(2, 2);
    expect(planet.gravity).toBe(0.5);
    expect(planet.escape).toBe(1);
    expect(planet.orbit).toBe(1);
    expect(planet.period).toBe(2);
  });
});
