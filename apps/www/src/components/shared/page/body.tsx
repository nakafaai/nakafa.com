import { cn } from "cn";
import type { ReactNode } from "react";
import { pageRowVariants } from "@/components/shared/page/width";
import { tableCardVariants } from "@/components/shared/table/card";

/** The body of a reading page, an article or a lesson: its content in one row of the page, with no rhythm of its own. */
export function PageBody({ children }: { children: ReactNode }) {
  return (
    <article className={cn(pageRowVariants(), "wrap-anywhere")}>
      {children}
    </article>
  );
}

/**
 * The body of a working page, such as a settings section or a School page: its parts one under another, a step apart,
 * with the same room under the header as above the end of the page.
 */
export function PageStack({ children }: { children: ReactNode }) {
  return (
    <div
      className={cn(
        pageRowVariants(),
        "flex flex-col gap-6 py-6 wrap-anywhere"
      )}
      data-slot="page-stack"
    >
      {children}
    </div>
  );
}

/**
 * The body of a page that holds one state in place of its content, such as a missing class or a failed read: the state
 * in the middle of the height the header leaves.
 */
export function PageState({ children }: { children: ReactNode }) {
  return (
    <div
      className={cn(pageRowVariants(), "flex flex-1 items-center py-6")}
      data-slot="page-state"
    >
      {children}
    </div>
  );
}

/**
 * The body of a page whose body is one list: one card that fills the rest of the page's height, drawn as the try-out
 * catalog draws its lists. A settings section's table takes the column's width; a working table, such as the exams,
 * rooms or results, takes the page's. The data table fills the card, its rows divided and running the card's width,
 * and so does the empty state in its place; a table taller than the card scrolls inside it with its column heads in
 * view. The table closes on its last row (`tableCardVariants`). A list with views shows them above its card
 * (`TableViews`), never in the page's header.
 */
export function PageList({
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
      data-slot="page-list"
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
