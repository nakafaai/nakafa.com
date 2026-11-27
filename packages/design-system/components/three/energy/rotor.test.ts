import { describe, expect, it } from "@effect/vitest";
import {
  ROTOR,
  rotorRate,
  spinnerProfile,
} from "@repo/design-system/components/three/energy/rotor";
import { Array as Arr, Option } from "effect";

describe("rotorRate", () => {
  it("runs the tips at seven times the wind speed", () => {
    expect(rotorRate(8, 40)).toBeCloseTo(1.4, 9);
    expect(rotorRate(8, 40) * 40).toBeCloseTo(56, 9);
    expect(rotorRate(4, 40)).toBeCloseTo(0.7, 9);
  });
});

describe("spinnerProfile", () => {
  it("runs from a straight skirt at full radius to a closed nose on the hub", () => {
    const profile = spinnerProfile(0.05, 0.08);
    expect(profile[0]?.[0]).toBe(0.05);
    expect(profile[0]?.[1]).toBeCloseTo(-0.06, 9);
    expect(profile[1]).toEqual([0.05, 0]);
    const nose = Option.getOrThrow(Arr.last(profile));
    expect(nose[0]).toBeCloseTo(0, 9);
    expect(nose[1]).toBeCloseTo(0.08, 9);
    expect(ROTOR.hub).toBeGreaterThan(1);
  });
});
