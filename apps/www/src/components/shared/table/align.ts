import { cva } from "class-variance-authority";

/**
 * Where a column's head and cells stand, as the try-out tables place them: the first column, which names the row, at
 * the start, and every other column in the middle, its figures in digits of one width. The row's menu stands at the
 * end and stays at the table's end edge on the row's background while a table wider than the phone scrolls under it,
 * so every row's actions stay in reach: the card's, or the accent the base row draws while a pressable row is hovered
 * (`data-pressable`) or its row is open (`data-state="selected"`).
 */
export const columnAlign = cva("px-2 sm:px-4", {
  defaultVariants: { align: "center" },
  variants: {
    align: {
      center: "text-center tabular-nums",
      menu: "bg-card in-[tr[data-pressable]:hover]:bg-accent in-[tr[data-state=selected]]:bg-accent sticky end-0 text-end",
      start: "",
    },
  },
});

/** The place of a column in its table: the first names the row, the menu acts on it, and the rest stand between. */
export const placeOf = (index: number, menu: boolean) => {
  if (menu) {
    return "menu";
  }
  return index === 0 ? "start" : "center";
};
