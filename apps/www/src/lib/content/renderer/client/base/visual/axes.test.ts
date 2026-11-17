import { describe, expect, it } from "@effect/vitest";
import { Array as Arr } from "effect";
import { resolveVisualAxes } from "@/lib/content/renderer/client/base/visual/axes";
import type {
  PlaneVisual,
  SpaceVisual,
} from "@/lib/content/renderer/client/base/visual/scene";
import {
  projectVisualFrame,
  projectVisualPoint,
  resolveVisualProjection,
} from "@/lib/content/renderer/client/base/visual/transform";
import { plane, space } from "@/test/scene";

const point = {
  appearance: "primary",
  at: { x: 2, y: 36 },
  id: "p",
  kind: "point",
} as const;

/** The axes of a scene, with the projection they were drawn through. */
function axesOf(scene: PlaneVisual | SpaceVisual) {
  const projection = resolveVisualProjection(scene);
  return { axes: resolveVisualAxes(scene, projection), projection };
}

describe("the axes of a MathVisual scene", () => {
  it("cross at the origin and span the frame when the frame holds the origin, naming no values", () => {
    const { axes, projection } = axesOf(
      plane({ ...point, at: { x: 1, y: 1 } })
    );
    const frame = projectVisualFrame(plane({ ...point }), projection);
    const origin = projectVisualPoint({ x: 0, y: 0 }, projection);

    expect(axes.anchor).toStrictEqual(origin);
    expect(axes.frame).toStrictEqual(frame);
    expect(axes.lines).toStrictEqual([
      {
        axis: "x",
        from: { ...origin, x: frame.x.min },
        to: { ...origin, x: frame.x.max },
      },
      {
        axis: "y",
        from: { ...origin, y: frame.y.min },
        to: { ...origin, y: frame.y.max },
      },
    ]);
    expect(axes.values).toStrictEqual([]);
  });

  it("stand at the frame's edge and name their real values when the frame leaves zero out", () => {
    const scene: PlaneVisual = {
      ...plane(point),
      frame: {
        kind: "cartesian",
        x: { max: 10, min: 0 },
        y: { max: 39, min: 35 },
      },
    };
    const { axes, projection } = axesOf(scene);
    const corner = projectVisualPoint({ x: 0, y: 35 }, projection);
    const top = projectVisualPoint({ x: 0, y: 39 }, projection);

    // The frame alone sets the projection: its middle, y = 37, is the middle of the picture.
    expect(projectVisualPoint({ x: 5, y: 37 }, projection)).toStrictEqual({
      x: 0,
      y: 0,
      z: 0,
    });
    // The x axis runs along the bottom edge, y = 35, not through y = 0.
    expect(axes.anchor).toStrictEqual(corner);
    expect(Arr.map(axes.lines, ({ from }) => from)).toStrictEqual([
      corner,
      corner,
    ]);
    expect(
      Arr.map(axes.values, ({ at, end, value }) => [end, value, at])
    ).toStrictEqual([
      ["min", 35, corner],
      ["max", 39, top],
    ]);
    expect(Arr.every(axes.values, ({ axis }) => axis === "y")).toBe(true);
  });

  it("take the z axis of a space scene, at the near face of a frame above zero", () => {
    const scene: SpaceVisual = {
      ...space({
        appearance: "primary",
        at: { x: 0, y: 0, z: 3 },
        id: "p",
        kind: "point",
      }),
      frame: {
        kind: "cartesian",
        x: { max: 6, min: -6 },
        y: { max: 5, min: -5 },
        z: { max: 4, min: 2 },
      },
    };
    const { axes, projection } = axesOf(scene);
    const floor = projectVisualPoint({ x: 0, y: 0, z: 2 }, projection);

    expect(Arr.map(axes.lines, ({ axis }) => axis)).toStrictEqual([
      "x",
      "y",
      "z",
    ]);
    expect(axes.anchor).toStrictEqual(floor);
    expect(
      Arr.map(axes.values, ({ axis, value }) => [axis, value])
    ).toStrictEqual([
      ["z", 2],
      ["z", 4],
    ]);
  });
});
