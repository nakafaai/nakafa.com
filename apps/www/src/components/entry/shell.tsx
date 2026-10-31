import { ScrollArea } from "@repo/design-system/components/ui/scroll-area";
import type { ReactNode } from "react";

/** Reuses the authenticated entry-page split layout across auth and onboarding. */
export function EntryShell({ children }: { children: ReactNode }) {
  return (
    <main className="relative grid min-h-svh lg:h-svh lg:grid-cols-7">
      {children}
    </main>
  );
}

/**
 * Owns the interactive side of an entry page. It scrolls when it must, but its spacing is set so a
 * question with its choices fits a laptop's screen, and nobody has to scroll to answer.
 */
export function EntryShellPanel({ children }: { children: ReactNode }) {
  return (
    <ScrollArea className="col-span-3 lg:min-h-0">
      <div className="flex min-h-svh flex-col gap-4 p-6 sm:px-12 sm:py-8 lg:min-h-full">
        {children}
      </div>
    </ScrollArea>
  );
}

/** Aligns entry-page navigation and preference actions. */
export function EntryShellHeader({ children }: { children: ReactNode }) {
  return <div className="flex items-center justify-between">{children}</div>;
}

/** Centers the primary entry action inside the left panel. */
export function EntryShellBody({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-5">
      {children}
    </div>
  );
}
