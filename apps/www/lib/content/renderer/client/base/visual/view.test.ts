import { describe, expect, it } from "@effect/vitest";
import type {
  PlaneVisual,
  SpaceVisual,
} from "@/lib/content/renderer/client/base/visual/scene";
import {
  projectVisualPoint,
  resolveVisualProjection,
} from "@/lib/content/renderer/client/base/visual/transform";
import { resolveMathView } from "@/lib/content/renderer/client/base/visual/view";

function scene(view: SpaceVisual["view"]): SpaceVisual {
  return {
    frame: {
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

describe("MathVisual camera direction", () => {
  it("starts a plane directly in front of the authored center", () => {
    const visual = {
      space: "plane",
      frame: {
        kind: "cartesian",
        x: { min: -5, max: 5 },
        y: { min: -4, max: 4 },
      },
      objects: [
        {
          appearance: "primary",
          kind: "point",
          id: "origin",
          at: { x: 0, y: 0 },
        },
      ],
      view: { kind: "fit" },
    } satisfies PlaneVisual;
    expect(resolveMathView(visual)).toEqual({
      position: [0, 0, 15],
      target: [0, 0, 0],
      projection: { kind: "perspective" },
    });
  });
  it("uses equal camera directions for isometric views and lets measured subjects determine scale", () => {
    const view = resolveMathView(scene({ kind: "isometric" }));
    expect(
      view.position.map((value, index) => value - view.target[index])
    ).toEqual([12, 12, 12]);
    expect(view.projection).toEqual({ kind: "orthographic" });
  });
  it("preserves explicit authored camera positions and targets", () => {
    const visual = scene({
      kind: "camera",
      position: { x: 4, y: 5, z: 6 },
      target: { x: 1, y: 2, z: 3 },
    });
    expect(resolveMathView(visual)).toMatchObject({
      position: [2, 2, 2],
      target: [-1, -1, -1],
      projection: { kind: "perspective" },
    });
  });
  it("fits asymmetric frames around their exact center including padding", () => {
    const view = resolveMathView(scene({ kind: "fit", padding: 2 }));
    expect(view.target).toEqual([0, 0, 0]);
    expect(view.position).toEqual([12, 8, 12]);
  });
  it("keeps the widest finite frame and derived camera GPU-finite", () => {
    const visual = {
      ...scene({ kind: "fit" }),
      frame: {
        kind: "cartesian",
        x: { min: -1e308, max: 1e308 },
        y: { min: -1e308, max: 1e308 },
        z: { min: -1e308, max: 1e308 },
      },
    } satisfies SpaceVisual;
    const view = resolveMathView(visual);
    expect([...view.position, ...view.target].every(Number.isFinite)).toBe(
      true
    );
  });
  it("uses the same projection for an authored isometric target", () => {
    const visual = scene({
      kind: "isometric",
      target: { x: 20, y: 30, z: 40 },
    });
    const projection = resolveVisualProjection(visual);
    const target = projectVisualPoint({ x: 20, y: 30, z: 40 }, projection);
    expect(resolveMathView(visual, projection).target).toEqual([
      target.x,
      target.y,
      target.z,
    ]);
  });
});
