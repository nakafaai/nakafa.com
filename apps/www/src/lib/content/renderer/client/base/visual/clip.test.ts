import { describe, expect, it } from "@effect/vitest";
import {
  clipPlaneLine,
  clipPlanePath,
  clipSpaceLine,
  containsPlanePoint,
  containsSpacePoint,
} from "@/lib/content/renderer/client/base/visual/clip";
import type {
  PlaneVisual,
  SpaceVisual,
} from "@/lib/content/renderer/client/base/visual/scene";

const planeFrame: PlaneVisual["frame"] = {
  kind: "cartesian",
  x: { max: 5, min: -5 },
  y: { max: 4, min: -4 },
};

const spaceFrame: SpaceVisual["frame"] = {
  kind: "cartesian",
  x: { max: 6, min: -6 },
  y: { max: 5, min: -5 },
  z: { max: 4, min: -4 },
};

describe("frame containment", () => {
  it("contains a plane point inside both ranges", () => {
    expect(containsPlanePoint(planeFrame, { x: 0, y: 0 })).toBe(true);
  });

  it.each([
    ["x below its range", { x: -6, y: 0 }],
    ["x above its range", { x: 6, y: 0 }],
    ["y below its range", { x: 0, y: -5 }],
    ["y above its range", { x: 0, y: 5 }],
  ])("rejects a plane point with %s", (_label, point) => {
    expect(containsPlanePoint(planeFrame, point)).toBe(false);
  });

  it("contains a space point inside every range", () => {
    expect(containsSpacePoint(spaceFrame, { x: 0, y: 0, z: 0 })).toBe(true);
  });

  it.each([
    ["x below its range", { x: -7, y: 0, z: 0 }],
    ["x above its range", { x: 7, y: 0, z: 0 }],
    ["y below its range", { x: 0, y: -6, z: 0 }],
    ["y above its range", { x: 0, y: 6, z: 0 }],
    ["z below its range", { x: 0, y: 0, z: -5 }],
    ["z above its range", { x: 0, y: 0, z: 5 }],
  ])("rejects a space point with %s", (_label, point) => {
    expect(containsSpacePoint(spaceFrame, point)).toBe(false);
  });
});

describe("line clipping", () => {
  it("clips a space line to the frame and a space ray from its origin", () => {
    const origin = { x: 0, y: 0, z: 0 };
    const through = { x: 1, y: 0, z: 0 };
    expect(clipSpaceLine(spaceFrame, origin, through, false)).toEqual([
      { x: -6, y: 0, z: 0 },
      { x: 6, y: 0, z: 0 },
    ]);
    expect(clipSpaceLine(spaceFrame, origin, through, true)).toEqual([
      { x: 0, y: 0, z: 0 },
      { x: 6, y: 0, z: 0 },
    ]);
  });

  it("clips a plane line and ray to the frame", () => {
    const origin = { x: 0, y: 0 };
    const through = { x: 1, y: 0 };
    expect(clipPlaneLine(planeFrame, origin, through, false)).toEqual([
      { x: -5, y: 0 },
      { x: 5, y: 0 },
    ]);
    expect(clipPlaneLine(planeFrame, origin, through, true)).toEqual([
      { x: 0, y: 0 },
      { x: 5, y: 0 },
    ]);
  });

  it("misses a diagonal line that passes outside the frame", () => {
    expect(
      clipPlaneLine(planeFrame, { x: -10, y: 0 }, { x: -9, y: 1 }, false)
    ).toBeUndefined();
  });

  it("closes a plane path back onto its first point", () => {
    expect(
      clipPlanePath(
        planeFrame,
        [
          { x: 0, y: 0 },
          { x: 1, y: 0 },
          { x: 1, y: 1 },
        ],
        true
      )
    ).toEqual([
      [
        { x: 0, y: 0 },
        { x: 1, y: 0 },
        { x: 1, y: 1 },
        { x: 0, y: 0 },
      ],
    ]);
  });

  it("returns no path for a closed path without points", () => {
    expect(clipPlanePath(planeFrame, [], true)).toEqual([]);
  });
});
