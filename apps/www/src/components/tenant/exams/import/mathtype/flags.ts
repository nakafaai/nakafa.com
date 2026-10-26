/**
 * The bit fields of MTEF 5, read by arithmetic: each option and variation flag is a power of two,
 * and a field is a run of bits within a byte or word.
 */

/** Whether a flag, a power of two, is set in a value. */
export const hasFlag = (value: number, flag: number) =>
  Math.floor(value / flag) % 2 === 1;

/** The field of `count` bits that starts at bit `from` of a value. */
export const fieldOf = (value: number, from: number, count: number) =>
  Math.floor(value / 2 ** from) % 2 ** count;

/** A little-endian 16-bit integer from its two bytes. */
export const wordOf = (low: number, high: number) => low + high * 256;
