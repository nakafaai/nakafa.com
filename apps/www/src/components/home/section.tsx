import { Card } from "@repo/design-system/components/ui/card";
import type { ReactNode } from "react";

/**
 * One section of the home (the owner's home notes, 14 Nov): a card whose
 * header holds its title and at most one action, and whose body holds its
 * rows. Title and rows share the card's own inset, so a ruler down the
 * title's first letter meets the first thing of every row.
 */
export function HomeSection({
  action,
  children,
  title,
}: {
  /** The one action of the section, at the header's end. */
  action?: ReactNode;
  children: ReactNode;
  title: string;
}) {
  return (
    <Card className="gap-0 py-0" size="sm">
      <header className="flex h-12 items-center justify-between gap-3 border-b ps-4 pe-2">
        <h2 className="truncate text-sm font-medium">{title}</h2>
        {action}
      </header>
      <div className="flex flex-col divide-y">{children}</div>
    </Card>
  );
}
