/**
 * The scroll position that keeps a cell inside a scrolling column: where the
 * column already is when the cell fits, otherwise the nearest position that
 * shows the whole cell.
 */
export function keepVisible(input: {
  /** Bottom edge of the cell, from the top of the column's content. */
  bottom: number;
  /** Visible height of the column. */
  height: number;
  /** Where the column is scrolled to. */
  scrollTop: number;
  /** Top edge of the cell, from the top of the column's content. */
  top: number;
}) {
  if (input.top < input.scrollTop) {
    return input.top;
  }
  if (input.bottom > input.scrollTop + input.height) {
    return input.bottom - input.height;
  }
  return input.scrollTop;
}
