import { Array as Arr, Option, Schema } from "effect";
import type { ReactNode } from "react";

/** How many of the two columns a cell takes from 600 pixels. */
const NarrowSpan = Schema.Literals([1, 2]);

/** How many twelfths of the row a cell takes from 960 pixels. */
const WideSpan = Schema.Literals([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);

/** The columns of the dashboard from 600 pixels, and the twelfths of its row from 960 pixels. */
const NARROW_COLUMNS = 2;
const WIDE_COLUMNS = 12;

/**
 * The span of a cell on the dashboard: its share of the two columns from 600 pixels, and of the twelve from 960.
 * A cell that is not shown takes no room, so the others fill it.
 */
export const CellSpan = Schema.Struct({
  narrow: NarrowSpan,
  wide: WideSpan,
});

/** The span of a cell, with the type of its schema. */
export type CellSpan = typeof CellSpan.Type;

/**
 * A cell of the dashboard: the key that names it, whether it is shown, its preferred span, and the function that draws
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

/**
 * The shown cells of a dashboard, in their order, each with the span it takes at two columns and at twelve. The rows
 * fill at each width, so the dashboard has no empty space at any width.
 */
export const placeCells = <Key extends string>(
  entries: readonly CellEntry<Key>[]
): readonly PlacedCell<Key>[] => {
  const shown = Arr.filter(entries, (entry) => entry.shown);
  const narrow = fillRows(
    Arr.map(shown, (entry) => entry.narrow),
    NARROW_COLUMNS
  );
  const wide = fillRows(
    Arr.map(shown, (entry) => entry.wide),
    WIDE_COLUMNS
  );
  return Arr.map(
    Arr.zip(shown, Arr.zip(narrow, wide)),
    ([entry, [narrowWidth, wideWidth]]) => ({
      draw: entry.draw,
      key: entry.key,
      narrow: Schema.decodeUnknownSync(NarrowSpan)(narrowWidth),
      wide: Schema.decodeUnknownSync(WideSpan)(wideWidth),
    })
  );
};
