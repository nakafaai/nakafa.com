import type {
  Operator,
  Term,
} from "@repo/backend/confect/assessment/math/term";
import { isNumber, isSymbol } from "@repo/backend/confect/assessment/math/term";
import {
  Array as Arr,
  Match,
  Number as Num,
  Option,
  Rational,
  Record as Rec,
} from "effect";

/** The operators of one argument, each with the real function it computes. */
const FUNCTIONS: Record<
  Exclude<Operator, "Add" | "Log" | "Multiply" | "Power" | "Root">,
  (value: number) => number
> = {
  Abs: Math.abs,
  Arccos: Math.acos,
  Arcsin: Math.asin,
  Arctan: Math.atan,
  Cos: Math.cos,
  Cosh: Math.cosh,
  Cot: (value) => 1 / Math.tan(value),
  Csc: (value) => 1 / Math.sin(value),
  Ln: Math.log,
  Sec: (value) => 1 / Math.cos(value),
  Sin: Math.sin,
  Sinh: Math.sinh,
  Tan: Math.tan,
  Tanh: Math.tanh,
};

/** The real odd root of a number, negative for a negative radicand, as `\sqrt[3]{-8}` is `-2`. */
const oddRoot = (index: number, radicand: number) =>
  Math.sign(radicand) * Math.abs(radicand) ** (1 / index);

/**
 * The value of a term where each variable takes its value at the point, as a real number. Where the
 * term is undefined, as a logarithm of a negative number or a division by zero, the value is not
 * finite (`NaN` or an infinity), and a caller skips that point. A variable the point does not hold has
 * no value.
 */
export const evaluate = (term: Term, point: Record<string, number>): number => {
  if (isNumber(term)) {
    return Rational.toNumberUnsafe(term);
  }
  if (isSymbol(term)) {
    return Match.value(term).pipe(
      Match.when("e", () => Math.E),
      Match.when("pi", () => Math.PI),
      Match.orElse((name) =>
        Option.getOrElse(Rec.get(point, name), () => Number.NaN)
      )
    );
  }
  const [operator, ...operands] = term;
  const values = Arr.map(operands, (operand) => evaluate(operand, point));
  return Match.value(operator).pipe(
    Match.when("Add", () => Num.sumAll(values)),
    // Not Number.multiplyAll, which answers 0 at the first zero factor: an undefined factor must leave
    // the product undefined, as `0 \cdot \ln(-1)` is.
    Match.when("Multiply", () =>
      Arr.reduce(values, 1, (product, value) => product * value)
    ),
    Match.when("Power", () => values[0] ** values[1]),
    Match.when("Root", () => oddRoot(values[0], values[1])),
    Match.when("Log", () => Math.log(values[1]) / Math.log(values[0])),
    Match.orElse((unary) => FUNCTIONS[unary](values[0]))
  );
};
