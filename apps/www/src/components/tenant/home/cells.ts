import { Array as Arr, Option, Schema } from "effect";
import type { ReactNode } from "react";

/**
 * The columns a cell takes in the bento of a home: one or two of two columns from 600 pixels, and one to three of
 * three columns from 960 pixels. A cell that is not shown takes no room, so the others fill it.
 */
export const CellSpan = Schema.Struct({
  three: Schema.Literals([1, 2, 3]),
  two: Schema.Literals([1, 2]),
});

/** The span of a cell at two columns and at three. */
export type CellSpan = typeof CellSpan.Type;

/**
 * A cell of the bento: the key that names it, whether it is shown, its preferred span, and the function that draws
 * it at the span it takes once the row is filled.
 */
interface CellEntry<Key extends string> extends CellSpan {
  readonly draw: (span: CellSpan) => ReactNode;
  readonly key: Key;
  readonly shown: boolean;
}

/** A cell that is shown, with the span it takes once its row is filled, and the function that draws it. */
interface PlacedCell<Key extends string> extends CellSpan {
  readonly draw: (span: CellSpan) => ReactNode;
  readonly key: Key;
}

/** The total of the widths of a row. */
const widthOf = (widths: readonly number[]) =>
  Arr.reduce(widths, 0, (sum, width) => sum + width);

/**
 * The rows that the widths make in a grid of `columns` columns, in order. A width joins the row above while the row
 * and the width still fit, and otherwise it starts a row of its own.
 */
const rowsOf = (widths: readonly number[], columns: number) =>
  Arr.reduce(
    widths,
    Arr.empty<readonly number[]>(),
    (rows, width): readonly (readonly number[])[] => {
      const current = Arr.last(rows);
      if (Option.isSome(current) && widthOf(current.value) + width <= columns) {
        return [...Arr.dropRight(rows, 1), [...current.value, width]];
      }
      return [...rows, [width]];
    }
  );

/**
 * The width of each cell once every row fills its grid. The cells take their preferred widths in order, and the last
 * cell of a row takes the columns that the row has left. So no row ends with an empty space, whichever cells are
 * shown, and a lone cell takes the whole row.
 */
export const fillRows = (
  widths: readonly number[],
  columns: number
): readonly number[] =>
  Arr.flatMap(rowsOf(widths, columns), (row) => {
    const before = Arr.dropRight(row, 1);
    return [...before, columns - widthOf(before)];
  });

/** A span at two columns, which is one or two. */
const twoSpan = (width: number): 1 | 2 => (width >= 2 ? 2 : 1);

/** A span at three columns, which is one, two or three. */
const threeSpan = (width: number): 1 | 2 | 3 => {
  if (width >= 3) {
    return 3;
  }
  return width >= 2 ? 2 : 1;
};

/**
 * The shown cells of a bento, in their order, each with the span it takes at two columns and at three. The rows fill
 * at each width, so the bento has no empty space at any width.
 */
export const placeCells = <Key extends string>(
  entries: readonly CellEntry<Key>[]
): readonly PlacedCell<Key>[] => {
  const shown = Arr.filter(entries, (entry) => entry.shown);
  const two = fillRows(
    Arr.map(shown, (entry) => entry.two),
    2
  );
  const three = fillRows(
    Arr.map(shown, (entry) => entry.three),
    3
  );
  return Arr.map(
    Arr.zip(shown, Arr.zip(two, three)),
    ([entry, [twoWidth, threeWidth]]) => ({
      draw: entry.draw,
      key: entry.key,
      three: threeSpan(threeWidth),
      two: twoSpan(twoWidth),
    })
  );
};
