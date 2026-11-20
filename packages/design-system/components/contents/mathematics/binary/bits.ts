import { Array as Arr, Schema } from "effect";

/**
 * A number in base two as a row of lamps. Each lamp stands for one place
 * value, a power of two, and is on when its digit is 1. Base four and base
 * eight read the same row in groups: 4 = 2² and 8 = 2³, so every two bits,
 * or every three, counted from the right make exactly one digit of the
 * other base. A row whose length is not a multiple of the group size is
 * padded on the left with zeros, which change no value.
 */

/** How the row is read: bit by bit, in pairs for base four, or in triples for base eight. */
export const GroupingSchema = Schema.Literals(["none", "pairs", "triples"]);
export type Grouping = typeof GroupingSchema.Type;

/** The fewest and the most lamps a row may have. */
export const BITS = { max: 8, min: 4 } as const;

/** How many bits one group holds, and the base its digit is written in. */
const GROUPS = {
  none: { base: 2, size: 1 },
  pairs: { base: 4, size: 2 },
  triples: { base: 8, size: 3 },
} as const;

/** The base a grouping writes its digits in: 2, 4 or 8. */
export function groupBase(grouping: Grouping) {
  return GROUPS[grouping].base;
}

/** The number of lamps of a row, a whole number from 4 to 8. */
export function lampCount(bits: number) {
  return Math.min(BITS.max, Math.max(BITS.min, Math.round(bits)));
}

/** The largest number a row of `bits` lamps shows: every lamp on. */
export function largestCount(bits: number) {
  return 2 ** lampCount(bits) - 1;
}

/** A whole number the row can show, from 0 to its largest. */
export function clampCount(value: number, bits: number) {
  return Math.min(largestCount(bits), Math.max(0, Math.round(value)));
}

/** The number after `value`, back to 0 after every lamp was on, as a counter rolls over. */
export function nextCount(value: number, bits: number) {
  return (clampCount(value, bits) + 1) % (largestCount(bits) + 1);
}

/** The place value of every lamp from the left: 2^(bits - 1) down to 1. */
export function placeValues(bits: number) {
  const count = lampCount(bits);
  return Arr.map(Arr.range(1, count), (place) => 2 ** (count - place));
}

/** The digit of every lamp from the left, 1 where the lamp is on. */
export function digitsOf(value: number, bits: number) {
  const shown = clampCount(value, bits);
  return Arr.map(placeValues(bits), (place) => Math.floor(shown / place) % 2);
}

/**
 * How many places the row holds when it is padded for every grouping: the
 * longest of the row in pairs and in threes. A panel keeps one blank slot
 * for every place a grouping may pad.
 */
export function slotCount(bits: number) {
  const count = lampCount(bits);
  return Math.max(
    Math.ceil(count / GROUPS.pairs.size) * GROUPS.pairs.size,
    Math.ceil(count / GROUPS.triples.size) * GROUPS.triples.size
  );
}

/** One group of a grouped row: the slots it spans, from the left, and its digit. */
const BitGroupSchema = Schema.Struct({
  digit: Schema.Int,
  first: Schema.Int,
  last: Schema.Int,
});
type BitGroup = typeof BitGroupSchema.Type;

/**
 * The groups of the row in `grouping`, from the left, as slots of a panel of
 * `slotCount(bits)` places whose lamps stand on the right. Each group's
 * digit is the sum of its bits' place values within the group, so 110 in a
 * triple reads 6. A row read bit by bit has one group per lamp.
 */
export function groupsOf(value: number, bits: number, grouping: Grouping) {
  const size = GROUPS[grouping].size;
  const padded = Math.ceil(lampCount(bits) / size) * size;
  const offset = slotCount(bits) - padded;
  const shown = clampCount(value, bits);
  const digits = Arr.map(
    Arr.range(1, padded),
    (place) => Math.floor(shown / 2 ** (padded - place)) % 2
  );
  return Arr.map(
    Arr.chunksOf(digits, size),
    (chunk, index): BitGroup => ({
      digit: Arr.reduce(chunk, 0, (sum, digit) => sum * 2 + digit),
      first: offset + index * size,
      last: offset + index * size + size - 1,
    })
  );
}

/** The slots of the panel that a grouping pads with a zero, which hold no lamp. */
export function paddedSlots(bits: number, grouping: Grouping) {
  const size = GROUPS[grouping].size;
  const lampsFrom = slotCount(bits) - lampCount(bits);
  const groupsFrom = slotCount(bits) - Math.ceil(lampCount(bits) / size) * size;
  return Arr.filter(
    Arr.range(0, slotCount(bits) - 1),
    (slot) => slot >= groupsFrom && slot < lampsFrom
  );
}

/**
 * A number in base `base` with its base as a subscript, as KaTeX, without
 * leading zeros: 45 in base two reads 101101_{2}.
 */
export function inBase(value: number, base: number) {
  return `${Math.max(0, Math.round(value)).toString(base)}_{${base}}`;
}

/** The row as KaTeX in base two, such as 101101_{2}. */
export function binaryMath(value: number, bits: number) {
  return inBase(clampCount(value, bits), 2);
}

/**
 * The row read in `grouping` as KaTeX: the number in base four or eight with
 * its subscript, or, read bit by bit, the sum of the place values of the
 * lamps that are on, such as 32 + 8 + 4 + 1.
 */
export function groupedMath(value: number, bits: number, grouping: Grouping) {
  if (grouping !== "none") {
    return inBase(clampCount(value, bits), groupBase(grouping));
  }
  const lit = Arr.map(
    Arr.filter(
      Arr.zip(placeValues(bits), digitsOf(value, bits)),
      ([, digit]) => digit === 1
    ),
    ([place]) => place
  );
  return Arr.match(lit, {
    onEmpty: () => "0",
    onNonEmpty: (places) => Arr.join(Arr.map(places, String), " + "),
  });
}
