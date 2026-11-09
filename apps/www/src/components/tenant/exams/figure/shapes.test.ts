import { describe, expect, it } from "@effect/vitest";
import { Array as Arr, Option } from "effect";
import {
  anchorOf,
  cornersOf,
  cornersText,
  inequalitiesOf,
  isEquation,
  isFormula,
  isInequalities,
  isNumber,
  newShape,
  objectOf,
  type ShapeDraft,
  ShapeKind,
  valueAt,
} from "@/components/tenant/exams/figure/shapes";

/** A new shape of a kind with some of its fields typed over. */
const shape = (kind: ShapeKind, fields: Partial<ShapeDraft> = {}) => ({
  ...newShape(kind, `${kind}-1`, 0),
  ...fields,
});

describe("exams/figure/shapes", () => {
  it("starts every kind already drawn, and rotates the role so two objects in a row differ", () => {
    for (const kind of ShapeKind.literals) {
      expect(Option.isSome(objectOf(shape(kind)))).toBe(true);
    }
    expect(
      Arr.map(
        [0, 1, 2, 3, 4],
        (place) => newShape("point", "p", place).appearance
      )
    ).toEqual(["primary", "secondary", "highlight", "answer", "primary"]);
  });

  it("reads numbers with either decimal point, formulas, equations and inequalities", () => {
    expect(isNumber(" 2,5 ")).toBe(true);
    expect(isNumber("dua")).toBe(false);
    expect(isFormula("a sin(x)")).toBe(true);
    expect(isFormula("2 +")).toBe(false);
    expect(isEquation("x^2 + y^2 = 4")).toBe(true);
    expect(isEquation("y < x")).toBe(false);
    expect(isEquation("= =")).toBe(false);
    expect(isInequalities("y >= x^2\n\n y <= 4")).toBe(true);
    expect(isInequalities("")).toBe(false);
    expect(isInequalities("y = x")).toBe(false);
    expect(isInequalities("y <")).toBe(false);
    expect(inequalitiesOf(" y > 0 \n\n")).toEqual(["y > 0"]);
  });

  it("reads the corners of a polygon as (x, y) pairs and writes them back", () => {
    const corners = Option.getOrThrow(cornersOf("(0, 0) (4,0)(0, 3.5)"));
    expect(corners).toEqual([
      { x: 0, y: 0 },
      { x: 4, y: 0 },
      { x: 0, y: 3.5 },
    ]);
    expect(cornersText(corners)).toBe("(0, 0) (4, 0) (0, 3.5)");
    expect(Option.isNone(cornersOf("(0, 0) (4)"))).toBe(true);
    expect(Option.isNone(cornersOf("(0, dua)"))).toBe(true);
  });

  it("evaluates a formula of x with the sliders, and has no value where it has none", () => {
    expect(valueAt("a x^2", { a: 2 }, 3)).toEqual(Option.some(18));
    expect(Option.isNone(valueAt("1/x", {}, 0))).toBe(true);
    expect(Option.isNone(valueAt("x +", {}, 1))).toBe(true);
  });

  it("makes the MathVisual object of each kind from its fields", () => {
    expect(objectOf(shape("point", { x: "1", y: "2" }))).toEqual(
      Option.some({ at: { x: 1, y: 2 }, kind: "point" })
    );
    expect(objectOf(shape("point", { x: "a", y: "a^2" }))).toEqual(
      Option.some({ kind: "marker", x: "a", y: "a^2" })
    );
    const ends = { x: "0", x2: "3", y: "1", y2: "2" };
    expect(objectOf(shape("line", ends))).toEqual(
      Option.some({
        kind: "line",
        through: [
          { x: 0, y: 1 },
          { x: 3, y: 2 },
        ],
      })
    );
    expect(objectOf(shape("ray", ends))).toEqual(
      Option.some({
        from: { x: 0, y: 1 },
        kind: "ray",
        through: { x: 3, y: 2 },
      })
    );
    expect(objectOf(shape("vector", ends))).toEqual(
      Option.some({ from: { x: 0, y: 1 }, kind: "vector", to: { x: 3, y: 2 } })
    );
    expect(objectOf(shape("circle", { r: "2", x: "1", y: "1" }))).toEqual(
      Option.some({ center: { x: 1, y: 1 }, kind: "circle", radius: 2 })
    );
    expect(
      objectOf(shape("angle", { from: "30", r: "1", to: "90", x: "0", y: "0" }))
    ).toEqual(
      Option.some({
        center: { x: 0, y: 0 },
        kind: "arc",
        radius: 1,
        startDegrees: 30,
        sweepDegrees: 60,
      })
    );
    expect(objectOf(shape("function"))).toEqual(
      Option.some({
        domain: { max: 2, min: -2 },
        formula: "x^2",
        kind: "function",
      })
    );
    expect(objectOf(shape("equation"))).toEqual(
      Option.some({ equation: "x^2 + y^2 = 4", kind: "implicit" })
    );
    expect(objectOf(shape("region"))).toEqual(
      Option.some({ inequalities: ["y >= x^2", "y <= 4"], kind: "region" })
    );
  });

  it("makes no object while a number it needs is missing", () => {
    for (const missing of [
      shape("segment", { x2: "" }),
      shape("polygon", { formula: "(0, 0) (1" }),
      shape("circle", { r: "" }),
      shape("angle", { to: "" }),
      shape("function", { from: "" }),
    ]) {
      expect(Option.isNone(objectOf(missing))).toBe(true);
    }
  });

  it("places each label beside what it names, or nowhere for a kind that carries none", () => {
    const at = (draft: ShapeDraft, scope = {}) =>
      Option.map(anchorOf(draft, scope), ({ at: place }) => place);
    expect(anchorOf(shape("point", { x: "1", y: "2" }), {})).toEqual(
      Option.some({ at: { x: 1, y: 2 }, placement: "above-right" })
    );
    expect(at(shape("point", { x: "a", y: "1" }))).toEqual(
      Option.some({ x: "a", y: "1" })
    );
    expect(at(shape("segment", { x2: "4", y2: "2" }))).toEqual(
      Option.some({ x: 2, y: 1 })
    );
    expect(at(shape("polygon", { formula: "(0, 0) (3, 0) (0, 3)" }))).toEqual(
      Option.some({ x: 1, y: 1 })
    );
    expect(
      Option.isNone(anchorOf(shape("polygon", { formula: " " }), {}))
    ).toBe(true);
    expect(at(shape("circle", { r: "2", x: "1", y: "1" }))).toEqual(
      Option.some({ x: 1, y: 3 })
    );
    const angle = Option.getOrThrow(
      at(shape("angle", { from: "0", r: "1", to: "180", x: "0", y: "0" }))
    );
    expect(angle.x).toBeCloseTo(0);
    expect(angle.y).toBeCloseTo(1.6);
    expect(at(shape("function", { formula: "a x" }), { a: 2 })).toEqual(
      Option.some({ x: 1.200_000_000_000_000_2, y: 2.400_000_000_000_000_4 })
    );
    expect(
      Option.isNone(
        anchorOf(
          shape("function", { formula: "1/(x - 1.2000000000000002)" }),
          {}
        )
      )
    ).toBe(true);
    expect(Option.isNone(anchorOf(shape("function", { to: "" }), {}))).toBe(
      true
    );
    expect(Option.isNone(anchorOf(shape("equation"), {}))).toBe(true);
  });
});
