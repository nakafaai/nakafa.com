import type { ReactNode } from "react";

/**
 * One part of the world pane (the owner's home notes, 14 Nov): its title and
 * at most one action on one line, then what it holds, always the same gap
 * under the title. A line across the whole pane parts it from the next one,
 * so the world, the medals and the leaderboard each read as their own concern.
 */
export function PaneSection({
  action,
  children,
  title,
}: {
  /** The one action of the part, at the end of its title's line. */
  action?: ReactNode;
  children: ReactNode;
  title: string;
}) {
  return (
    <section className="-mx-(--pane-end,1rem) flex flex-col gap-3 border-b px-(--pane-end,1rem) py-4 first:pt-0 last:border-b-0 last:pb-0">
      <div className="flex h-8 items-center justify-between gap-3">
        <h3 className="truncate text-sm font-medium">{title}</h3>
        {action}
      </div>
      {children}
    </section>
  );
}
