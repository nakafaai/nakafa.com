/**
 * What a count reads as. The rows a count is taken from come from a read with a bound, so a read that reaches the
 * bound may hide more rows that match. Such a count reads with a plus sign, so it never shows as exact past its bound.
 */
export const countLabel = (counted: number, read: number, bound: number) =>
  read >= bound ? `${counted}+` : `${counted}`;
