import { describe, expect, it } from "@effect/vitest";
import { FigureAttrsSchema } from "@nakafa/aksara-contracts/assessment/figure";
import { Array as Arr, Option, Schema } from "effect";
import {
  freeName,
  newSlider,
  type Plane,
  planeOf,
  sceneOf,
} from "@/components/tenant/exams/figure/plane";
import {
  newShape,
  type ShapeDraft,
  type ShapeKind,
} from "@/components/tenant/exams/figure/shapes";

/** A new shape of a kind with some of its fields typed over. */
const shape = (
  kind: ShapeKind,
  fields: Partial<ShapeDraft> = {}
): ShapeDraft => ({ ...newShape(kind, `${kind}-1`, 0), ...fields });

/** A fitted plane of shapes and no sliders. */
const plane = (shapes: readonly ShapeDraft[], fields: Partial<Plane> = {}) => ({
  shapes,
  sliders: [],
  view: "auto" as const,
  xMax: "5",
  xMin: "-5",
  yMax: "5",
  yMin: "-5",
  ...fields,
});

/** The scene a plane makes, which the test expects to exist. */
const made = (draft: Plane) => Option.getOrThrow(sceneOf(draft));

/** A stored MathVisual figure of a scene and its labels, as the contract reads it. */
const visual = (scene: unknown, labels: Record<string, unknown> = {}) => {
  const figure = Schema.decodeUnknownSync(FigureAttrsSchema)({
    alt: "Grafik",
    caption: null,
    component: "MathVisual",
    props: {
      description: [{ text: "Grafik", type: "text" }],
      labels,
      scene,
      title: [{ text: "Grafik", type: "text" }],
    },
  });
  if (figure.component !== "MathVisual") {
    throw new Error("A stored graph is a math visual.");
  }
  return figure;
};

