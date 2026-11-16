import { describe, expect, it } from "@effect/vitest";
import {
  BEND,
  LAP,
  STRAIGHT,
  trackDisplacement,
  trackPlace,
} from "@repo/design-system/components/contents/physics/kinematics/track/lap";

describe("track geometry", () => {
  it("measures 400 m around lane 1", () => {
    expect(LAP).toBe(400);
    expect(BEND).toBeCloseTo(36.8, 2);
  });

  it("starts at the end of the home straight, running toward the bend", () => {
    expect(trackPlace(0)).toEqual({ heading: 0, x: STRAIGHT / 2, y: -BEND });
  });

  it("reaches the far end of the back straight at 200 m", () => {
    const place = trackPlace(200);
    expect(place.x).toBeCloseTo(-STRAIGHT / 2, 1);
    expect(place.y).toBeCloseTo(BEND);
    expect(place.heading).toBeCloseTo(Math.PI);
  });

  it("runs the home straight eastward and wraps after a lap", () => {
    expect(trackPlace(LAP - 10).heading).toBe(0);
    expect(trackPlace(LAP + 5).x).toBeCloseTo(trackPlace(5).x);
    expect(trackPlace(-5).x).toBeCloseTo(trackPlace(LAP - 5).x);
  });
});

describe("trackDisplacement", () => {
  it("is the chord across the track at 200 m and zero after the lap", () => {
    expect(trackDisplacement(200)).toBeCloseTo(
      Math.hypot(STRAIGHT, 2 * BEND),
      0
    );
    expect(trackDisplacement(400)).toBeCloseTo(0);
  });

  it("is shorter than the path everywhere on the lap", () => {
    for (const distance of [50, 100, 150, 300, 350]) {
      expect(trackDisplacement(distance)).toBeLessThan(distance);
    }
  });
});
