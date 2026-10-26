import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@repo/design-system/components/ui/empty";
import type { ActSchema } from "@repo/mascot/nina/act";
import type { ReactNode } from "react";
import { EmptyNina } from "@/components/state/empty";

/**
 * A table that sits inside a part of a page, as shadcn draws one: a rounded border
 * around the table, with every row and its border running the full width inside it.
 * Each cell keeps its words on one line, and a table wider than the frame scrolls inside
 * it, so a narrow screen never breaks a name in the middle of a word. A table that is
 * the whole body of its page is a `DataTable`, which runs from edge to edge instead.
 */
export function TableFrame({ children }: { children: ReactNode }) {
  return (
    <div className="overflow-hidden rounded-xl border bg-card [&_[data-slot=table-cell]]:whitespace-nowrap">
      {children}
    </div>
  );
}

/**
 * The body of a page whose body is one list, under the page's header: the page's gutter, bounded to the
 * app's page width, and one card that fills the rest of the page's height, drawn as the try-out catalog
 * draws its lists. The data table fills the card, its rows divided and running the card's width, and so
 * does the empty state in its place; a table taller than the card scrolls inside it with its column heads
 * in view.
 */
export function TablePageBody({ children }: { children: ReactNode }) {
  return (
    <div
      className="mx-auto flex min-h-0 w-full max-w-7xl flex-1 flex-col p-4"
      data-slot="table-page-body"
    >
      <div
        className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border bg-card text-card-foreground shadow-sm"
        data-slot="table-card"
      >
        {children}
      </div>
    </div>
  );
}

/**
 * The body of a list that holds no record yet: what the list will hold, in one
 * sentence, with Nina doing what fits the list, in the middle of the body in place of
 * column heads over nothing. The page's action that adds the first record sits in the
 * page header.
 */
export function TableEmpty({
  action,
  description,
  title,
  ...nina
}: {
  /** What Nina does in the empty state, chosen for the list. */
  act: typeof ActSchema.Type;
  /** The way on that fixes the empty state, when the list has one, such as a link to the page that adds the first record. */
  action?: ReactNode;
  description: string;
  title: string;
}) {
  return (
    <Empty className="flex-1 md:p-10">
      <EmptyHeader>
        <EmptyNina {...nina} />
        <EmptyTitle className="text-base">{title}</EmptyTitle>
        <EmptyDescription>{description}</EmptyDescription>
      </EmptyHeader>
      {action === undefined ? null : <EmptyContent>{action}</EmptyContent>}
    </Empty>
  );
}
