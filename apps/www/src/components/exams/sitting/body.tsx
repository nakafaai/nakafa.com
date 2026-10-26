import type { ReactNode } from "react";

/**
 * The body of a student's sitting screen under its bar: the page's whole width and the rest of
 * its height, with the screen's card or sentence centred at a readable width, so the frame fills
 * the page and the words never stretch across it.
 */
export function SittingBody({ children }: { children: ReactNode }) {
  return (
    <div className="flex w-full min-w-0 flex-1 flex-col items-center justify-center p-6">
      <div className="grid w-full max-w-2xl gap-6">{children}</div>
    </div>
  );
}
