import { describe, expect, it } from "@effect/vitest";
import {
  displacement,
  HopsSchema,
  hopCorners,
  hopPoint,
  pathLength,
  scaleHops,
} from "@repo/design-system/components/contents/physics/vector/drone/flight";
import { Schema } from "effect";

const flight = Schema.decodeUnknownSync(HopsSchema)([
  { east: 0, north: 0, up: 12 },
  { east: 3, north: 4, up: 0 },
]);

describe("displacement", () => {
  it("adds 12 m up and a 3, 4 m hop into 13 m from the pad", () => {
    const moved = displacement(flight);
    expect(moved).toEqual({ east: 3, north: 4, size: 13, up: 12 });
    expect(pathLength(flight)).toBe(17);
  });
});

describe("scaleHops", () => {
  it("doubles every component and the size for a factor of 2", () => {
    const moved = displacement(scaleHops(flight, 2));
    expect(moved).toEqual({ east: 6, north: 8, size: 26, up: 24 });
  });

  it("turns the displacement around for a factor of -1", () => {
    const moved = displacement(scaleHops(flight, -1));
    expect(moved.east).toBe(-3);
    expect(moved.up).toBe(-12);
    expect(moved.size).toBe(13);
  });
});

describe("hopCorners", () => {
  it("starts at the pad and ends at the displacement", () => {
    expect(hopCorners(flight)).toEqual([
      { east: 0, north: 0, up: 0 },
      { east: 0, north: 0, up: 12 },
      { east: 3, north: 4, up: 12 },
    ]);
  });
});

describe("hopPoint", () => {
  it("climbs first, then flies the level hop", () => {
    expect(hopPoint(flight, 6)).toEqual({ east: 0, north: 0, up: 6 });
    expect(hopPoint(flight, 14.5)).toEqual({ east: 1.5, north: 2, up: 12 });
  });

  it("stays on the pad before the start and hovers at the end after it", () => {
    expect(hopPoint(flight, -2)).toEqual({ east: 0, north: 0, up: 0 });
    expect(hopPoint(flight, 40)).toEqual({ east: 3, north: 4, up: 12 });
  });

  it("stands still on a leg of no length", () => {
    const hover = Schema.decodeUnknownSync(HopsSchema)([
      { east: 0, north: 0, up: 0 },
    ]);
    expect(hopPoint(hover, 5)).toEqual({ east: 0, north: 0, up: 0 });
  });
});
