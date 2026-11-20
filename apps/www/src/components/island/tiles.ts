import { cva } from "class-variance-authority";

/**
 * The shape every control of the HUD shares (ADR 0050, W7): 44 px high, its
 * icon over its label, filled with the text's own tone while it is pressed.
 * `soft` stands on a quiet ground, as a tab or a brush does.
 */
export const tileVariants = cva(
  "aria-pressed:bg-foreground aria-pressed:text-background aria-pressed:hover:bg-foreground aria-pressed:hover:text-background aria-pressed:hover:[&_svg]:text-background h-11 min-w-0 flex-col gap-0.5 px-0.5 py-0 text-xs leading-4 font-medium has-[>svg]:px-0.5",
  {
    defaultVariants: { ground: "clear" },
    variants: { ground: { clear: "", soft: "bg-muted" } },
  }
);
