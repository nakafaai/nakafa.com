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
 * Where a column's head and cells stand, as the try-out tables place them: the first column, which names the row, at
 * the start, and every other column in the middle, its figures in digits of one width. A last column of figures stands
 * at the end, so the table's text keeps one inset from both of its edges at every width. It and the row's menu stay at
 * the table's end edge on the row's background while a table wider than the phone scrolls under them, so the row's
 * amount and actions stay in reach: the card's, or the accent the base row draws while a pressable row is hovered
 * (`data-pressable`) or its row is open (`data-state="selected"`). A last column of figures before the row's menu keeps
 * its place beside the menu.
 */
export const columnAlign = cva("", {
  defaultVariants: { align: "center" },
  variants: {
    align: {
      center: "px-2 text-center tabular-nums sm:px-4",
      end: "bg-card before:bg-border sticky end-0 ps-2 pe-4 text-end tabular-nums before:absolute before:inset-y-0 before:start-0 before:w-px sm:ps-4",
      figure: "bg-card sticky end-12 px-2 text-end tabular-nums sm:px-4",
      menu: "bg-card in-[tr[data-pressable]:hover]:bg-accent in-[tr[data-state=selected]]:bg-accent before:bg-border sticky end-0 px-2 text-end before:absolute before:inset-y-0 before:start-0 before:w-px sm:px-4",
      start: "ps-4 pe-2 sm:pe-4",
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
