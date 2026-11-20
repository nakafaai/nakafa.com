import { describe, expect, it } from "@effect/vitest";
import { parseExpression } from "@repo/backend/confect/assessment/math/parse";
import { integer } from "@repo/backend/confect/assessment/math/term";
import { Option, Rational } from "effect";

/** Expects two spellings to read as one term. */
const expectSame = (spelled: string, plain: string) => {
  const read = parseExpression(spelled);
  expect([spelled, Option.isSome(read)]).toEqual([spelled, true]);
  expect([spelled, read]).toEqual([spelled, parseExpression(plain)]);
};

/** Expects a text to be refused. */
const expectRefused = (text: string) => {
  expect([text, parseExpression(text)]).toEqual([text, Option.none()]);
};

describe("assessment/math parseExpression", () => {
  it.each([
    ["\\sin 2x", "\\sin(2x)"],
    ["\\sin x \\cos x", "\\sin(x)\\cos(x)"],
    ["\\ln x^2", "\\ln(x^2)"],
    ["\\sin^2 x", "(\\sin(x))^2"],
    ["\\sin^{2}(x)", "(\\sin(x))^2"],
    ["\\sin x/2", "\\sin(x)/2"],
    ["\\ln|x|", "\\ln(|x|)"],
    ["x^23", "x^2\\cdot 3"],
    ["\\frac12", "\\frac{1}{2}"],
    ["\\dfrac{1}{2}", "\\frac{1}{2}"],
    ["\\sqrt x", "\\sqrt{x}"],
    ["sqrt(x)", "\\sqrt{x}"],
    ["√x", "\\sqrt{x}"],
    ["\\log_2 x", "\\log_{2}(x)"],
    ["\\lg x", "\\log(x)"],
    ["log(x)", "\\log x"],
    ["\\exp(x)", "e^{x}"],
    ["\\mathrm{e}^x", "e^x"],
    ["\\exponentialE^x", "e^x"],
    ["\\operatorname{sin}(x)", "\\sin(x)"],
    ["\\left|x\\right|", "|x|"],
    ["\\lvert x \\rvert", "|x|"],
    ["abs(x)", "|x|"],
    ["2|x|", "2\\cdot|x|"],
    ["\\left|\\left|x\\right|-1\\right|", "||x|-1|"],
    ["\\left[x+1\\right]", "(x+1)"],
    ["\\bigl(x\\bigr)", "(x)"],
    ["{x}", "x"],
    ["x^-1", "x^{-1}"],
    ["x^+2", "x^{2}"],
    [".5x", "0.5x"],
    ["0{,}5", "0.5"],
    ["2\\times 3", "2*3"],
    ["2\\cdot3", "2*3"],
    ["6\\div 2", "6/2"],
    ["3\\,x", "3x"],
    ["3\\quad x", "3x"],
    ["πx", "\\pi x"],
    ["x³", "x^3"],
    ["2·x", "2*x"],
    ["x_{0}", "x_0"],
    ["y=x", "x"],
    ["f(x) = x", "x"],
    ["f''(x)=x", "x"],
    ["f′(x)=x", "x"],
    ["x^{\\frac12}", "x^{\\frac{1}{2}}"],
    ["e^\\sqrt{x}", "e^{\\sqrt{x}}"],
    ["2^\\pi", "2^{\\pi}"],
  ])("reads %s as %s", (spelled, plain) => {
    expectSame(spelled, plain);
  });

  it("reads numbers exactly, symbols by name, even roots as powers, and odd roots as their own operator", () => {
    expect(parseExpression("0.25")).toEqual(
      Option.some(Rational.makeUnsafe(1n, 4n))
    );
    expect(parseExpression("\\pi")).toEqual(Option.some("pi"));
    expect(parseExpression("\\theta^2")).toEqual(
      Option.some(["Power", "\\theta", integer(2)])
    );
    expect(parseExpression("\\sqrt[4]{x}")).toEqual(
      Option.some(["Power", "x", Rational.makeUnsafe(1n, 4n)])
    );
    expect(parseExpression("a_{12}")).toEqual(Option.some("a_12"));
    expect(parseExpression("x_n")).toEqual(Option.some("x_n"));
    expect(parseExpression("\\sqrt[3]{x}")).toEqual(
      Option.some(["Root", integer(3), "x"])
    );
    expect(parseExpression(`${"(".repeat(8)}x${")".repeat(8)}`)).toEqual(
      Option.some("x")
    );
  });

  it.each([
    "",
    "   ",
    "x^2^3",
    "x^",
    "\\sin^{-1}x",
    "\\sin^{0}x",
    "\\sin^{13}x",
    "\\sin^{2 x",
    "\\sqrt[1]{x}",
    "\\sqrt[x]{x}",
    "\\sqrt[13]{x}",
    "\\sqrt[3 x",
    "3.",
    "1234567890123456",
    "x_",
    "x_{}",
    "x_{1",
    "x_(1)",
    "(x",
    "x)",
    "|x",
    "\\frac{1}",
    "\\frac",
    "x+",
    "*x",
    "--x",
    "x=2=3",
    "x==2",
    "=x",
    "x'",
    "\\infty",
    "\\{x\\}",
    "x \\le 2",
    "\\mathrm{abc}",
    "\\text{cm}",
    "\\log_",
    "\\sin",
    "2.5.3",
    "x^@",
    "x^)",
  ])("refuses %j", (text) => {
    expectRefused(text);
  });

  it("refuses a text past the bounds of length, tokens, and nesting, and reads one just inside them", () => {
    expect(Option.isSome(parseExpression(`x${" ".repeat(298)}y`))).toBe(true);
    expectRefused(`x${" ".repeat(299)}y`);
    expect(Option.isSome(parseExpression(`${"x+".repeat(99)}x`))).toBe(true);
    expectRefused(`${"x+".repeat(100)}x`);
    expectRefused(`${"(".repeat(40)}x${")".repeat(40)}`);
    expectRefused(`${"\\sqrt{".repeat(30)}x${"}".repeat(30)}`);
  });
});
