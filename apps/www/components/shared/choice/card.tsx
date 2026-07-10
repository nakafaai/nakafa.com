import { cva } from "class-variance-authority";
import type { ReactNode } from "react";

/** Shared selectable or linked card surface used by learning choice grids. */
export const choiceCardVariants = cva(
  "flex h-full w-full cursor-pointer flex-col justify-between overflow-hidden rounded-xl border bg-card text-left shadow-sm transition-colors ease-out hover:border-primary/50 hover:bg-[color-mix(in_oklch,var(--primary)_1%,var(--background))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
  {
    variants: {
      selected: {
        false: "",
        true: "border-primary/60 bg-[color-mix(in_oklch,var(--primary)_2%,var(--background))] ring-1 ring-primary/20",
      },
    },
    defaultVariants: {
      selected: false,
    },
  }
);

/** Keeps choice-card labels aligned with one symmetric content inset. */
export function ChoiceCardContent({ children }: { children: ReactNode }) {
  return <div className="px-6 py-4 text-center">{children}</div>;
}
