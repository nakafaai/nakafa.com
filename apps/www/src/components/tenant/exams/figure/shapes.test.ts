import { describe, expect, it } from "@effect/vitest";
import { Array as Arr, Option } from "effect";
import {
  cornersOf,
  cornersText,
  inequalitiesOf,
  isEquation,
  isFormula,
  isInequalities,
  isNumber,
  newShape,
  valueAt,
} from "@/components/tenant/exams/figure/shapes";

describe("exams/figure/shapes", () => {
  it("rotates the role of each new object, so two objects in a row differ", () => {
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
});
