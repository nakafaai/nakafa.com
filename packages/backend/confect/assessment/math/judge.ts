import {
  canonicalOf,
  isVariablePolynomial,
  subtract,
} from "@repo/backend/confect/assessment/math/canon";
import { evaluate } from "@repo/backend/confect/assessment/math/evaluate";
import { parseExpression } from "@repo/backend/confect/assessment/math/parse";
import {
  agree,
  agreesAtPoints,
} from "@repo/backend/confect/assessment/math/sample";
import type { Term } from "@repo/backend/confect/assessment/math/term";
import { variablesOf } from "@repo/backend/confect/assessment/math/term";
import { Array as Arr, Option, Schema } from "effect";

/**
 * How a typed expression compares with its key, by how the check reached its verdict (ADR 0031, section
 * 3). `proven`: the canonical forms are the same, or two expressions without a variable have the same
 * value. `sampled`: they take the same value at every seeded point where both are defined, which is
 * strong evidence and not a proof. `none`: neither, or the answer is no expression the grader reads.
 * ADR 0031's `withinTolerance` needs a tolerance the interaction states, and a math entry's key states
 * none (`@nakafa/aksara-contracts` 8.4.0, `assessment/key`: an interaction and an expression), so it is
 * not an outcome here.
 */
export const MathOutcome = Schema.Literals(["proven", "sampled", "none"]);
export type MathOutcome = typeof MathOutcome.Type;

/**
 * How close two values without a variable must be to be one number, relative to the larger. Exact numbers
 * compare exactly in the canonical form first, so this applies only where an irrational number such as
 * `\ln 4` against `2\ln 2` leaves the question to arithmetic, and it sits at the edge of double precision.
 */
const CONSTANT_TOLERANCE = 1e-12;

/** Whether two expressions without a variable have the same finite value. */
const sameNumber = (expected: Term, typed: Term) => {
  const left = evaluate(expected, {});
  const right = evaluate(typed, {});
  return (
    Number.isFinite(left) &&
    Number.isFinite(right) &&
    agree(left, right, CONSTANT_TOLERANCE)
  );
};

/**
 * Compares two read expressions in the order of ADR 0031. The canonical forms decide first: the same
 * form proves the answer, and a difference that is a nonzero polynomial in the variables alone proves it
 * wrong, so no answer of that kind is ever left to a sample. Two expressions without a variable compare
 * as numbers. Anything else is sampled at points seeded by the two texts (`agreesAtPoints`).
 */
const compare = (expected: Term, typed: Term, seed: string): MathOutcome => {
  const forms = Option.all([canonicalOf(expected), canonicalOf(typed)]);
  if (Option.isSome(forms)) {
    const difference = subtract(forms.value[0], forms.value[1]);
    if (Arr.isReadonlyArrayEmpty(difference)) {
      return "proven";
    }
    if (isVariablePolynomial(difference)) {
      return "none";
    }
  }
  const variables = Arr.appendAll(variablesOf(expected), variablesOf(typed));
  if (Arr.isReadonlyArrayEmpty(variables)) {
    return sameNumber(expected, typed) ? "proven" : "none";
  }
  return agreesAtPoints(expected, typed, seed) ? "sampled" : "none";
};

/**
 * Judges a typed expression against the key's expression, both LaTeX. The answer is untrusted: one that
 * the grader cannot read, because it is too long, nests too deep, or is no expression, is `none`, and no
 * input can make the check loop or run long, since every step is bounded. The same two texts always give
 * the same outcome. It is none when the key itself is no expression the grader reads, so that answer
 * waits for a person rather than being marked wrong.
 */
export const judgeMath = (
  expected: string,
  typed: string
): Option.Option<MathOutcome> =>
  Option.map(parseExpression(expected), (key) =>
    Option.match(parseExpression(typed), {
      onNone: (): MathOutcome => "none",
      onSome: (answer) => compare(key, answer, `${expected}\n${typed}`),
    })
  );
