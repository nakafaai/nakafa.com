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
      <span className="text-muted-foreground flex min-w-0 items-center gap-2">
        <span className="min-w-0 wrap-break-word">{label}</span>
        <HugeIcons className="size-4 shrink-0" icon={ArrowRight02Icon} />
      </span>
      <div className="flex max-w-full min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
        {children}
      </div>
    </div>
  );
}
