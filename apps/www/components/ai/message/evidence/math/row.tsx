import { ArrowRight02Icon } from "@hugeicons/core-free-icons";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import type { ReactNode } from "react";

/**
 * One labelled row of math evidence. The label wraps when it must, and a value
 * that does not fit beside it goes to its own line. Several expressions in a
 * value wrap from one to the next, and one that is wider than the column
 * scrolls on its own.
 */
export function Row({
  children,
  label,
}: {
  children: ReactNode;
  label: string;
}) {
  return (
    <div className="flex max-w-full flex-wrap items-center gap-x-2 gap-y-1">
      <span className="flex min-w-0 items-center gap-2 text-muted-foreground">
        <span className="wrap-break-word min-w-0">{label}</span>
        <HugeIcons className="size-3.5 shrink-0" icon={ArrowRight02Icon} />
      </span>
      <div className="flex min-w-0 max-w-full flex-wrap items-center gap-x-2 gap-y-1">
        {children}
      </div>
    </div>
  );
}
