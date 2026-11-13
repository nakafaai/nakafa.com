import { describe, expect, it } from "@effect/vitest";
import {
  averageOver,
  changeOver,
  tripDuration,
  tripIntervals,
  tripReach,
  tripState,
} from "@repo/design-system/components/contents/physics/kinematics/secant/trip";

describe("tripState", () => {
  it("follows the commute through each stretch", () => {
    expect(tripState("commute", 4)).toEqual({ position: 20, velocity: 10 });
    expect(tripState("commute", 10)).toEqual({ position: 80, velocity: 10 });
    expect(tripState("commute", 12)).toEqual({ position: 90, velocity: 0 });
    expect(tripState("commute", 16).position).toBe(90);
    expect(tripState("commute", 20)).toEqual({ position: 110, velocity: 10 });
  });

  it("holds the end of the trip after it and the start before it", () => {
    expect(tripState("commute", 25).position).toBe(110);
    expect(tripState("cruise", -1)).toEqual({ position: 0, velocity: 8 });
  });

  it("turns the return trip around at 5 s and brings it home at 10 s", () => {
    expect(tripState("return", 5).position).toBeCloseTo(15);
    expect(tripState("return", 5).velocity).toBeCloseTo(0);
    expect(tripState("return", 10).position).toBeCloseTo(0);
  });
});

describe("averageOver", () => {
  it("is the secant slope of each commute interval", () => {
    expect(averageOver("commute", [0, 4]).velocity).toBe(5);
    expect(averageOver("commute", [4, 10]).velocity).toBe(10);
    expect(averageOver("commute", [10, 16]).velocity).toBeCloseTo(10 / 6);
    expect(averageOver("commute", [0, 20])).toEqual({
      displacement: 110,
      elapsed: 20,
      velocity: 5.5,
    });
  });

  it("is the same for every interval of a steady cruise", () => {
    for (const interval of tripIntervals("cruise")) {
      expect(averageOver("cruise", interval).velocity).toBeCloseTo(8);
    }
  });

  it("is negative on the way back and zero for a trip that returns", () => {
    expect(averageOver("return", [5, 10]).velocity).toBeCloseTo(-3);
    expect(averageOver("return", [0, 10]).velocity).toBeCloseTo(0);
    expect(averageOver("return", [2, 8]).displacement).toBeCloseTo(0);
  });
});

describe("tripDuration and tripReach", () => {
  it("measures each trip", () => {
    expect(tripDuration("commute")).toBe(20);
    expect(tripReach("commute")).toEqual({ highest: 110, lowest: 0 });
    expect(tripReach("return").highest).toBeCloseTo(15);
  });
});

describe("changeOver", () => {
  it("reads average acceleration as the secant slope of the velocity graph", () => {
    expect(changeOver("commute", "velocity", [0, 4])).toEqual({
      change: 10,
      elapsed: 4,
      rate: 2.5,
    });
    expect(changeOver("commute", "velocity", [10, 16]).rate).toBeCloseTo(
      -10 / 6
    );
    expect(changeOver("commute", "position", [0, 20]).rate).toBe(5.5);
  });

  it("ranges the velocity graph from rest to cruising speed", () => {
    expect(tripReach("commute", "velocity")).toEqual({
      highest: 10,
      lowest: 0,
    });
  });
});
