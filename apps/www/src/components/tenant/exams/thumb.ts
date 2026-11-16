import { cva } from "class-variance-authority";

/**
 * The frame of a page thumbnail in the strip, one width at every screen width. It holds the page's picture and,
 * laid over it, the one button that opens the page (`thumbPress`): the picture draws the question's own controls,
 * and a control may not stand inside a button, so the frame takes its hover, focus and current looks from the
 * button it holds.
 */
export const pageThumb = cva(
  "bg-muted/40 hover:border-foreground/20 has-[:focus-visible]:ring-ring/50 has-[[aria-current=true]]:border-primary has-[[aria-current=true]]:ring-primary relative block aspect-4/3 w-32 shrink-0 overflow-hidden rounded-lg border has-[:focus-visible]:ring-3 has-[[aria-current=true]]:ring-2"
);

/** The button laid over a thumbnail's picture, which opens its page. The frame draws its looks. */
export const thumbPress = cva("absolute inset-0 outline-none");
