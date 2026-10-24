/**
 * Whether a read that returned `length` rows reached its `bound`, so rows beyond it may match too. A list that its read
 * bounds can hide more rows, so its count must not read as exact once the read is full.
 */
export const reachesBound = (length: number, bound: number) => length >= bound;

/**
 * What a count reads as. A count whose list may hide more rows reads with a plus sign, so it never shows as an exact
 * total past its bound.
 */
export const countLabel = (counted: number, bounded: boolean) =>
  bounded ? `${counted}+` : `${counted}`;
