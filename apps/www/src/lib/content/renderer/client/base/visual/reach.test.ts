import { describe, expect, it } from "@effect/vitest";
import { resolveVisualReach } from "@/lib/content/renderer/client/base/visual/reach";
import {
  projectVisualFrame,
  projectVisualPoint,
  resolveVisualProjection,
} from "@/lib/content/renderer/client/base/visual/transform";
import { plane } from "@/test/scene";

const point = {
  appearance: "primary",
  at: { x: 2, y: 36 },
  id: "p",
  kind: "point",
} as const;

describe("the reach of a MathVisual scene", () => {
  it("frames the padded frame first, from the true origin, and reaches three world extents past its center", () => {
    const scene = {
      ...plane({ ...point, at: { x: 1, y: 1 } }),
      view: { kind: "fit", padding: 0.5 },
    } as const;
    const projection = resolveVisualProjection(scene);
    const reach = resolveVisualReach(scene, projection);

    expect(reach.focus).toStrictEqual(
      projectVisualFrame(scene, projection, true)
    );
    expect(reach.origin).toStrictEqual(
      projectVisualPoint({ x: 0, y: 0 }, projection)
    );
    expect(reach.radius).toBe(30);
    // The padded frame is 11 by 9, so one authored unit takes 10 / 11 world units on each axis.
    expect(reach.scale.x).toBeCloseTo(10 / 11, 12);
    expect(reach.scale.y).toBeCloseTo(10 / 11, 12);
    expect(reach.box.x).toStrictEqual({ max: 33, min: -33 });
    expect(reach.box.y).toStrictEqual({ max: 33, min: -33 });
  });

  it("keeps the true origin of a frame far from zero, outside the reach, where no axis is drawn", () => {
    const scene = {
      ...plane(point),
      frame: {
        kind: "cartesian",
        x: { max: 4, min: 0 },
        y: { max: 39, min: 35 },
      },
    } as const;
    const projection = resolveVisualProjection(scene);
    const reach = resolveVisualReach(scene, projection);

    expect(reach.origin.y).toBe(-92.5);
    expect(Math.abs(reach.origin.y)).toBeGreaterThan(reach.radius);
    expect(reach.box.y).toStrictEqual({ max: 49, min: 25 });
  });
});
