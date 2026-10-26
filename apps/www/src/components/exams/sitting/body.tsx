import { cva, type VariantProps } from "class-variance-authority";
import type { ReactNode } from "react";

/**
 * The body of a sitting screen: the page's width up to the app's cap, with long words breaking
 * so nothing is cut at the card's edge. A screen that waits on one step stands in the middle of
 * the body; the results screen starts at its top, as other school pages do.
 */
const sittingBodyVariants = cva(
  "wrap-anywhere mx-auto flex w-full min-w-0 max-w-7xl flex-1 flex-col items-center p-6",
  {
    defaultVariants: { align: "center" },
    variants: { align: { center: "justify-center", top: "justify-start" } },
  }
);

/**
 * The body of a student's sitting screen under its bar: the rest of the page's height, with the
 * screen's card or sentence at a readable width, so the frame fills the page and the words never
 * stretch across it.
 */
export function SittingBody({
  align,
  children,
}: VariantProps<typeof sittingBodyVariants> & { children: ReactNode }) {
  return (
    <div className={sittingBodyVariants({ align })} data-slot="sitting-body">
      <div className="grid w-full max-w-2xl gap-6">{children}</div>
    </div>
  );
}
