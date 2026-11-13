import { cva } from "class-variance-authority";

/**
 * The game's own frame: warm parchment inside a dark wooden rim with a lighter
 * bevel, drawn square like a pixel panel, never the app's cards.
 */
export const panelVariants = cva(
  "border-3 border-[#4a2c17] bg-[#f3ddb0] text-[#3b2414] shadow-[inset_0_0_0_2px_#d9a868,0_3px_0_#2c1a0d]"
);
