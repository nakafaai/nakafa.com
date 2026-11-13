import type { ReactNode } from "react";

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
