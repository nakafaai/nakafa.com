import { describe, expect, it } from "@effect/vitest";
import { FigureAttrsSchema } from "@nakafa/aksara-contracts/assessment/figure";
import { Array as Arr, Option, Schema } from "effect";
import { planeOf } from "@/components/tenant/exams/figure/stored";

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

describe("exams/figure/stored", () => {
  it("reads a stored plane back into the builder, at the range it shows", () => {
    const stored = visual(
      {
        frame: {
          kind: "cartesian",
          x: { max: 7, min: -3 },
          y: { max: 5, min: -1 },
        },
        labels: [{ at: { x: 2, y: 0 }, key: "vertex", objectId: "vertex" }],
        objects: [
          {
            appearance: "highlight",
            at: { x: 2, y: 0 },
            id: "vertex",
            kind: "point",
          },
          {
            appearance: "primary",
            id: "moving",
            kind: "marker",
            x: "a",
            y: "1",
          },
          {
            appearance: "primary",
            from: { x: 0, y: 0 },
            id: "side",
            kind: "segment",
            to: { x: 1, y: 1 },
          },
          {
            appearance: "primary",
            from: { x: 0, y: 0 },
            id: "arrow",
            kind: "vector",
            to: { x: 1, y: 1 },
          },
          {
            appearance: "primary",
            id: "slope",
            kind: "line",
            through: [
              { x: 0, y: 0 },
              { x: 1, y: 1 },
            ],
          },
          {
            appearance: "primary",
            from: { x: 0, y: 0 },
            id: "beam",
            kind: "ray",
            through: { x: 1, y: 0 },
          },
          {
            appearance: "primary",
            id: "shape",
            kind: "polygon",
            vertices: [
              { x: 0, y: 0 },
              { x: 1, y: 0 },
              { x: 0, y: 1 },
            ],
          },
          {
            appearance: "primary",
            center: { x: 0, y: 0 },
            id: "ring",
            kind: "circle",
            radius: 1,
          },
          {
            appearance: "primary",
            center: { x: 0, y: 0 },
            id: "turn",
            kind: "arc",
            radius: 1,
            startDegrees: 30,
            sweepDegrees: 60,
          },
          {
            appearance: "primary",
            domain: { max: 2, min: -2 },
            formula: "x^2",
            id: "f",
            kind: "function",
          },
          {
            appearance: "primary",
            coefficients: { a: 1, b: 0, c: -1 },
            domain: { max: 2, min: -2 },
            id: "q",
            inputAxis: "x",
            kind: "quadratic",
          },
          {
            appearance: "primary",
            equation: "x^2 + y^2 = 4",
            id: "round",
            kind: "implicit",
          },
          {
            appearance: "answer",
            id: "zone",
            inequalities: ["y >= 0", "y <= 1"],
            kind: "region",
          },
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
      Arr.map(read.shapes, ({ formula, id, kind, label }) => [
        id,
        kind,
        formula,
        label,
      ])
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
      ["q", "function", "1*x^2 + 0*x + -1", ""],
      ["round", "equation", "x^2 + y^2 = 4", ""],
      ["zone", "region", "y >= 0\ny <= 1", ""],
    ]);
    expect(read.shapes[8]).toMatchObject({ from: "30", r: "1", to: "90" });
    expect(read.shapes[5]).toMatchObject({ x: "0", x2: "1", y: "0", y2: "0" });
  });

  it("offers no plane for readouts or an object the builder does not write", () => {
    const frame = {
      kind: "cartesian",
      x: { max: 2, min: -2 },
      y: { max: 2, min: -2 },
    };
    const scene = (objects: unknown[], extra = {}) => ({
      frame,
      objects,
      space: "plane",
      view: { kind: "fit" },
      ...extra,
    });
    const point = {
      appearance: "primary",
      at: { x: 0, y: 0 },
      id: "p",
      kind: "point",
    };
    for (const stored of [
      visual(scene([point], { readouts: [{ formula: "1", key: "one" }] }), {
        one: [{ text: "1", type: "text" }],
      }),
      visual(
        scene([
          {
            appearance: "primary",
            id: "c",
            kind: "parametric",
            parameter: { max: 1, min: 0 },
            x: "t",
            y: "t",
          },
        ])
      ),
      visual(
        scene([
          {
            appearance: "primary",
            formula: "y",
            id: "f",
            inputAxis: "y",
            kind: "function",
          },
        ])
      ),
      visual(
        scene([
          { appearance: "primary", formula: "x", id: "f", kind: "function" },
        ])
      ),
      visual(
        scene([
          {
            appearance: "primary",
            coefficients: { a: 1, b: 0, c: 0 },
            domain: { max: 1, min: 0 },
            id: "q",
            inputAxis: "y",
            kind: "quadratic",
          },
        ])
      ),
    ]) {
      expect(Option.isNone(planeOf(stored))).toBe(true);
    }
    expect(Option.isSome(planeOf(visual(scene([point]))))).toBe(true);
  });
  it("reads stored space back, with its z range, and offers none for a solid or a surface over no square", () => {
    const frame = {
      kind: "cartesian",
      x: { max: 3, min: -3 },
      y: { max: 3, min: -3 },
      z: { max: 4, min: -1 },
    };
    const space = (objects: unknown[]) =>
      visual({ frame, objects, space: "space", view: { kind: "isometric" } });
    const read = Option.getOrThrow(
      planeOf(
        space([
          {
            appearance: "primary",
            at: { x: 1, y: 1, z: 1 },
            id: "p",
            kind: "point",
          },
          {
            appearance: "primary",
            from: { x: 0, y: 0, z: 0 },
            id: "s",
            kind: "segment",
            to: { x: 1, y: 2, z: 3 },
          },
          {
            appearance: "primary",
            from: { x: 0, y: 0, z: 0 },
            id: "v",
            kind: "vector",
            to: { x: 1, y: 0, z: 0 },
          },
          {
            appearance: "primary",
            id: "l",
            kind: "line",
            through: [
              { x: 0, y: 0, z: 0 },
              { x: 1, y: 1, z: 1 },
            ],
          },
          {
            appearance: "primary",
            from: { x: 0, y: 0, z: 0 },
            id: "r",
            kind: "ray",
            through: { x: 0, y: 1, z: 0 },
          },
          {
            appearance: "primary",
            domain: { x: { max: 1, min: -1 }, y: { max: 1, min: -1 } },
            formula: "x y",
            id: "f",
            kind: "function",
          },
        ])
      )
    );
    expect(read).toMatchObject({ space: "space", zMax: "4", zMin: "-1" });
    expect(Arr.map(read.shapes, ({ kind }) => kind)).toEqual([
      "point",
      "segment",
      "vector",
      "line",
      "ray",
      "function",
    ]);
    expect(read.shapes[1]).toMatchObject({ x2: "1", y2: "2", z2: "3" });
    for (const objects of [
      [
        {
          appearance: "primary",
          center: { x: 0, y: 0, z: 0 },
          id: "c",
          kind: "cuboid",
          size: { height: 1, length: 1, width: 1 },
        },
      ],
      [{ appearance: "primary", formula: "x", id: "f", kind: "function" }],
      [
        {
          appearance: "primary",
          domain: { x: { max: 1, min: -1 }, y: { max: 2, min: -1 } },
          formula: "x",
          id: "f",
          kind: "function",
        },
      ],
      [
        {
          appearance: "primary",
          domain: { x: { max: 1, min: -1 }, y: { max: 1, min: 0 } },
          formula: "x",
          id: "f",
          kind: "function",
        },
      ],
    ]) {
      expect(Option.isNone(planeOf(space(objects)))).toBe(true);
    }
  });
});
