import { Array as Arr } from "effect";

/**
 * Place value on a spike abacus. Each of its four spikes stands for one
 * power of the base, b^3, b^2, b and 1 from left to right, and holds as many
 * beads as that place's digit. In base b a spike holds at most b - 1 beads:
 * one more fills it to b, so its b beads come off and one bead goes onto the
 * next spike to the left. The places are counted from the units, so place p
 * is worth b^p.
 */

/** How many spikes the abacus has, so the most it shows in base b is b^4 - 1. */
export const PLACES = 4;

/** The largest number the four spikes hold in `base`: b^4 - 1. */
export function largestValue(base: number) {
  return base ** PLACES - 1;
}

/** `value` as a whole number from 0 to the largest the spikes hold in `base`. */
export function clampValue(value: number, base: number) {
  return Math.min(Math.max(Math.round(value), 0), largestValue(base));
}

/** The number that follows `value` on the abacus: one more, or 0 after the largest. */
export function nextValue(value: number, base: number) {
  return (value + 1) % (largestValue(base) + 1);
}

/**
 * The digits of `value` in `base`, one per spike, units first: 11 in base 2
 * is [1, 1, 0, 1], since 11 = 1·2^3 + 0·2^2 + 1·2 + 1.
 */
export function digitsOf(value: number, base: number) {
  return Arr.makeBy(
    PLACES,
    (place) => Math.floor(value / base ** place) % base
  );
}

/**
 * How many spikes adding one bead fills, units first: the run of digits
 * equal to b - 1 at the right of the number. 7 in base 2 is 0111, so adding
 * one carries three times.
 */
export function carryChain(value: number, base: number) {
  return Arr.takeWhile(digitsOf(value, base), (digit) => digit === base - 1)
    .length;
}

/** The digits from the leading one down, written as they are read; 0 alone for zero. */
function leadingDigits(value: number, base: number) {
  const digits = Arr.dropWhile(
    Arr.reverse(digitsOf(value, base)),
    (digit) => digit === 0
  );
  return Arr.isArrayNonEmpty(digits) ? digits : [0];
}

/** `value` written in `base` with the base as a subscript, as KaTeX: 1011_{2}. */
export function numeral(value: number, base: number) {
  return `${Arr.join(Arr.map(leadingDigits(value, base), String), "")}_{${base}}`;
}

/** One place's term of the expanded form: d \times b^p, d \times b for the base, d for the units. */
function term(digit: number, place: number, base: number) {
  if (place === 0) {
    return `${digit}`;
  }
  if (place === 1) {
    return `${digit} \\times ${base}`;
  }
  return `${digit} \\times ${base}^{${place}}`;
}

/**
 * `value` as the sum of its digits times the powers of the base, from the
 * leading digit down, as KaTeX: 11 in base 2 is
 * 1 \times 2^{3} + 0 \times 2^{2} + 1 \times 2 + 1.
 */
export function expandedForm(value: number, base: number) {
  const digits = leadingDigits(value, base);
  return Arr.join(
    Arr.map(digits, (digit, index) =>
      term(digit, digits.length - 1 - index, base)
    ),
    " + "
  );
}

/** A place's value as a power of the base, as KaTeX: b^{3}, b^{2}, b^{1}, b^{0}. */
export function placePower(place: number, base: number) {
  return `${base}^{${place}}`;
}
