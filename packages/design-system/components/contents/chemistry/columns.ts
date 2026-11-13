/**
 * How many columns a lab's toggle of `count` choices takes: two side by side,
 * three or four in one row on a wide card, and more on as many rows as fit.
 */
export function toggleColumns(count: number) {
  if (count <= 2) {
    return "2" as const;
  }
  if (count === 3) {
    return "3" as const;
  }
  return count === 4 ? ("4" as const) : ("auto" as const);
}
