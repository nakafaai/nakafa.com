import { describe, expect, it } from "@effect/vitest";
import {
  ROTOR,
  rotorRate,
  spinnerProfile,
  streamRadius,
  windShare,
} from "@repo/design-system/components/three/energy/rotor";
import { Array as Arr, Option } from "effect";

describe("rotorRate", () => {
  it("runs the tips at seven times the wind speed", () => {
    expect(rotorRate(8, 40)).toBeCloseTo(1.4, 9);
    expect(rotorRate(8, 40) * 40).toBeCloseTo(56, 9);
    expect(rotorRate(4, 40)).toBeCloseTo(0.7, 9);
  });
});

describe("windShare", () => {
  it("leaves the wind whole far upwind, two thirds at the rotor and a third far behind", () => {
    expect(windShare(-1000)).toBeCloseTo(1, 5);
    expect(windShare(0)).toBeCloseTo(2 / 3, 9);
    expect(windShare(1000)).toBeCloseTo(1 / 3, 5);
  });
});

describe("streamRadius", () => {
  it("widens the stream tube as the air slows, keeping its flow", () => {
    expect(streamRadius(0.5, 0)).toBeCloseTo(0.5, 9);
    expect(streamRadius(0.5, 1000)).toBeCloseTo(0.5 * Math.SQRT2, 4);
    expect(streamRadius(0.5, -1000)).toBeCloseTo(0.5 * Math.sqrt(2 / 3), 4);
  });

  it("pushes the air round the rotor outward by the room the wake takes", () => {
    expect(streamRadius(1.2, 0)).toBeCloseTo(1.2, 9);
    expect(streamRadius(1.2, 1000)).toBeCloseTo(Math.sqrt(1.44 + 1), 4);
    expect(streamRadius(1, 1000)).toBeCloseTo(Math.SQRT2, 4);
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
