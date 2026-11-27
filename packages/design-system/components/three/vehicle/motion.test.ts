import { describe, expect, it } from "@effect/vitest";
import {
  froudeAt,
  heaveAt,
  rollAt,
  trimAt,
  WAKE_ANGLE,
  wakeStrength,
} from "@repo/design-system/components/three/vehicle/motion";

describe("froudeAt", () => {
  it("compares the speed with the wave as long as the hull, whichever way it moves", () => {
    expect(froudeAt(Math.sqrt(9.81 * 4), 4)).toBeCloseTo(1, 9);
    expect(froudeAt(-3, 4)).toBeCloseTo(froudeAt(3, 4), 9);
  });
});

describe("trimAt", () => {
  it("leaves a hull at rest level and lifts the bow most near the hump speed", () => {
    const hump = 0.6 * Math.sqrt(9.81 * 4);
    expect(trimAt(0, 4)).toBe(0);
    expect(trimAt(hump, 4)).toBeCloseTo(0.11, 9);
    expect(trimAt(hump / 2, 4)).toBeLessThan(0.11);
    expect(trimAt(hump * 3, 4)).toBeLessThan(trimAt(hump, 4));
  });
});

describe("wake", () => {
  it("fills Kelvin's wedge of asin(1/3)", () => {
    expect((WAKE_ANGLE * 180) / Math.PI).toBeCloseTo(19.47, 2);
  });

  it("shows nothing at rest and grows toward a full wake", () => {
    expect(wakeStrength(0, 4)).toBe(0);
    expect(wakeStrength(4, 4)).toBeGreaterThan(wakeStrength(2, 4));
    expect(wakeStrength(40, 4)).toBeLessThanOrEqual(1);
  });
});

describe("riding ripples", () => {
  it("heaves and rolls a hull by a few centimetres and degrees, scaled by the water", () => {
    expect(heaveAt(0, 1)).toBeCloseTo(0.009 * Math.sin(1), 9);
    expect(Math.abs(heaveAt(3.1, 1))).toBeLessThanOrEqual(0.027);
    expect(heaveAt(3.1, 2)).toBeCloseTo(2 * heaveAt(3.1, 1), 9);
    expect(rollAt(0, 1)).toBeCloseTo(0.03 * Math.sin(0.4), 9);
    expect(rollAt(5, 0)).toBe(0);
  });
});
