import { cn } from "cn";
import type { ReactNode } from "react";
import { pageRowVariants } from "@/components/shared/content/width";
import { tableCardVariants } from "@/components/shared/table/card";

/**
 * A table that sits inside a part of a page, as shadcn draws one: a rounded border
 * around the table, with every row and its border running the full width inside it.
 * Each cell keeps its words on one line, and a table wider than the frame scrolls inside
 * it, so a narrow screen never breaks a name in the middle of a word. A table that is
 * the whole body of its page is a `DataTable`, which runs from edge to edge instead.
 */
export function TableFrame({ children }: { children: ReactNode }) {
  return (
    <div className="bg-card overflow-hidden rounded-xl border [&_[data-slot=table-cell]]:whitespace-nowrap">
      {children}
    </div>
  );
}

/**
 * The body of a page whose body is one list, under the page's header: the page's gutter, at the
 * width of the page's content, and one card that fills the rest of the page's height, drawn as the
 * try-out catalog draws its lists. A settings section's table takes the column width of its cards;
 * a working table, such as the exams, rooms or results, takes the page width. The data table fills
 * the card, its rows divided and running the card's width, and so does the empty state in its
 * place; a table taller than the card scrolls inside it with its column heads in view. The table
 * closes on its last row (`tableCardVariants`). A list with views shows them above its card (`TableViews`), never in the
 * page's header.
 */
export function TablePageBody({
  children,
  views,
}: {
  children: ReactNode;
  /** The list's views, which stand above the card. */
  views?: ReactNode;
}) {
  return (
    <div
      className={cn(
        pageRowVariants(),
        "flex min-h-0 flex-1 flex-col gap-3 py-4"
      )}
      data-slot="table-page-body"
    >
      {views}
      <div
        className={cn(
          tableCardVariants(),
          "bg-card text-card-foreground flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border shadow-sm"
        )}
        data-slot="table-card"
      >
        {children}
      </div>
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
