import { describe, expect, it } from "@effect/vitest";
import {
  canonicalOf,
  isVariablePolynomial,
  subtract,
  textOf,
} from "@repo/backend/confect/assessment/math/canon";
import { parseExpression } from "@repo/backend/confect/assessment/math/parse";
import { Option } from "effect";

/** The canonical text of an expression, or none when its form cannot be built. */
const formOf = (latex: string) =>
  Option.map(
    Option.flatMap(parseExpression(latex), canonicalOf),
    textOf
  );

/** Expects two expressions to have one canonical form. */
const expectSameForm = (left: string, right: string) => {
  const form = formOf(left);
  expect([left, Option.isSome(form)]).toEqual([left, true]);
  expect([left, form]).toEqual([left, formOf(right)]);
};

describe("assessment/math canonicalOf", () => {
  it.each([
    ["(x+1)^2", "x^2+2x+1"],
    ["(x+y)(x-y)", "x^2-y^2"],
    ["\\frac{x^2}{x}", "x"],
    ["\\frac{6x^3}{2x}", "3x^2"],
    ["x-x", "0"],
    ["0+x", "x"],
    ["0x+y", "y"],
    ["(x+1)^0", "1"],
    ["0^0", "1"],
    ["0^2", "0"],
    ["\\frac{1}{x+1}\\cdot\\frac{1}{x+1}", "(x+1)^{-2}"],
    ["(x+1)^{13}", "(1+x)^{13}"],
    ["\\sin(2x)", "\\sin(x+x)"],
    ["\\sin(x-x)", "\\sin(0)"],
    ["\\log_{2}(x)", "\\log_{2}x"],
    ["\\sqrt[3]{x}", "\\sqrt[3]{x}"],
    ["\\sqrt{x}^3", "x^{\\frac{3}{2}}"],
    ["e^{x}", "\\exp(x)"],
    ["x^{y}", "x^y"],
    ["x^{20000}", "x^{20000}"],
    ["(2x)^{-3}", "\\frac{1}{8}x^{-3}"],
    ["(123456789012345x)^{100}", "(123456789012345x)^{100}"],
    ["(x^{5000})^{3}", "(x^{5000})^{3}"],
  ])("gives %s and %s one form", (left, right) => {
    expectSameForm(left, right);
  });

  it("keeps a sum to a negative or high power, and a huge power, as atoms of their own", () => {
    expect(formOf("(x+1)^{13}")).not.toEqual(formOf("(x+1)^{12}(x+1)"));
    expect(formOf("x^{20000}")).not.toEqual(formOf("x^{19999}x"));
    expect(formOf("(x^{5000})^{3}")).not.toEqual(formOf("x^{15000}"));
  });

  it("builds no form for a division by zero, a form past the parts bound, or one past the product budget", () => {
    expect(formOf("\\frac{1}{0}")).toEqual(Option.none());
    expect(formOf("(x+y+z)^{12}")).toEqual(Option.none());
    expect(formOf("((x+1)^{8})^{7}((y+1)^{8})^{7}")).toEqual(Option.none());
  });

  it("tells a difference in the variables alone from one that holds a constant or a function", () => {
    const differenceOf = (left: string, right: string) =>
      Option.getOrThrow(
        Option.flatMap(
          Option.all([parseExpression(left), parseExpression(right)]),
          ([one, other]) =>
            Option.map(
              Option.all([canonicalOf(one), canonicalOf(other)]),
              ([first, second]) => subtract(first, second)
            )
        )
      );
    expect(isVariablePolynomial(differenceOf("3x^2-4x", "3x^2+4x"))).toBe(true);
    expect(isVariablePolynomial(differenceOf("\\frac{8}{3}", "2.67"))).toBe(
      true
    );
    expect(isVariablePolynomial(differenceOf("x+e", "x"))).toBe(false);
    expect(isVariablePolynomial(differenceOf("\\sin x", "x"))).toBe(false);
    expect(differenceOf("x(3x-4)", "3x^2-4x")).toEqual([]);
  });
});
