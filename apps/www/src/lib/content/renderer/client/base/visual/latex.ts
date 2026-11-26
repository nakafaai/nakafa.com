import { Array as Arr, Option, String as Str } from "effect";
import type { PlaneObject } from "@/lib/content/renderer/client/base/visual/scene";

const MAX_EXPRESSION_LENGTH = 32;
const ZERO_TOLERANCE = 1e-6;
const FUNCTION_NAME_PATTERN =
  /\b(?<fn>sin|cos|tan|sec|csc|cot|arcsin|arccos|arctan|sinh|cosh|tanh|ln|log|exp)\b/gu;
const CONSTANT_TOKEN_PATTERN = /\b(?<sym>pi|theta)\b/gu;
const DIGIT_MULTIPLY_PATTERN = /(?<lhs>\d)\s*\*\s*(?<rhs>\d)/gu;
const SYMBOL_MULTIPLY_PATTERN = /\s*\*\s*/gu;
const SIMPLE_EXPONENT_PATTERN = /\^(?<exp>[+-]?\d+(?:\.\d+)?|[a-zA-Z])/gu;
const PAREN_EXPONENT_PATTERN = /\^\((?<exp>[^()]+)\)/gu;
const SQRT_CALL_PATTERN = /\bsqrt\((?<arg>[^()]+)\)/gu;
const ABS_CALL_PATTERN = /\babs\((?<arg>[^()]+)\)/gu;
const COMPACT_SPACES_PATTERN = /\s+/gu;

/** Rounds a clean display number to at most 2 decimals without trailing zeros. */
function formatNumber(value: number): string {
  const snapped = Math.abs(value) < ZERO_TOLERANCE ? 0 : value;
  return `${Math.round(snapped * 100) / 100}`;
}

function signPrefix(negative: boolean, leading: boolean): string {
  if (negative) {
    return leading ? "-" : " - ";
  }
  return leading ? "" : " + ";
}

/** Formats one algebraic term `coeff * symbol` cleanly for polynomial equations. */
function formatTerm(
  coeff: number,
  symbol: string,
  leading: boolean
): Option.Option<string> {
  if (Math.abs(coeff) < ZERO_TOLERANCE) {
    return Option.none();
  }
  const absText = formatNumber(Math.abs(coeff));
  const sign = signPrefix(coeff < 0, leading);
  if (symbol === "") {
    return Option.some(`${sign}${absText}`);
  }
  const prefix = absText === "1" ? "" : absText;
  return Option.some(`${sign}${prefix}${symbol}`);
}

/** Converts a contract formula string into clean KaTeX markup. */
export function formatFormulaLatex(raw: string): string {
  let tex = Str.trim(raw);
  tex = tex.replace(SQRT_CALL_PATTERN, "\\sqrt{$<arg>}");
  tex = tex.replace(ABS_CALL_PATTERN, "|$<arg>|");
  tex = tex.replace(PAREN_EXPONENT_PATTERN, "^{$<exp>}");
  tex = tex.replace(SIMPLE_EXPONENT_PATTERN, "^{$<exp>}");
  tex = tex.replace(FUNCTION_NAME_PATTERN, "\\$<fn>");
  tex = tex.replace(CONSTANT_TOKEN_PATTERN, "\\$<sym>");
  tex = tex.replace(DIGIT_MULTIPLY_PATTERN, "$<lhs> \\cdot $<rhs>");
  tex = tex.replace(SYMBOL_MULTIPLY_PATTERN, " ");
  tex = tex.replace(COMPACT_SPACES_PATTERN, " ");
  return tex;
}

/** Builds a clean equation for a 2D line from its two defining points. */
function formatPlaneLineLatex(
  from: { readonly x: number; readonly y: number },
  to: { readonly x: number; readonly y: number }
): string {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  if (Math.abs(dx) < ZERO_TOLERANCE) {
    return `x = ${formatNumber(from.x)}`;
  }
  if (Math.abs(dy) < ZERO_TOLERANCE) {
    return `y = ${formatNumber(from.y)}`;
  }
  const slope = dy / dx;
  const intercept = from.y - slope * from.x;
  const parts = Arr.getSomes([
    formatTerm(slope, "x", true),
    formatTerm(intercept, "", false),
  ]);
  return `y = ${Arr.join(parts, "")}`;
}

/** Builds a clean quadratic equation `y = ax^2 + bx + c` or `x = ay^2 + by + c`. */
function formatQuadraticLatex(
  coefficients: { readonly a: number; readonly b: number; readonly c: number },
  inputAxis: "x" | "y"
): string {
  const dependent = inputAxis === "x" ? "y" : "x";
  const parts = Arr.getSomes([
    formatTerm(coefficients.a, `${inputAxis}^{2}`, true),
    formatTerm(coefficients.b, inputAxis, false),
    formatTerm(coefficients.c, "", false),
  ]);
  return `${dependent} = ${Arr.join(parts, "")}`;
}

/** Builds a concise LaTeX expression for an unlabeled plane curve or line. */
export function describePlaneObjectLatex(
  object: PlaneObject
): Option.Option<string> {
  if (object.kind === "line") {
    const [from, to] = object.through;
    return Option.some(formatPlaneLineLatex(from, to));
  }
  if (object.kind === "quadratic") {
    return Option.some(
      formatQuadraticLatex(object.coefficients, object.inputAxis)
    );
  }
  if (object.kind === "function") {
    if (object.formula.length > MAX_EXPRESSION_LENGTH) {
      return Option.none();
    }
    const dependent = object.inputAxis === "y" ? "x" : "y";
    return Option.some(`${dependent} = ${formatFormulaLatex(object.formula)}`);
  }
  if (object.kind === "implicit") {
    if (object.equation.length > MAX_EXPRESSION_LENGTH) {
      return Option.none();
    }
    return Option.some(formatFormulaLatex(object.equation));
  }
  if (object.kind === "polar") {
    if (object.radius.length > MAX_EXPRESSION_LENGTH) {
      return Option.none();
    }
    return Option.some(`r = ${formatFormulaLatex(object.radius)}`);
  }
  if (object.kind === "parametric") {
    if (object.x.length + object.y.length > MAX_EXPRESSION_LENGTH) {
      return Option.none();
    }
    return Option.some(
      `(${formatFormulaLatex(object.x)}, ${formatFormulaLatex(object.y)})`
    );
  }
  return Option.none();
}
