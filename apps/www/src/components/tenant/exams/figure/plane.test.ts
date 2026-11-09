import { describe, expect, it } from "@effect/vitest";
import { Array as Arr, Option } from "effect";
import {
  freeName,
  newSlider,
  type Plane,
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
  space: "plane" as const,
  view: "auto" as const,
  xMax: "5",
  xMin: "-5",
  yMax: "5",
  yMin: "-5",
  zMax: "5",
  zMin: "-5",
  ...fields,
});

/** The scene a plane makes, which the test expects to exist. */
const made = (draft: Plane) => Option.getOrThrow(sceneOf(draft));

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

  it("follows a sliding point by the sliders, and keeps a runaway curve readable", () => {
    const { scene } = made(
      plane(
        [
          shape("function", { formula: "x^9", from: "-3", to: "3" }),
          shape("point", { label: "P", x: "a", y: "2 a" }),
          shape("point", { id: "point-2", x: "a +", y: "1" }),
        ],
        { sliders: [newSlider("a", "a"), { ...newSlider("b", "b"), step: "" }] }
      )
    );
    expect(scene.frame).toEqual({
      kind: "cartesian",
      x: { max: 4, min: -4 },
      y: { max: 101, min: -101 },
    });
    expect(scene.parameters).toEqual([
      { max: 5, min: -5, name: "a", step: 0.1, value: 1 },
      { max: 5, min: -5, name: "b", value: 1 },
    ]);
    expect(scene.labels).toEqual([
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
      plane(point, {
        view: "manual",
        xMax: "2",
        xMin: "-2",
        yMax: "3",
        yMin: "-1",
      })
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

  it("builds space from points, segments, lines, rays, vectors and a surface, seen from the isometric corner", () => {
    const { labels, scene } = made(
      plane(
        [
          shape("point", { label: "P", x: "1", y: "2", z: "3" }),
          shape("segment", { label: "s", z2: "1" }),
          shape("vector"),
          shape("function", {
            formula: "x y",
            from: "-1",
            label: "f",
            to: "1",
          }),
        ],
        { space: "space" }
      )
    );
    expect(scene).toMatchObject({
      frame: {
        kind: "cartesian",
        x: { max: 4, min: -2 },
        y: { max: 3, min: -2 },
        z: { max: 4, min: -2 },
      },
      space: "space",
      view: { kind: "isometric" },
    });
    expect(scene.labels).toEqual([
      {
        at: { x: 1, y: 2, z: 3 },
        key: "point-1",
        objectId: "point-1",
        placement: "above-right",
      },
      {
        at: { x: 1.5, y: 1, z: 0.5 },
        key: "segment-1",
        objectId: "segment-1",
        placement: "above-right",
      },
    ]);
    expect(Object.keys(labels)).toEqual(["point-1", "segment-1"]);
  });

  it("keeps the z range a teacher types in space, and makes no scene of a kind only a plane draws", () => {
    const point = [shape("point", { x: "1", y: "1", z: "1" })];
    const { scene } = made(
      plane(point, { space: "space", view: "manual", zMax: "2", zMin: "0" })
    );
    expect(scene.frame).toEqual({
      kind: "cartesian",
      x: { max: 5, min: -5 },
      y: { max: 5, min: -5 },
      z: { max: 2, min: 0 },
    });
    expect(
      Option.isNone(sceneOf(plane([shape("circle")], { space: "space" })))
    ).toBe(true);
  });
});
