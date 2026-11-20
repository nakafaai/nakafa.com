import { FACES } from "@repo/design-system/components/contents/mathematics/dice/faces";
import { Array as Arr, Schema } from "effect";

/**
 * The theory a dice roll is measured against. One fair die shows each face
 * 1 to 6 equally often. Two dice give 36 ordered results, the first die's
 * face with the second's, all equally likely, and the outcome is their sum,
 * so a sum that more pairs make, such as 7, turns up more often than one
 * that only a single pair makes, such as 2 or 12.
 */

/** How many dice a roll throws: one die, or a pair whose faces are added. */
const DiceCountSchema = Schema.Literals([1, 2]);
export type DiceCount = typeof DiceCountSchema.Type;

/** Every outcome a roll can show: the faces 1 to 6, or the sums 2 to 12. */
export function outcomes(dice: DiceCount) {
  return Arr.range(dice, dice * 6);
}

/** The outcome of every equally likely result, one entry per ordered result. */
function results(dice: DiceCount) {
  if (dice === 1) {
    return FACES;
  }
  return Arr.flatMap(FACES, (first) =>
    Arr.map(FACES, (second) => first + second)
  );
}

/** How many equally likely results a roll has: 6 for one die, 36 for two. */
export function resultCount(dice: DiceCount) {
  return results(dice).length;
}

/** How many of those results show `target`. */
export function waysTo(dice: DiceCount, target: number) {
  return Arr.filter(results(dice), (outcome) => outcome === target).length;
}

/** The probability of rolling `target`, as a number. */
export function probabilityOf(dice: DiceCount, target: number) {
  return waysTo(dice, target) / resultCount(dice);
}

/** The greatest common divisor of two whole numbers, by Euclid's algorithm. */
function divisor(first: number, second: number): number {
  return second === 0 ? first : divisor(second, first % second);
}

/**
 * The probability of rolling `target` as KaTeX: the count of results over
 * all of them, and that fraction in lowest terms when it reduces, such as
 * `\frac{6}{36} = \frac{1}{6}`.
 */
export function probabilityMath(dice: DiceCount, target: number) {
  const ways = waysTo(dice, target);
  const total = resultCount(dice);
  const counted = `\\frac{${ways}}{${total}}`;
  if (ways === 0) {
    return `${counted} = 0`;
  }
  const common = divisor(ways, total);
  if (common === 1) {
    return counted;
  }
  return `${counted} = \\frac{${ways / common}}{${total / common}}`;
}
