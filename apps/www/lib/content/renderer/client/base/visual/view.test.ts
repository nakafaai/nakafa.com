import { describe, expect, it } from "@effect/vitest";
import type { SpaceVisual } from "@/lib/content/renderer/client/base/visual/scene";
import {
  getSpaceFrameExtent,
  projectSpaceFrame,
  projectSpacePoint,
  resolveSpaceProjection,
} from "@/lib/content/renderer/client/base/visual/transform";
import { resolveSpaceView } from "@/lib/content/renderer/client/base/visual/view";

function scene(view: SpaceVisual["view"]): SpaceVisual {
  return {
    frame: {
      axes: "visible",
      grid: "visible",
      kind: "cartesian",
      x: { max: 5, min: -1 },
      y: { max: 7, min: -1 },
      z: { max: 9, min: -1 },
    },
    objects: [
      {
        appearance: "primary",
        at: { x: 0, y: 0, z: 0 },
        id: "origin",
        kind: "point",
      },
    ],
    space: "space",
    view,
  };
}

describe("MathVisual space view", () => {
  it.each<SpaceVisual["view"]>([
    { kind: "fit", padding: 2 },
    { kind: "isometric" },
    {
      kind: "camera",
      position: { x: 4, y: 5, z: 6 },
      target: { x: 1, y: 2, z: 3 },
    },
  ])(
    "bounds the $kind view relative to its initial framing",
    (authoredView) => {
      const view = resolveSpaceView(scene(authoredView));
      const distance = Math.hypot(
        view.position[0] - view.target[0],
        view.position[1] - view.target[1],
        view.position[2] - view.target[2]
      );

      expect(view.controls.maxDistance / distance).toBeCloseTo(1.5);
      expect(view.controls.minDistance).toBeLessThan(distance);
      expect(view.projection.far).toBeGreaterThan(view.controls.maxDistance);
    }
  );

  it("uses equal camera directions and orthographic projection for isometric views", () => {
    const view = resolveSpaceView(scene({ kind: "isometric" }));
    const offsets = view.position.map(
      (coordinate, index) => coordinate - view.target[index]
    );

    expect(offsets[0]).toBe(offsets[1]);
    expect(offsets[1]).toBe(offsets[2]);
    expect(view).toMatchObject({
      projection: { kind: "orthographic", viewHeight: 24 },
      target: [0, 0, 0],
    });
  });

  it("preserves explicit authored camera positions and targets", () => {
    const view = resolveSpaceView(
      scene({
        kind: "camera",
        position: { x: 4, y: 5, z: 6 },
        target: { x: 1, y: 2, z: 3 },
      })
    );
    const projection = resolveSpaceProjection(
      scene({
        kind: "camera",
        position: { x: 4, y: 5, z: 6 },
        target: { x: 1, y: 2, z: 3 },
      })
    );
    const position = projectSpacePoint({ x: 4, y: 5, z: 6 }, projection);
    const target = projectSpacePoint({ x: 1, y: 2, z: 3 }, projection);
    const distance = Math.hypot(
      position.x - target.x,
      position.y - target.y,
      position.z - target.z
    );

    expect(view).toEqual({
      controls: {
        maxDistance: expect.any(Number),
        minDistance: expect.any(Number),
      },
      position: [position.x, position.y, position.z],
      projection: {
        far: expect.any(Number),
        kind: "perspective",
        near: expect.any(Number),
      },
      target: [target.x, target.y, target.z],
    });
    expect(view.controls.minDistance).toBeLessThan(distance);
    expect(view.controls.maxDistance).toBeGreaterThan(distance);
  });

  it("fits asymmetric frames around their exact center", () => {
    const visual = scene({ kind: "fit", padding: 2 });
    const view = resolveSpaceView(visual);

    expect(getSpaceFrameExtent(visual)).toBe(10);
    expect(view.target).toEqual([0, 0, 0]);
    expect(view.projection).toMatchObject({ kind: "perspective" });
  });

  it("keeps a large fit camera inside derived orbit and clipping bounds", () => {
    const visual = {
      ...scene({ kind: "fit" }),
      frame: {
        axes: "visible",
        grid: "visible",
        kind: "cartesian",
        x: { max: 1000, min: -1000 },
        y: { max: 1000, min: -1000 },
        z: { max: 1000, min: -1000 },
      },
    } satisfies SpaceVisual;
    const view = resolveSpaceView(visual);
    const distance = Math.hypot(
      view.position[0] - view.target[0],
      view.position[1] - view.target[1],
      view.position[2] - view.target[2]
    );

    expect(distance).toBeGreaterThan(10);
    expect(view.controls.minDistance).toBeLessThan(distance);
    expect(view.controls.maxDistance).toBeGreaterThan(distance);
    expect(view.projection.near).toBeLessThan(distance);
    expect(view.projection.far).toBeGreaterThan(distance);
  });

  it("keeps the widest finite frame and derived camera GPU-finite", () => {
    const visual = {
      ...scene({ kind: "fit" }),
      frame: {
        axes: "visible",
        grid: "visible",
        kind: "cartesian",
        x: { max: 1e308, min: -1e308 },
        y: { max: 1e308, min: -1e308 },
        z: { max: 1e308, min: -1e308 },
      },
    } satisfies SpaceVisual;
    const projection = resolveSpaceProjection(visual);
    const frame = projectSpaceFrame(visual.frame, projection);
    const view = resolveSpaceView(visual, projection);
    const values = [
      ...view.position,
      ...view.target,
      view.controls.maxDistance,
      view.controls.minDistance,
      view.projection.far,
      view.projection.near,
      frame.x.min,
      frame.x.max,
      frame.y.min,
      frame.y.max,
      frame.z.min,
      frame.z.max,
    ];

    expect(values.every((value) => Number.isFinite(value))).toBe(true);
    expect(frame).toEqual({
      x: { max: 5, min: -5 },
      y: { max: 5, min: -5 },
      z: { max: 5, min: -5 },
    });
  });

  it("uses the same projection for the authored isometric target", () => {
    const visual = scene({
      kind: "isometric",
      target: { x: 2, y: 3, z: 4 },
    });
    const projection = resolveSpaceProjection(visual);
    const target = projectSpacePoint({ x: 2, y: 3, z: 4 }, projection);

    expect(resolveSpaceView(visual, projection).target).toEqual([
      target.x,
      target.y,
      target.z,
    ]);
  });
});
