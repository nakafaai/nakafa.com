import { cva } from "class-variance-authority";
import { Schema } from "effect";
import { createContext } from "react";

/** Where a column head's button stands in its cell. */
export const HeadAlign = Schema.Literals(["center", "end", "start"]);

/**
 * The place of the head buttons under it, for a column whose head a shared component draws: the table's first
 * column at the start, its last column of figures at the end.
 */
export const HeadAlignContext = createContext<typeof HeadAlign.Type>("center");

/**
 * Where a column's menu opens under its head, so the pointer barely moves: at the start under the first column, at the
 * end under the last that has one, and centred under the rest. The popup still moves to stay on the screen.
 */
export const HeadMenuContext = createContext<typeof HeadAlign.Type>("center");

/** Where the menu of a column opens, by its place among the columns that hold one, up to `last`. */
export const menuPlaceOf = (
  index: number,
  last: number
): typeof HeadAlign.Type => {
  if (index === 0) {
    return "start";
  }
  return index === last ? "end" : "center";
};

/**
 * Where a column's head and cells stand, as the try-out tables place them: the first column, which names the row, at
 * the start, and every other column in the middle, its figures in digits of one width. A last column of figures stands
 * at the end, so the table's text keeps one inset from both of its edges at every width. It and the row's menu stay at
 * the table's end edge on the row's background while a table wider than the phone scrolls under them, so the row's
 * amount and actions stay in reach: the card's, or the muted colour the base row draws while a pressable row is hovered
 * (`data-pressable`, or `--table-row-fill` from a row whose first column holds its link) or its row is open
 * (`data-state="selected"`). A last column of figures before the row's menu keeps
 * its place beside the menu. The row's menu takes the width of its button and no more, so its line stands beside it and
 * the rest of the row's width goes to the data.
 */
export const columnAlign = cva("in-[thead]:bg-muted", {
  defaultVariants: { align: "center" },
  variants: {
    align: {
      center: "px-2 text-center tabular-nums sm:px-4",
      end: "in-[tr[data-pressable]:hover]:bg-muted in-[tr[data-state=selected]]:bg-muted before:bg-border sticky end-0 bg-[var(--table-row-fill,var(--card))] ps-2 pe-4 text-end tabular-nums before:absolute before:inset-y-0 before:start-0 before:w-px sm:ps-4",
      figure:
        "in-[tr[data-pressable]:hover]:bg-muted in-[tr[data-state=selected]]:bg-muted sticky end-12 bg-[var(--table-row-fill,var(--card))] px-2 text-end tabular-nums sm:px-4",
      menu: "in-[tr[data-pressable]:hover]:bg-muted in-[tr[data-state=selected]]:bg-muted before:bg-border sticky end-0 w-px bg-[var(--table-row-fill,var(--card))] px-2 py-0 text-end whitespace-nowrap before:absolute before:inset-y-0 before:start-0 before:w-px",
      start: "ps-4 pe-2 sm:pe-4",
    },
  },
});

/**
 * How wide a data table's column stands, by what it holds, so its head keeps its place when its rows arrive and when a
 * later page brings a longer value. A table sizes a column to its content, so without these the heads of a table with
 * no rows yet stand up to 46 px from where its rows put them. A column of dates, figures or known values holds a width
 * that fits them, a column of text takes what those leave, down to the room of a name, and a value wider than its
 * column still widens it.
 */
export const headWidth = cva("", {
  variants: {
    width: {
      choice: "w-36",
      days: "w-48",
      menu: "min-w-12",
      number: "w-28",
      text: "min-w-48",
      values: "w-36",
    },
  },
});

/** Where a head's button stands at each place of its column: over a column's figures, and in the middle over a menu. */
export const headPlace = {
  center: "center",
  end: "end",
  figure: "end",
  menu: "center",
  start: "start",
} as const satisfies Record<string, typeof HeadAlign.Type>;

/** The place of a column in its table: the first names the row, a column's meta may set it, and the rest stand between. */
export const placeOf = (
  index: number,
  align: "end" | "figure" | "menu" | undefined
) => {
  if (align !== undefined) {
    return align;
  }
  return index === 0 ? "start" : "center";
};
