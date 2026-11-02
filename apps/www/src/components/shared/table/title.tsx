import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import {
  type StatusTone,
  statusIconVariants,
} from "@repo/design-system/lib/status";
import type { ComponentProps, ReactNode } from "react";

/**
 * A name in a table, whose words wrap inside the width its column has, so the longest name a school holds reads whole.
 * The first column's width comes from the table, never from its rows (`TableLead`, `headWidth`).
 */
export function TableName({ children }: { children: ReactNode }) {
  return (
    <span
      className="block min-w-0 font-medium wrap-break-word whitespace-normal"
      dir="auto"
    >
      {children}
    </span>
  );
}

/**
 * The cell that names a row, so a list's first column is never bare text: an icon alone, on no background, that says
 * what the row is, in the tone of its state where it has one, before its name. A name that opens the row keeps its link
 * here (`children`), and pressing anywhere else on the row presses that link (`DataTable`).
 */
export function TableTitle({
  children,
  icon,
  tone = "neutral",
}: {
  children: ReactNode;
  /** What the row is, the same icon for every row of the list. */
  icon: ComponentProps<typeof HugeIcons>["icon"];
  /** The tone of the row's state, for a row whose state the list shows. */
  tone?: typeof StatusTone.Type;
}) {
  return (
    <span className="flex min-w-0 items-center gap-2 font-medium">
      <HugeIcons
        className={statusIconVariants({ className: "size-4", tone })}
        icon={icon}
      />
      <TableName>{children}</TableName>
    </span>
  );
}
