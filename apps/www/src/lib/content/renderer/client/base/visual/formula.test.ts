import { describe, expect, it } from "@effect/vitest";
import { Array as Arr, Option, Result } from "effect";
import {
  isPlaneFormula,
  isSpaceFormula,
  labelPoint,
  readoutValues,
  resolveFormulaShapes,
} from "@/lib/content/renderer/client/base/visual/formula";
import type {
  PlaneVisual,
  SpaceVisual,
} from "@/lib/content/renderer/client/base/visual/scene";
import { resolveVisualProjection } from "@/lib/content/renderer/client/base/visual/transform";

const planeFrame = {
  kind: "cartesian",
  x: { max: 4, min: -4 },
  y: { max: 4, min: -4 },
} as const;
const fields = { appearance: "primary" } as const;

/** A plane scene of the given objects. */
function plane(objects: PlaneVisual["objects"], labels: PlaneVisual["labels"] = []): PlaneVisual {
  return { frame: planeFrame, labels, objects, space: "plane", view: { kind: "fit" } };
}

/** A space scene of the given objects. */
function space(objects: SpaceVisual["objects"]): SpaceVisual {
  return {
    frame: { ...planeFrame, z: { max: 4, min: -4 } },
    objects,
    space: "space",
    view: { kind: "fit" },
  };
}

/** Resolves a scene's formula shapes, failing the test when they do not resolve. */
function shapes(scene: PlaneVisual | SpaceVisual, scope: Readonly<Record<string, number>> = {}) {
  const resolved = resolveFormulaShapes(scene, resolveVisualProjection(scene), scope);
  expect(Result.isSuccess(resolved)).toBe(true);
  return Result.isSuccess(resolved) ? resolved.success : [];
}

describe("formula shapes", () => {
  it("tells formula objects from the objects geometry draws", () => {
    expect(isPlaneFormula({ ...fields, formula: "x", id: "f", kind: "function" })).toBe(true);
    expect(isPlaneFormula({ ...fields, at: { x: 0, y: 0 }, id: "p", kind: "point" })).toBe(false);
    expect(isSpaceFormula({ ...fields, axis: "x", domain: { max: 1, min: 0 }, formula: "x", id: "r", kind: "revolution" })).toBe(true);
    expect(isSpaceFormula({ ...fields, at: { x: 0, y: 0, z: 0 }, id: "p", kind: "point" })).toBe(false);
  });

  it("samples curves with sliders and labels, splitting branches into parts", () => {
    const resolved = shapes(
      plane(
        [
          { ...fields, formula: "a / x", id: "hyperbola", kind: "function" },
          { ...fields, formula: "y^2", id: "sideways", inputAxis: "y", kind: "function" },
          { ...fields, at: { x: 0, y: 0 }, id: "origin", kind: "point" },
        ],
        [{ at: { x: 2, y: 1 }, key: "label", objectId: "hyperbola" }]
      ),
      { a: 2 }
    );

    expect(Arr.map(resolved, ({ id, kind }) => `${kind}:${id}`)).toStrictEqual([
      "curve:hyperbola:part:1",
      "curve:hyperbola:part:2",
      "curve:sideways",
    ]);
  });

  it("projects regions, surfaces, and solids into scene units", () => {
    const region = shapes(plane([{ ...fields, id: "half", inequalities: ["y < x"], kind: "region" }]));
    expect(region[0]?.kind).toBe("region");

    const base = [
      { x: 0, y: 0, z: 0 },
      { x: 2, y: 0, z: 0 },
      { x: 0, y: 2, z: 0 },
    ] as const;
    const solid = shapes(
      space([
        { ...fields, formula: "x y / 8", id: "saddle", kind: "function" },
        { ...fields, base, id: "prism", kind: "prism", offset: { x: 0, y: 0, z: 2 } },
        { ...fields, at: { x: 0, y: 0, z: 0 }, id: "origin", kind: "point" },
      ])
    );
    expect(Arr.map(solid, ({ kind }) => kind)).toStrictEqual(["surface", "solid"]);
    const [surface] = solid;
    expect(
      surface?.kind === "surface" &&
        Arr.every(Arr.getSomes(surface.grid.points), ({ x }) => x >= surface.min.x - 1e-9 && x <= surface.max.x + 1e-9)
    ).toBe(true);
    expect(surface?.kind === "surface" && Option.isSome(surface.grid.points[0] ?? Option.none())).toBe(true);
  });

  it("returns the failure of a formula that does not read", () => {
    const scene = plane([{ ...fields, formula: "2 +", id: "broken", kind: "function" }]);
    expect(Result.isFailure(resolveFormulaShapes(scene, resolveVisualProjection(scene), {}))).toBe(true);
  });

  it("draws a marker and a loop where the sliders place them", () => {
    const corners = [
      { x: "0", y: "0" },
      { x: "2 cos(a)", y: "0" },
      { x: "2 cos(a)", y: "2 sin(a)" },
    ];
    const drawn = shapes(
      plane(
        [
          { ...fields, id: "tip", kind: "marker", x: "2 cos(a)", y: "2 sin(a)" },
          { ...fields, id: "legs", kind: "loop", points: corners },
        ],
        [{ at: { x: "2 cos(a)", y: "0" }, key: "cosine", objectId: "legs" }]
      ),
      { a: 0 }
    );
    expect(Arr.map(drawn, ({ id, kind }) => `${id} ${kind}`)).toStrictEqual(["tip marker", "legs curve"]);
    const [tip, legs] = drawn;
    expect(tip?.kind === "marker" && tip.point.x > 0 && Math.abs(tip.point.y) < 1e-9).toBe(true);
    expect(legs?.kind === "curve" && legs.points.length === 4).toBe(true);
  });

  it("places a label exactly or by its formulas, and hides one placed nowhere", () => {
    expect(labelPoint({ x: 1, y: 2 }, {})).toStrictEqual(Option.some({ x: 1, y: 2 }));
    expect(labelPoint({ x: "cos(a)", y: "0" }, { a: 0 })).toStrictEqual(Option.some({ x: 1, y: 0, z: 0 }));
    expect(Option.isNone(labelPoint({ x: "ln(0)", y: "0" }, {}))).toBe(true);
    expect(Option.isNone(labelPoint({ x: "cos(", y: "0" }, {}))).toBe(true);
  });

  it("reads each readout at the sliders' values", () => {
    expect(
      readoutValues(
        [
          { formula: "2 a", key: "double" },
          { formula: "1 / (a - a)", key: "pole" },
          { formula: "2 +", key: "broken" },
        ],
        { a: 3 }
      )
    ).toStrictEqual([
      { key: "double", value: Option.some(6) },
      { key: "pole", value: Option.none() },
      { key: "broken", value: Option.none() },
    ]);
  });
});

