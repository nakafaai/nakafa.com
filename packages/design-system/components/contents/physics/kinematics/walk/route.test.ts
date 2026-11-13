import { describe, expect, it } from "@effect/vitest";
import {
  WalkSchema,
  walkCorners,
  walkDuration,
  walkLength,
  walkPoint,
  walkReading,
} from "@repo/design-system/components/contents/physics/kinematics/walk/route";
import { Schema } from "effect";

const detour = Schema.decodeSync(WalkSchema)({
  legs: [
    { east: 300, north: 0 },
    { east: 0, north: 400 },
  ],
  pace: 1.25,
});
const loop = Schema.decodeSync(WalkSchema)({
  legs: [
    { east: 100, north: 0 },
    { east: 0, north: 100 },
    { east: -100, north: 0 },
    { east: 0, north: -100 },
  ],
  pace: 1,
});

describe("walk geometry", () => {
  it("adds every leg into the path and lists the corners", () => {
    expect(walkLength(detour)).toBe(700);
    expect(walkDuration(detour)).toBe(560);
    expect(walkCorners(detour)).toEqual([
      { east: 0, north: 0 },
      { east: 300, north: 0 },
      { east: 300, north: 400 },
    ]);
  });

  it("places the walker along the legs", () => {
    expect(walkPoint(detour, 150)).toEqual({ east: 150, north: 0 });
    expect(walkPoint(detour, 500)).toEqual({ east: 300, north: 200 });
    expect(walkPoint(detour, 900)).toEqual({ east: 300, north: 400 });
  });

  it("refuses a walk with no legs or no pace", () => {
    expect(() =>
      Schema.decodeUnknownSync(WalkSchema)({ legs: [], pace: 1 })
    ).toThrow();
    expect(() =>
      Schema.decodeSync(WalkSchema)({
        legs: [{ east: 1, north: 0 }],
        pace: 0,
      })
    ).toThrow();
  });
});

describe("walkReading", () => {
  it("reads a 3-4-5 detour: 700 m walked, 500 m displaced", () => {
    const end = walkReading(detour, 560);
    expect(end.walked).toBe(700);
    expect(end.displacement).toBe(500);
    expect(end.bearing).toBeCloseTo(53.13, 2);
    expect(end.averageSpeed).toBe(1.25);
    expect(end.averageVelocity).toBeCloseTo(500 / 560);
  });

  it("reads zero displacement and zero average velocity after a closed loop", () => {
    const end = walkReading(loop, 400);
    expect(end.walked).toBe(400);
    expect(end.displacement).toBeCloseTo(0);
    expect(end.bearing).toBe(0);
    expect(end.averageVelocity).toBeCloseTo(0);
  });

  it("reads nothing before the start", () => {
    const start = walkReading(detour, -5);
    expect(start.elapsed).toBe(0);
    expect(start.averageSpeed).toBe(0);
    expect(start.averageVelocity).toBe(0);
  });

  it("skips a leg of zero length", () => {
    const still = Schema.decodeSync(WalkSchema)({
      legs: [
        { east: 0, north: 0 },
        { east: 10, north: 0 },
      ],
      pace: 1,
    });
    expect(walkPoint(still, 0)).toEqual({ east: 0, north: 0 });
    expect(walkPoint(still, 5)).toEqual({ east: 5, north: 0 });
  });
});
