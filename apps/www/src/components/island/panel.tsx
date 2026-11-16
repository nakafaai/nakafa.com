import { cva } from "class-variance-authority";

/**
 * The game's own frame: warm parchment inside a dark wooden rim with a lighter
 * bevel, drawn square like a pixel panel, never the app's cards.
 */
export const panelVariants = cva(
  "border-island-wood-dark bg-island-parchment text-island-bark border-3 shadow-[inset_0_0_0_2px_var(--color-island-bevel),0_3px_0_var(--color-island-shadow)]"
);
