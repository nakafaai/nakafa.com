import type { ReactNode } from "react";

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
