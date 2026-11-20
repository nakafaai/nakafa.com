import { seededUniforms } from "@repo/design-system/components/contents/mathematics/chance";
import { Array as Arr, Schema } from "effect";

/**
 * Two marbles drawn one after the other from a jar. With replacement the
 * first marble goes back before the second draw, so the second draw meets the
 * same jar and the two draws are independent. Without replacement the first
 * marble stays out, so the second draw meets one marble fewer, and one fewer
 * of the first marble's colour: the second draw depends on the first.
 */

/** The colours a jar's marbles come in. */
const MarbleColorSchema = Schema.Literals([
  "red",
  "blue",
  "green",
  "yellow",
  "white",
]);
export type MarbleColor = typeof MarbleColorSchema.Type;

/** How many marbles of one colour the jar holds. */
const MarbleGroupSchema = Schema.Struct({
  color: MarbleColorSchema,
  count: Schema.Int,
});
export type MarbleGroup = typeof MarbleGroupSchema.Type;

/** Whether the first marble goes back into the jar before the second draw. */
const DrawRuleSchema = Schema.Literals(["replace", "keep"]);
export type DrawRule = typeof DrawRuleSchema.Type;

/** The event a lesson asks about: the first marble's colour, then the second's. */
const DrawEventSchema = Schema.Struct({
  first: MarbleColorSchema,
  second: MarbleColorSchema,
});
export type DrawEvent = typeof DrawEventSchema.Type;

/** A fraction kept as its numerator and denominator. */
const FractionSchema = Schema.Struct({
  denominator: Schema.Int,
  numerator: Schema.Int,
});
export type Fraction = typeof FractionSchema.Type;

/** One trial: the jar places of the first and the second marble drawn. */
export const TrialSchema = Schema.Struct({
  first: Schema.Int,
  second: Schema.Int,
});
export type Trial = typeof TrialSchema.Type;

/** The greatest common divisor of two whole numbers, by Euclid's algorithm. */
function divisor(a: number, b: number): number {
  return b === 0 ? Math.abs(a) : divisor(b, a % b);
}

/** A fraction in lowest terms; 0 stays 0/1. */
export function reduced({ denominator, numerator }: Fraction): Fraction {
  if (numerator === 0) {
    return { denominator: 1, numerator: 0 };
  }
  const common = divisor(numerator, denominator);
  return { denominator: denominator / common, numerator: numerator / common };
}

/** How many marbles the jar holds of `color`. */
export function countOf(groups: readonly MarbleGroup[], color: MarbleColor) {
  return Arr.reduce(groups, 0, (sum, group) =>
    group.color === color ? sum + group.count : sum
  );
}

/** How many marbles the jar holds in all. */
export function totalOf(groups: readonly MarbleGroup[]) {
  return Arr.reduce(groups, 0, (sum, group) => sum + group.count);
}

/**
 * The chance of the event step by step: the first draw, the second draw
 * given the first, and both together, each as a fraction the lesson writes
 * unreduced, and the product in lowest terms.
 */
export function eventChance(
  groups: readonly MarbleGroup[],
  event: DrawEvent,
  rule: DrawRule
) {
  const total = totalOf(groups);
  const first = { denominator: total, numerator: countOf(groups, event.first) };
  const taken = rule === "keep" && event.first === event.second ? 1 : 0;
  const second = {
    denominator: rule === "keep" ? total - 1 : total,
    numerator: Math.max(0, countOf(groups, event.second) - taken),
  };
  const both = reduced({
    denominator: first.denominator * second.denominator,
    numerator: first.numerator * second.numerator,
  });
  return { both, first, second };
}

/** The colour of every marble in the jar, one entry per marble, in the order the groups list them. */
export function jarOf(groups: readonly MarbleGroup[]) {
  return Arr.flatMap(groups, (group) =>
    Arr.makeBy(group.count, () => group.color)
  );
}

/**
 * The first `count` trials from the seeded stream: the jar place of each
 * draw. Without replacement the second draw picks among the marbles left, so
 * it never names the first marble's place again.
 */
export function drawTrials(
  total: number,
  rule: DrawRule,
  count: number,
  seed: number
): readonly Trial[] {
  const values = seededUniforms(seed, count * 2);
  return Arr.makeBy(count, (index) => {
    const first = Math.floor(Arr.getUnsafe(values, index * 2) * total);
    const pool = rule === "keep" ? total - 1 : total;
    const pick = Math.floor(Arr.getUnsafe(values, index * 2 + 1) * pool);
    const second = rule === "keep" && pick >= first ? pick + 1 : pick;
    return { first, second };
  });
}

/** The running count of trials that matched the event, after each trial. */
export function runningHits(
  trials: readonly Trial[],
  jar: readonly MarbleColor[],
  event: DrawEvent
) {
  return Arr.drop(
    Arr.scan(trials, 0, (hits, trial) =>
      jar[trial.first] === event.first && jar[trial.second] === event.second
        ? hits + 1
        : hits
    ),
    1
  );
}
