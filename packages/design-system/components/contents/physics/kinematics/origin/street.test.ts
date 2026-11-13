import { describe, expect, it } from "@effect/vitest";
import {
  measuredFrom,
  RIDE_DURATION,
  ridePosition,
  rideSummary,
} from "@repo/design-system/components/contents/physics/kinematics/origin/street";

describe("ridePosition", () => {
  it("rides from 20 m out to 50 m and back to 35 m", () => {
    expect(ridePosition(0)).toBe(20);
    expect(ridePosition(3)).toBeCloseTo(35);
    expect(ridePosition(6)).toBeCloseTo(50);
    expect(ridePosition(RIDE_DURATION)).toBeCloseTo(35);
  });
});

describe("measuredFrom", () => {
  it("shifts the coordinate by the origin, as in the lesson's 30 m object", () => {
    expect(measuredFrom("store", 30)).toBe(30);
    expect(measuredFrom("house", 30)).toBe(10);
    expect(measuredFrom("pole", 30)).toBe(-20);
  });
});

describe("rideSummary", () => {
  it("changes the start and end with the origin but never the displacement", () => {
    expect(rideSummary("store")).toEqual({ change: 15, end: 35, start: 20 });
    expect(rideSummary("house").start).toBe(0);
    expect(rideSummary("pole").start).toBe(-30);
    expect(rideSummary("pole").change).toBeCloseTo(15);
    expect(rideSummary("house").change).toBeCloseTo(15);
  });
});
