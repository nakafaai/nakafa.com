import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@repo/design-system/components/ui/empty";
import type { ReactNode } from "react";

/**
 * A data table as shadcn draws one: a rounded border around the table, with every row
 * and its border running the full width inside it. A list of records lives here, never
 * inside a card, so no row is cut short by a card's padding.
 */
export function TableFrame({ children }: { children: ReactNode }) {
  return (
    <div className="overflow-hidden rounded-xl border bg-card">{children}</div>
  );
}

/**
 * The frame of a data table that holds no row yet: what the list will hold, in one
 * sentence, with its icon, in place of column heads over nothing. The page's action that
 * adds the first record sits in the page header.
 */
export function TableEmpty({
  description,
  icon,
  title,
}: {
  description: string;
  /** The list's icon, drawn in the empty state's tile. */
  icon: ReactNode;
  title: string;
}) {
  return (
    <TableFrame>
      <Empty className="md:p-10">
        <EmptyHeader>
          <EmptyMedia variant="icon">{icon}</EmptyMedia>
          <EmptyTitle className="text-base">{title}</EmptyTitle>
          <EmptyDescription>{description}</EmptyDescription>
        </EmptyHeader>
      </Empty>
    </TableFrame>
  );
}
