import { cva } from "class-variance-authority";

/**
 * The one surface of the game's HUD (ADR 0050, W7): a flat panel in the
 * theme's card tone with one radius and a hairline, which takes presses while
 * the layer around it lets them fall through to the world.
 */
export const panelVariants = cva(
  "bg-card text-card-foreground pointer-events-auto rounded-xl border shadow-xs"
);