describe("exams/figure/plane", () => {
  it("names each new slider by the next free letter and stops once every letter is taken", () => {
    expect(freeName([])).toEqual(Option.some("a"));
    expect(freeName([newSlider("a", "a"), newSlider("b", "b")])).toEqual(
      Option.some("c")
    );
    const all = Arr.map(Arr.fromIterable("abcdfghjkmnpqrsw"), (name) =>
      newSlider(name, name)
    );
    expect(Option.isNone(freeName(all))).toBe(true);
  });

  it("fits the plane around every object, its labels and the origin, with room on each side", () => {
    const { scene } = made(
      plane([
        shape("point", { label: "A", x: "3", y: "4" }),
        shape("segment", { x: "-2", x2: "1", y: "0", y2: "1" }),
        shape("polygon", { formula: "(0, 0) (2, 0) (0, -3)" }),
        shape("circle", { r: "1", x: "6", y: "0" }),
        shape("angle", { from: "0", r: "1", to: "90", x: "0", y: "0" }),
        shape("line", { x: "0", x2: "1", y: "0", y2: "1" }),
        shape("ray", { x: "0", x2: "1", y: "0", y2: "1" }),
        shape("equation"),
        shape("region"),
      ])
    );
    expect(scene.frame).toEqual({
      kind: "cartesian",
      x: { max: 8, min: -3 },
      y: { max: 5, min: -4 },
    });
  });

  it("follows a function and a sliding point by the sliders, and keeps a runaway curve readable", () => {
    const { scene } = made(
      plane(
        [
          shape("function", { formula: "1/x", from: "-1", label: "f", to: "1" }),
          shape("point", { label: "P", x: "a", y: "2 a" }),
          shape("point", { x: "a +", y: "1" }),
        ],
        { sliders: [newSlider("a", "a"), { ...newSlider("b", "b"), step: "" }] }
      )
    );
    expect(scene.frame).toEqual({
      kind: "cartesian",
      x: { max: 2, min: -2 },
      y: { max: 101, min: -101 },
    });
    expect(scene.parameters).toEqual([
      { max: 5, min: -5, name: "a", step: 0.1, value: 1 },
      { max: 5, min: -5, name: "b", value: 1 },
    ]);
    expect(scene.labels).toEqual([
      {
        at: { x: 0.6000000000000001, y: 1.6666666666666665 },
        key: "function-1",
        objectId: "function-1",
        placement: "right",
      },
      {
        at: { x: "a", y: "2 a" },
        key: "point-1",
        objectId: "point-1",
        placement: "above-right",
      },
    ]);
  });

  it("keeps the range a teacher types, and makes no scene while a number of it is missing", () => {
    const point = [shape("point", { x: "1", y: "1" })];
    const { labels, scene } = made(
      plane(point, { view: "manual", xMax: "2", xMin: "-2", yMax: "3", yMin: "-1" })
    );
    expect(scene.frame).toEqual({
      kind: "cartesian",
      x: { max: 2, min: -2 },
      y: { max: 3, min: -1 },
    });
    expect(labels).toEqual({});
    expect("labels" in scene || "parameters" in scene).toBe(false);
    expect(
      Option.isNone(sceneOf(plane(point, { view: "manual", xMax: "" })))
    ).toBe(true);
  });

  it("makes no scene of an empty plane, an object missing a number, or a slider missing one", () => {
    expect(Option.isNone(sceneOf(plane([])))).toBe(true);
    expect(Option.isNone(sceneOf(plane([shape("circle", { r: "" })])))).toBe(
      true
    );
    expect(
      Option.isNone(
        sceneOf(
          plane([shape("point")], {
            sliders: [{ ...newSlider("a", "a"), max: "" }],
          })
        )
      )
    ).toBe(true);
  });

  it("writes a label as math, and leaves out a label of a kind that carries none or that has no place", () => {
    const { labels } = made(
      plane([
        shape("point", { label: " A " }),
        shape("region", { label: "R" }),
        shape("function", {
          formula: "1/(x - 1.2000000000000002)",
          label: "f",
        }),
      ])
    );
    expect(labels).toEqual({
      "point-1": [{ attrs: { latex: "A" }, type: "mathInline" }],
    });
  });

  it("reads a stored plane back into the builder, at the range it shows", () => {
    const stored = visual(
      {
        frame: { kind: "cartesian", x: { max: 7, min: -3 }, y: { max: 5, min: -1 } },
        labels: [
          { at: { x: 2, y: 0 }, key: "vertex", objectId: "vertex" },
        ],
        objects: [
          { appearance: "highlight", at: { x: 2, y: 0 }, id: "vertex", kind: "point" },
          { appearance: "primary", id: "moving", kind: "marker", x: "a", y: "1" },
          { appearance: "primary", from: { x: 0, y: 0 }, id: "side", kind: "segment", to: { x: 1, y: 1 } },
          { appearance: "primary", from: { x: 0, y: 0 }, id: "arrow", kind: "vector", to: { x: 1, y: 1 } },
          { appearance: "primary", id: "slope", kind: "line", through: [{ x: 0, y: 0 }, { x: 1, y: 1 }] },
          { appearance: "primary", from: { x: 0, y: 0 }, id: "beam", kind: "ray", through: { x: 1, y: 0 } },
          { appearance: "primary", id: "shape", kind: "polygon", vertices: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 0, y: 1 }] },
          { appearance: "primary", center: { x: 0, y: 0 }, id: "ring", kind: "circle", radius: 1 },
          { appearance: "primary", center: { x: 0, y: 0 }, id: "turn", kind: "arc", radius: 1, startDegrees: 30, sweepDegrees: 60 },
          { appearance: "primary", domain: { max: 2, min: -2 }, formula: "x^2", id: "f", kind: "function" },
          { appearance: "primary", coefficients: { a: 1, b: -2, c: 3 }, domain: { max: 2, min: -2 }, id: "q", inputAxis: "x", kind: "quadratic" },
          { appearance: "primary", equation: "x^2 + y^2 = 4", id: "round", kind: "implicit" },
          { appearance: "answer", id: "zone", inequalities: ["y >= 0", "y <= 1"], kind: "region" },
        ],
        parameters: [
          { max: 2, min: 0, name: "a", step: 0.5, value: 1 },
          { max: 2, min: 0, name: "b", value: 1 },
        ],
        space: "plane",
        view: { kind: "fit" },
      },
      {
        vertex: [
          { attrs: { latex: "V" }, type: "mathInline" },
          { text: " top", type: "text" },
          { type: "hardBreak" },
        ],
      }
    );
    const read = Option.getOrThrow(planeOf(stored));
    expect(read).toMatchObject({
      view: "manual",
      xMax: "7",
      xMin: "-3",
      yMax: "5",
      yMin: "-1",
    });
    expect(read.sliders).toEqual([
      { id: "a", max: "2", min: "0", name: "a", step: "0.5", value: "1" },
      { id: "b", max: "2", min: "0", name: "b", step: "", value: "1" },
    ]);
    expect(
      Arr.map(read.shapes, ({ formula, id, kind, label }) => [id, kind, formula, label])
    ).toEqual([
      ["vertex", "point", "", "V\\text{ top}"],
      ["moving", "point", "", ""],
      ["side", "segment", "", ""],
      ["arrow", "vector", "", ""],
      ["slope", "line", "", ""],
      ["beam", "ray", "", ""],
      ["shape", "polygon", "(0, 0) (1, 0) (0, 1)", ""],
      ["ring", "circle", "", ""],
      ["turn", "angle", "", ""],
      ["f", "function", "x^2", ""],
      ["q", "function", "1*x^2 + -2*x + 3", ""],
      ["round", "equation", "x^2 + y^2 = 4", ""],
      ["zone", "region", "y >= 0\ny <= 1", ""],
    ]);
    expect(read.shapes[8]).toMatchObject({ from: "30", r: "1", to: "90" });
    expect(read.shapes[5]).toMatchObject({ x: "0", x2: "1", y: "0", y2: "0" });
  });

  it("offers no plane for a space scene, readouts, or an object the builder does not write", () => {
    const frame = { kind: "cartesian", x: { max: 2, min: -2 }, y: { max: 2, min: -2 } };
    const scene = (objects: unknown[], extra = {}) => ({
      frame,
      objects,
      space: "plane",
      view: { kind: "fit" },
      ...extra,
    });
    const point = { appearance: "primary", at: { x: 0, y: 0 }, id: "p", kind: "point" };
    for (const stored of [
      visual({
        frame: { ...frame, z: { max: 2, min: -2 } },
        objects: [{ ...point, at: { x: 0, y: 0, z: 0 } }],
        space: "space",
        view: { kind: "isometric" },
      }),
      visual(scene([point], { readouts: [{ formula: "1", key: "one" }] })),
      visual(scene([{ appearance: "primary", id: "c", kind: "parametric", parameter: { max: 1, min: 0 }, x: "t", y: "t" }])),
      visual(scene([{ appearance: "primary", formula: "y", id: "f", inputAxis: "y", kind: "function" }])),
      visual(scene([{ appearance: "primary", formula: "x", id: "f", kind: "function" }])),
      visual(scene([{ appearance: "primary", coefficients: { a: 1, b: 0, c: 0 }, domain: { max: 1, min: 0 }, id: "q", inputAxis: "y", kind: "quadratic" }])),
    ]) {
      expect(Option.isNone(planeOf(stored))).toBe(true);
    }
    expect(Option.isSome(planeOf(visual(scene([point]))))).toBe(true);
  });
});
