import type { ReactNode } from "react";

/**
 * The body of a student's sitting screen under its bar, in the paper's own column: the screen's cards in one
 * stack, with long words breaking so nothing is cut at a card's edge.
 */
export function SittingBody({ children }: { readonly children: ReactNode }) {
  return (
    <div className="grid gap-6 wrap-anywhere" data-slot="sitting-body">
      {children}
    </div>
  );
}
