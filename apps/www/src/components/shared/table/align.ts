import { cva } from "class-variance-authority";

/**
 * Where a column's head and cells stand, as the try-out tables place them: the first column, which names the row, at
 * the start, and every other column in the middle, its figures in digits of one width. A last column of figures stands
 * at the end, so the table's text keeps one inset from both of its edges at every width. The row's menu stands at the
 * end and stays at the table's end edge on the row's background while a table wider than the phone scrolls under it,
 * so every row's actions stay in reach: the card's, or the accent the base row draws while a pressable row is hovered
 * (`data-pressable`) or its row is open (`data-state="selected"`).
 */
export const columnAlign = cva("", {
  defaultVariants: { align: "center" },
  variants: {
    align: {
      center: "px-2 text-center tabular-nums sm:px-4",
      end: "ps-2 pe-4 text-end tabular-nums sm:ps-4",
      menu: "bg-card in-[tr[data-pressable]:hover]:bg-accent in-[tr[data-state=selected]]:bg-accent sticky end-0 px-2 text-end sm:px-4",
      start: "ps-4 pe-2 sm:pe-4",
    },
  },
});

/** The place of a column in its table: the first names the row, a column's meta may set it, and the rest stand between. */
export const placeOf = (index: number, align: "end" | "menu" | undefined) => {
  if (align !== undefined) {
    return align;
  }
  return index === 0 ? "start" : "center";
};
