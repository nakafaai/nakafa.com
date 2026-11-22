import { cva } from "class-variance-authority";

/**
 * A table that fills a card closes on its last row, so its rows and its action column never stop short over the empty
 * part of the card. A list that fills the card brings that line to the frame's own edge, so the table's last pixel is
 * covered there, and the two never read as a double border.
 */
export const tableCardVariants = cva(
  "[&_[data-table=container]]:after:bg-card [&_[data-slot=table-body]_tr:last-child]:border-b [&_[data-table=container]]:relative [&_[data-table=container]]:after:pointer-events-none [&_[data-table=container]]:after:absolute [&_[data-table=container]]:after:inset-x-0 [&_[data-table=container]]:after:bottom-0 [&_[data-table=container]]:after:z-20 [&_[data-table=container]]:after:h-px"
);

/**
 * The box of a data table, whose cells keep their words on one line, so every column stands at every width and a
 * table wider than its card scrolls sideways inside it, never the page. It fills the card, except over a list's empty
 * state, which fills the card under the column heads instead. Only rows close a table, so a table with none draws no
 * line: left in place it would move from the card's bottom edge as the rows read, to the heads for an empty list and
 * past the screen for a long one. The box is the `table` container whose width sizes the columns (`headWidth`), so a
 * table in a narrow pane of a tablet lays out as a phone's does.
 */
export const tableBoxVariants = cva(
  "@container/table [&_[data-slot=table-cell]]:whitespace-nowrap",
  {
    variants: {
      closes: { false: "after:hidden", true: "" },
      fills: { false: "h-auto", true: "flex-1" },
    },
  }
);
