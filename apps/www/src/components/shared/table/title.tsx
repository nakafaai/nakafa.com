import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import {
  type StatusTone,
  statusIconVariants,
} from "@repo/design-system/lib/status";
import type { ComponentProps, ReactNode } from "react";

/**
 * The cell that names a row, so a list's first column is never bare text: an icon alone, on no background, that says
 * what the row is, in the tone of its state where it has one, before its name. A name that opens the row keeps its link
 * here (`children`), and pressing anywhere else on the row presses that link (`DataTable`). A long name stops at a width
 * of its own, on one line, so it never pushes the row's other columns off the table.
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
    <span className="inline-flex max-w-xs min-w-0 items-center gap-2 font-medium md:max-w-sm lg:max-w-md">
      <HugeIcons className={statusIconVariants({ tone })} icon={icon} />
      <span className="truncate">{children}</span>
    </span>
  );
}
