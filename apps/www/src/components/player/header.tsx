import type { ReactNode } from "react";
import { BreadcrumbHeaderFrame } from "@/components/shared/breadcrumb/frame";

/**
 * Keeps back, the title, the timer, and the one primary action in a single row
 * that is as wide as the questions and the navigator beside them.
 */
export function PlayerHeader({ children }: { children: ReactNode }) {
  return (
    <BreadcrumbHeaderFrame contentClassName="gap-2 lg:max-w-5xl">
      {children}
    </BreadcrumbHeaderFrame>
  );
}

/** The page heading; a long title is cut short so the header stays one row. */
export function PlayerTitle({ children }: { children: string }) {
  return (
    <h1
      className="min-w-0 flex-1 truncate font-medium text-base"
      title={children}
    >
      {children}
    </h1>
  );
}
