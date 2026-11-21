import { describe, expect, it } from "@effect/vitest";
import type {
  PlaneVisual,
  SpaceVisual,
} from "@/lib/content/renderer/client/base/visual/scene";
import {
  projectVisualFrame,
  projectVisualPoint,
  resolveVisualProjection,
  sampleProjector,
} from "@/lib/content/renderer/client/base/visual/transform";

function plane(
  x: PlaneVisual["frame"]["x"],
  y = x,
  objects: PlaneVisual["objects"] = [
    {
      kind: "point",
      id: "origin",
      appearance: "primary",
      at: { x: 0, y: 0 },
    },
  ]
): PlaneVisual {
  return {
    space: "plane",
    frame: { kind: "cartesian", x, y },
    view: { kind: "fit" },
    objects,
  };
}

/** How far one unit of each axis reaches in the world. */
function units(scene: PlaneVisual) {
  const projection = resolveVisualProjection(scene);
  const origin = projectVisualPoint({ x: 0, y: 0 }, projection);
  return {
    x: projectVisualPoint({ x: 1, y: 0 }, projection).x - origin.x,
    y: projectVisualPoint({ x: 0, y: 1 }, projection).y - origin.y,
  };
}
describe("MathVisual normalization", () => {
  it("keeps one scale on a graph whose frame fits the card's aspect", () => {
    const scene = plane({ min: -2, max: 2 }, { min: -1, max: 2 });
    const projection = resolveVisualProjection(scene);
    expect(units(scene)).toEqual({ x: 2.5, y: 2.5 });
    expect(projectVisualFrame(scene, projection)).toEqual({
      x: { min: -5, max: 5 },
      y: { min: -3.75, max: 3.75 },
      z: { min: 0, max: 0 },
    });
  });
  it("gives a graph's short axis its own scale, so a 5:1 frame fills the card's aspect", () => {
    const scene = plane({ min: 0, max: 50 }, { min: 0, max: 10 });
    const projection = resolveVisualProjection(scene);
    const frame = projectVisualFrame(scene, projection);
    expect(frame.x).toEqual({ min: -5, max: 5 });
    expect((frame.x.max - frame.x.min) / (frame.y.max - frame.y.min)).toBe(
      1.43
    );
    expect(units(scene).y).toBeGreaterThan(units(scene).x);
  });
  it("draws a tall graph in a square, which a phone's square card fills", () => {
    const scene = plane({ min: 0, max: 2 }, { min: 0, max: 120 });
    const frame = projectVisualFrame(scene, resolveVisualProjection(scene));
    expect(frame.x).toEqual({ min: -5, max: 5 });
    expect(frame.y).toEqual({ min: -5, max: 5 });
  });
  it.each([
    {
      kind: "circle",
      id: "figure",
      appearance: "primary",
      center: { x: 25, y: 5 },
      radius: 4,
    },
    {
      kind: "polygon",
      id: "figure",
      appearance: "primary",
      vertices: [
        { x: 0, y: 0 },
        { x: 40, y: 0 },
        { x: 20, y: 8 },
      ],
    },
    {
      kind: "vector",
      id: "figure",
      appearance: "primary",
      from: { x: 0, y: 0 },
      to: { x: 30, y: 6 },
    },
  ] satisfies PlaneVisual["objects"])(
    "keeps one scale on a 5:1 frame that holds a $kind, so its shape stays true",
    (figure) => {
      const scene = plane({ min: 0, max: 50 }, { min: 0, max: 10 }, [figure]);
      const { x, y } = units(scene);
      expect(x).toBeCloseTo(0.2, 12);
      expect(y).toBeCloseTo(0.2, 12);
    }
  );
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
    }
  );
  it("scales padding proportionally per axis on independent-scale plane graphs", () => {
    const scene = {
      ...plane({ min: 0, max: 0.8 }, { min: 0, max: 16 }),
      view: { kind: "fit", padding: 1 },
    } satisfies PlaneVisual;
    const projection = resolveVisualProjection(scene);
    const padded = projectVisualFrame(scene, projection, true);
    const unpadded = projectVisualFrame(scene, projection, false);
    expect(padded.x).toEqual({ min: -5, max: 5 });
    expect(padded.y).toEqual({ min: -5, max: 5 });
    expect(unpadded.x.max - unpadded.x.min).toBeCloseTo(
      unpadded.y.max - unpadded.y.min,
      12
    );
    expect(unpadded.x.max - unpadded.x.min).toBeCloseTo((16 / 18) * 10, 12);
  });

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

  it.each([
    plane({ min: -2, max: 8 }, { min: -1, max: 3 }),
    plane({ min: 0, max: 50 }, { min: 0, max: 10 }),
  ])(
    "projects sampled points through the same map as authored points",
    (scene) => {
      const projection = resolveVisualProjection(scene);
      const project = sampleProjector(projection);
      const point = { x: 3.25, y: -0.5, z: 0 };
      const exact = projectVisualPoint(point, projection);
      const sampled = project(point);

      expect(sampled.x).toBeCloseTo(exact.x, 12);
      expect(sampled.y).toBeCloseTo(exact.y, 12);
      expect(sampled.z).toBeCloseTo(exact.z, 12);
    }
  );
});
