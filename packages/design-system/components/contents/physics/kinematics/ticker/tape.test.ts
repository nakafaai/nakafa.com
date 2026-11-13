import { describe, expect, it } from "@effect/vitest";
import {
  STRIP_SECONDS,
  stripAcceleration,
  TAPE_MOTIONS,
  tapePosition,
  tapeStrips,
  tapeTicks,
} from "@repo/design-system/components/contents/physics/kinematics/ticker/tape";

describe("tape motions", () => {
  it("cover the same 0.48 m in 0.8 s, so only the spacing differs", () => {
    for (const motion of ["uniform", "speeding", "slowing"] as const) {
      expect(tapePosition(motion, TAPE_MOTIONS[motion].duration)).toBeCloseTo(
        0.48
      );
    }
  });

  it("never reverse before the run ends", () => {
    const { acceleration, duration, initialVelocity } = TAPE_MOTIONS.slowing;
    expect(initialVelocity + acceleration * duration).toBeGreaterThan(0);
  });
});

describe("tapeTicks", () => {
  it("strikes 50 times a second, from the start to the end", () => {
    const ticks = tapeTicks("uniform");
    expect(ticks).toHaveLength(41);
    expect(ticks.at(1)).toBeCloseTo(0.02);
    expect(ticks.at(-1)).toBeCloseTo(0.8);
  });
});

describe("tapeStrips", () => {
  it("cuts equal strips for uniform motion", () => {
    const strips = tapeStrips("uniform");
    expect(strips).toHaveLength(8);
    for (const strip of strips) {
      expect(strip).toBeCloseTo(0.06);
    }
  });

  it("grows each strip by a·t² when speeding up", () => {
    const strips = tapeStrips("speeding");
    expect(strips.at(0)).toBeCloseTo(0.025);
    expect(strips.at(1)).toBeCloseTo(0.035);
    expect(strips.at(-1)).toBeCloseTo(0.095);
  });

  it("shrinks each strip when slowing down", () => {
    const strips = tapeStrips("slowing");
    expect(strips.at(0)).toBeCloseTo(0.095);
    expect(strips.at(-1)).toBeCloseTo(0.025);
  });
});

describe("stripAcceleration", () => {
  it("reads the acceleration back from the strips", () => {
    expect(stripAcceleration(tapeStrips("speeding"))).toBeCloseTo(1);
    expect(stripAcceleration(tapeStrips("slowing"))).toBeCloseTo(-1);
    expect(stripAcceleration(tapeStrips("uniform"))).toBe(0);
  });

  it("reads no acceleration from one strip or none", () => {
    expect(stripAcceleration([0.05])).toBe(0);
    expect(stripAcceleration([])).toBe(0);
  });

  it("uses a tenth of a second per strip", () => {
    expect(STRIP_SECONDS).toBeCloseTo(0.1);
  });
});
