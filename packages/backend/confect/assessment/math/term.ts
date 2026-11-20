import { Array as Arr, Order, Predicate, Rational, Schema } from "effect";

/**
 * The operators a term applies, named as MathJSON names them. `Add` and `Multiply` take any number of
 * operands, `Power` a base and an exponent, `Root` an odd index and a radicand, `Log` a base and an
 * argument, and every other operator one argument. A difference is a sum with a negated term, a quotient
 * a product with a power of minus one, an even root a power of one over its index, and `\exp` a power of
 * `e`, so these few operators spell every expression.
 */
export const Operator = Schema.Literals([
  "Abs",
  "Add",
  "Arccos",
  "Arcsin",
  "Arctan",
  "Cos",
  "Cosh",
  "Cot",
  "Csc",
  "Ln",
  "Log",
  "Multiply",
  "Power",
  "Root",
  "Sec",
  "Sin",
  "Sinh",
  "Tan",
  "Tanh",
]);
export type Operator = typeof Operator.Type;

/**
 * One term of an expression, in the shape of MathJSON (https://mathlive.io/math-json/): an exact number,
 * a symbol, or an operator applied to its operands. A symbol is a variable, such as `x`, `x_0`, or
 * `\theta`, or one of the two constants `e` and `pi`. Numbers stay exact, so `0.5` and `\frac{1}{2}` are
 * one number.
 */
export type Term = Rational.Rational | string | readonly [Operator, ...Term[]];

/** The symbols that name a constant rather than a variable: Euler's number and pi. */
const CONSTANTS = ["e", "pi"] as const;

/** Whether a term is an exact number. */
export const isNumber = Rational.isRational;

/** Whether a term is a symbol, a variable or a constant. */
export const isSymbol = Predicate.isString;

/** Whether a symbol names a variable, which takes any value, rather than a constant. */
export const isVariable = (symbol: string) => !Arr.contains(CONSTANTS, symbol);

/** The term of a whole number. */
export const integer = (value: number) => Rational.fromBigInt(BigInt(value));

/** A term negated: the product of minus one and the term. */
export const negate = (term: Term): Term => ["Multiply", integer(-1), term];

/** A term's reciprocal: the term to the power of minus one. */
export const reciprocal = (term: Term): Term => ["Power", term, integer(-1)];

/**
 * The variables a term names, each once and in alphabetical order, so the points a sample reads assign
 * them the same way every time.
 */
export const variablesOf = (term: Term): readonly string[] => {
  if (isNumber(term)) {
    return [];
  }
  if (isSymbol(term)) {
    return isVariable(term) ? [term] : [];
  }
  const [, ...operands] = term;
  return Arr.sort(Arr.dedupe(Arr.flatMap(operands, variablesOf)), Order.String);
};
