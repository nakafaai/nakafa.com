import { describe, expect, it } from "@effect/vitest";
import type {
  PlaneVisual,
  SpaceVisual,
} from "@/lib/content/renderer/client/base/visual/scene";
import {
  projectVisualFrame,
  projectVisualMeasure,
  projectVisualPoint,
  resolveVisualProjection,
} from "@/lib/content/renderer/client/base/visual/transform";

function plane(x: PlaneVisual["frame"]["x"], y = x): PlaneVisual {
  return {
    space: "plane",
    frame: { kind: "cartesian", x, y },
    view: { kind: "fit" },
    objects: [
      {
        kind: "point",
        id: "origin",
        appearance: "primary",
        at: { x: 0, y: 0 },
      },
    ],
  };
}
describe("MathVisual normalization", () => {
  it("preserves one uniform scale across points, lengths, and asymmetric frame bounds", () => {
    const scene = plane({ min: -2, max: 8 }, { min: -1, max: 3 });
    const projection = resolveVisualProjection(scene);
    const origin = projectVisualPoint({ x: 0, y: 0 }, projection);
    const xUnit = projectVisualPoint({ x: 1, y: 0 }, projection);
    const yUnit = projectVisualPoint({ x: 0, y: 1 }, projection);
    expect(xUnit.x - origin.x).toBe(yUnit.y - origin.y);
    expect(xUnit.x - origin.x).toBe(projectVisualMeasure(1, projection));
    expect(projectVisualFrame(scene, projection)).toEqual({
      x: { min: -5, max: 5 },
      y: { min: -2, max: 2 },
      z: { min: 0, max: 0 },
    });
    expect(projectVisualMeasure(0, projection)).toBe(0);
  });
  it.each([
    { min: -1e308, max: 1e308 },
    { min: 0, max: Number.MIN_VALUE },
  ])(
    "normalizes extreme finite ranges without losing their extent",
    (range) => {
      const scene = plane(range);
      const projection = resolveVisualProjection(scene);
      expect(
        projectVisualPoint({ x: range.min, y: range.min }, projection)
      ).toEqual({ x: -5, y: -5, z: 0 });
      expect(
        projectVisualPoint({ x: range.max, y: range.max }, projection)
      ).toEqual({ x: 5, y: 5, z: 0 });
      expect(projectVisualMeasure(range.max, projection)).toBeGreaterThan(0);
    }
  );
  it("includes padding without introducing mathematical depth to a plane", () => {
    const scene = {
      ...plane({ min: -2, max: 2 }),
      view: { kind: "fit", padding: 3 },
    } satisfies PlaneVisual;
    const projection = resolveVisualProjection(scene);
    expect(projectVisualFrame(scene, projection, true)).toEqual({
      x: { min: -5, max: 5 },
      y: { min: -5, max: 5 },
      z: { min: 0, max: 0 },
    });
    expect(projectVisualFrame(scene, projection).x).toEqual({
      min: -2,
      max: 2,
    });
  });
  it("includes an extreme explicit camera and target in the same finite transform", () => {
    const scene = {
      space: "space",
      frame: {
        kind: "cartesian",
        x: { min: -1, max: 1 },
        y: { min: -1, max: 1 },
        z: { min: -1, max: 1 },
      },
      view: {
        kind: "camera",
        position: { x: 1e308, y: 1e308, z: 1e308 },
        target: { x: -1e308, y: -1e308, z: -1e308 },
      },
      objects: [
        {
          kind: "point",
          id: "origin",
          appearance: "primary",
          at: { x: 0, y: 0, z: 0 },
        },
      ],
    } satisfies SpaceVisual;
    const projection = resolveVisualProjection(scene);
    expect(projectVisualPoint(scene.view.position, projection)).toEqual({
      x: 5,
      y: 5,
      z: 5,
    });
    expect(projectVisualPoint(scene.view.target, projection)).toEqual({
      x: -5,
      y: -5,
      z: -5,
    });
  });
});
