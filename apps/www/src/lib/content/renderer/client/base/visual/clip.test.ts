import { describe, expect, it } from "@effect/vitest";
import { Array as Arr } from "effect";
import {
  clipPlaneLine,
  clipPlanePath,
  clipSpaceLine,
  containsPlanePoint,
  containsSpacePoint,
} from "@/lib/content/renderer/client/base/visual/clip";
import { resolveVisualGeometry } from "@/lib/content/renderer/client/base/visual/geometry";
import type {
  PlaneVisual,
  SpaceVisual,
} from "@/lib/content/renderer/client/base/visual/scene";
import { plane, space } from "@/test/scene";

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

describe("markers, rays and split paths at the frame", () => {
  it.each([
    [
      "a plane point inside the frame",
      plane({
        appearance: "primary",
        at: { x: 1, y: 2 },
        id: "p",
        kind: "point",
      }),
      "p",
    ],
    [
      "a space point inside the frame",
      space({
        appearance: "primary",
        at: { x: 1, y: 2, z: 3 },
        id: "p",
        kind: "point",
      }),
      "p",
    ],
  ])("keeps %s as a marker", (_label, visual, id) => {
    expect(
      Arr.map(resolveVisualGeometry(visual).markers, (marker) => marker.id)
    ).toEqual([id]);
  });

  it.each([
    [
      "a plane point outside the frame",
      plane({
        appearance: "primary",
        at: { x: 9, y: 9 },
        id: "p",
        kind: "point",
      }),
    ],
    [
      "a space point outside the frame",
      space({
        appearance: "primary",
        at: { x: 9, y: 0, z: 0 },
        id: "p",
        kind: "point",
      }),
    ],
    [
      "a plane line outside the frame",
      plane({
        appearance: "primary",
        id: "l",
        kind: "line",
        through: [
          { x: 0, y: 10 },
          { x: 1, y: 10 },
        ],
      }),
    ],
    [
      "a space line outside the frame",
      space({
        appearance: "primary",
        id: "l",
        kind: "line",
        through: [
          { x: 0, y: 10, z: 0 },
          { x: 1, y: 10, z: 0 },
        ],
      }),
    ],
  ])("omits %s", (_label, visual) => {
    expect(
      resolveVisualGeometry(visual).markers.length +
        resolveVisualGeometry(visual).paths.length
    ).toBe(0);
  });

  it("splits a plane polyline that leaves and re-enters the frame into numbered parts", () => {
    const geometry = resolveVisualGeometry(
      plane({
        appearance: "primary",
        id: "zigzag",
        kind: "polyline",
        vertices: [
          { x: 0, y: 0 },
          { x: 10, y: 0 },
          { x: 10, y: 1 },
          { x: 0, y: 1 },
        ],
      })
    );
    expect(Arr.map(geometry.paths, (path) => path.id)).toEqual([
      "zigzag:part:1",
      "zigzag:part:2",
    ]);
  });

  it.each([
    [
      "plane",
      plane({
        appearance: "primary",
        from: { x: 0, y: 0 },
        id: "r",
        kind: "ray",
        through: { x: 1, y: 0 },
      }),
    ],
    [
      "space",
      space({
        appearance: "primary",
        from: { x: 0, y: 0, z: 0 },
        id: "r",
        kind: "ray",
        through: { x: 1, y: 0, z: 0 },
      }),
    ],
  ])(
    "directs a %s ray from its origin toward the frame edge",
    (_label, visual) => {
      expect(
        Arr.map(resolveVisualGeometry(visual).paths, (path) => path.arrows)
      ).toEqual(["end"]);
    }
  );
});
