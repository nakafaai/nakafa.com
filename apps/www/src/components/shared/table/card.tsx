import { cva } from "class-variance-authority";
import type { ReactNode } from "react";

/**
 * A table that fills a card closes on its last row, so its rows and its action column never stop short over the empty
 * part of the card. A list that fills the card brings that line to the frame's own edge, so the table's last pixel is
 * covered there, and the two never read as a double border.
 */
export const tableCardVariants = cva(
  "[&_[data-slot=table-container]]:after:bg-card [&_[data-slot=table-body]_tr:last-child]:border-b [&_[data-slot=table-container]]:relative [&_[data-slot=table-container]]:after:pointer-events-none [&_[data-slot=table-container]]:after:absolute [&_[data-slot=table-container]]:after:inset-x-0 [&_[data-slot=table-container]]:after:bottom-0 [&_[data-slot=table-container]]:after:z-20 [&_[data-slot=table-container]]:after:h-px"
);

/**
 * The box of a data table, whose cells keep their words on one line. It fills the card, except over a list's empty
 * state, which fills the card under the column heads instead. Only rows close a table, so a table with none draws no
 * line: left in place it would move from the card's bottom edge as the rows read, to the heads for an empty list and
 * past the screen for a long one.
 */
export const tableBoxVariants = cva(
  "[&_[data-slot=table-cell]]:whitespace-nowrap",
  {
    variants: {
      closes: { false: "after:hidden", true: "" },
      fills: { false: "h-auto", true: "flex-1" },
    },
  }
);

/**
 * A table that sits inside a part of a page, as shadcn draws one: a rounded border around the table, with every row and
 * its border running the full width inside it. Each cell keeps its words on one line, and a table wider than the frame
 * scrolls inside it, so a narrow screen never breaks a name in the middle of a word. A table that is the whole body of
 * its page stands in the page's list card (`PageList`) instead.
 */
export function TableFrame({ children }: { children: ReactNode }) {
  return (
    <div className="bg-card overflow-hidden rounded-xl border [&_[data-slot=table-cell]]:whitespace-nowrap">
      {children}
    </div>
  );
}

/**
 * The footer of a table's card, under its rows: one sentence about the whole list. It keeps the inset of the table's
 * first column, so its first letter stands on the same line as the rows above it.
 */
export function TableNote({ children }: { children: ReactNode }) {
  return (
    <p className="text-muted-foreground shrink-0 border-t px-4 py-3 text-sm text-pretty">
      {children}
    </p>
  );
}
