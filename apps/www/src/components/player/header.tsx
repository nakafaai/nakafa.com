import type { ReactNode } from "react";
import { BreadcrumbHeaderFrame } from "@/components/shared/breadcrumb/frame";

/**
 * Keeps the player's header in one row across the app's width (`max-w-7xl`),
 * in three zones: back and the title at the start, the timer in the centre, and
 * the one primary action at the end. The start and the end share the space left
 * by the timer, so the timer stays centred whatever the title says, and the end
 * keeps its place when a header has no timer.
 */
export function PlayerHeader({ children }: { children: ReactNode }) {
  return (
    <BreadcrumbHeaderFrame contentClassName="grid max-w-7xl grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] gap-2">
      {children}
    </BreadcrumbHeaderFrame>
  );
}

/** The start of the header: the way back and the title. */
export function PlayerHeaderStart({ children }: { children: ReactNode }) {
  return <div className="flex min-w-0 items-center gap-2">{children}</div>;
}

/** The end of the header, in the last zone whether or not a timer is beside it: the one primary action. */
export function PlayerHeaderEnd({ children }: { children: ReactNode }) {
  return <div className="col-start-3 flex justify-end">{children}</div>;
}

/**
 * The page heading. A long title is cut short so the header stays one row, and
 * its direction follows its own script, so a title in Arabic reads right to
 * left beside the interface's own direction.
 */
export function PlayerTitle({ children }: { children: string }) {
  return (
    <h1
      className="min-w-0 flex-1 truncate font-medium text-base"
      dir="auto"
      title={children}
    >
      {children}
    </h1>
  );
}
