import { evaluate } from "@repo/backend/confect/assessment/math/evaluate";
import type { Term } from "@repo/backend/confect/assessment/math/term";
import { variablesOf } from "@repo/backend/confect/assessment/math/term";
import { Array as Arr, Hash, Order, Record as Rec } from "effect";

/** How many points a sample reads. */
export const POINTS = 24;

/** The fewest points where both expressions are defined that a sample needs before it may agree. */
export const DEFINED_MIN = 8;

/**
 * How close two values must be to agree, relative to the larger of them and never less than this
 * absolutely: twelve orders of magnitude above double rounding, and far below any slip of a sign, a
 * coefficient, or an exponent.
 */
export const SAMPLE_TOLERANCE = 1e-9;

/** Whether two finite values agree within a relative tolerance. */
export const agree = (left: number, right: number, tolerance: number) =>
  Math.abs(left - right) <=
  tolerance * Math.max(1, Math.abs(left), Math.abs(right));

/**
 * The value of one variable at one point, from the hash of the seed, the point, and the variable. Every
 * even point lies in (0.1, 4], where a root or a logarithm of the variable is defined, and every odd one
 * in [-4, 4]. The same seed gives the same points, so a verdict never changes on a second look, and
 * since the seed holds the answer itself, no answer can be written to vanish at its own points.
 */
const valueAt = (seed: string, index: number, variable: string) => {
  const unit = (Hash.string(`${seed}|${index}|${variable}`) >>> 0) / 2 ** 32;
  return index % 2 === 0 ? 0.1 + 3.9 * unit : 8 * unit - 4;
};

/** How two expressions compare at one point: both defined and equal, both defined and different, or not both defined. */
const compareAt = (expected: Term, typed: Term, point: Record<string, number>) => {
  const left = evaluate(expected, point);
  const right = evaluate(typed, point);
  if (!(Number.isFinite(left) && Number.isFinite(right))) {
    return "undefined";
  }
  return agree(left, right, SAMPLE_TOLERANCE) ? "equal" : "different";
};

/**
 * Whether two expressions take the same value at every seeded point where both are defined, and at no
 * fewer than `DEFINED_MIN` of the `POINTS`. One point where they differ is enough to refuse, and a pair
 * that is rarely defined at once is refused too, since too few points prove nothing. Each variable of
 * either expression takes its own value at each point (`valueAt`).
 */
export const agreesAtPoints = (expected: Term, typed: Term, seed: string) => {
  const variables = Arr.sort(
    Arr.dedupe(Arr.appendAll(variablesOf(expected), variablesOf(typed))),
    Order.String
  );
  const comparisons = Arr.makeBy(POINTS, (index) =>
    compareAt(
      expected,
      typed,
      Rec.fromEntries(
        Arr.map(variables, (variable) => [
          variable,
          valueAt(seed, index, variable),
        ])
      )
    )
  );
  return (
    !Arr.contains(comparisons, "different") &&
    Arr.filter(comparisons, (comparison) => comparison === "equal").length >=
      DEFINED_MIN
  );
};
