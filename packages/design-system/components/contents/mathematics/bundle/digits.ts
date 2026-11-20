import { Array as Arr, Option, Schema } from "effect";

/**
 * The arithmetic of bundling. A heap of sticks is tied into bundles of b,
 * the bundles are boxed b to a box, and the boxes go b to a tray, so the
 * sticks left loose, the bundles left over, the boxes left over and the
 * trays are the digits of the count in base b, worth 1, b, b^2 and b^3.
 * Each round of bundling is one division by b: the quotient is what the
 * next round bundles, and the remainder stays behind as a digit.
 */

/** The places the desk fills: loose sticks, bundles, boxes and trays. */
export const BUNDLE_PLACES = 4;

/** The most sticks one heap on the desk holds. */
export const MOST_STICKS = 300;

/** The fewest sticks the learner can set. */
export const FEWEST_STICKS = 1;

/**
 * The largest count the desk shows in `base`: as many sticks as fit, and
 * no more than one tray, so the tray's boxes all lie in sight.
 */
export function largestCount(base: number) {
  return Math.min(MOST_STICKS, 2 * base ** (BUNDLE_PLACES - 1) - 1);
}

/** `count` as a whole number of sticks the desk can show in `base`. */
export function clampCount(count: number, base: number) {
  return Math.min(
    Math.max(Math.round(count), FEWEST_STICKS),
    largestCount(base)
  );
}

/** One division of the ladder: `dividend = quotient × base + remainder`. */
export const DivisionStepSchema = Schema.Struct({
  dividend: Schema.Int,
  quotient: Schema.Int,
  remainder: Schema.Int,
});
type DivisionStep = typeof DivisionStepSchema.Type;

/**
 * Divides `count` by `base` again and again until the quotient is 0. The
 * remainders, last first, are the digits of `count` in `base`.
 */
export function divisionLadder(
  count: number,
  base: number
): readonly DivisionStep[] {
  return Arr.unfold(count, (dividend) => {
    if (dividend <= 0) {
      return Option.none();
    }
    const quotient = Math.floor(dividend / base);
    const step = { dividend, quotient, remainder: dividend - quotient * base };
    return Option.some([step, quotient] as const);
  });
}

/** How many digits `count` has in `base`: one for every division of the ladder. */
export function numeralLength(count: number, base: number) {
  return Math.max(1, divisionLadder(count, base).length);
}

/** The digit of each place, loose sticks first, as many as the desk has places. */
export function placeDigits(count: number, base: number) {
  return Arr.makeBy(
    BUNDLE_PLACES,
    (place) => Math.floor(count / base ** place) % base
  );
}

/** `count` written in `base` with the base as a subscript, as KaTeX. */
export function numeralMath(count: number, base: number) {
  const digits = Arr.reverse(
    Arr.take(placeDigits(count, base), numeralLength(count, base))
  );
  return `${Arr.join(Arr.map(digits, String), "")}_{${base}}`;
}

/** One division as an equation, `dividend = quotient × base + remainder`, as KaTeX. */
export function stepMath(
  { dividend, quotient, remainder }: DivisionStep,
  base: number
) {
  return `${dividend} = ${quotient} \\times ${base} + ${remainder}`;
}

/** The whole ladder as aligned equations, one division to a line, as KaTeX. */
export function ladderMath(count: number, base: number) {
  const lines = Arr.map(
    divisionLadder(count, base),
    ({ dividend, quotient, remainder }) =>
      `${dividend} &= ${quotient} \\times ${base} + ${remainder}`
  );
  return `\\begin{aligned} ${Arr.join(lines, " \\\\ ")} \\end{aligned}`;
}

/**
 * What one place is worth, as KaTeX: as a power of the base and in base
 * ten, or, where a label has little room, as the power alone. A thin
 * space after the power keeps its exponent clear of the equals sign in the
 * label's outlined lettering.
 */
export function placeValueMath(place: number, base: number, roomy: boolean) {
  const power = `${base}^{${place}}`;
  return roomy ? `${power} \\, = ${base ** place}` : power;
}
