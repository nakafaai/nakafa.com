import { cva } from "class-variance-authority";

/** The frame of a page thumbnail in the strip, one width at every screen width. */
export const pageThumb = cva(
  "bg-muted/40 hover:border-foreground/20 focus-visible:ring-ring/50 aria-[current=true]:border-primary aria-[current=true]:ring-primary relative block aspect-4/3 w-32 shrink-0 overflow-hidden rounded-lg border outline-none focus-visible:ring-3 aria-[current=true]:ring-2"
);
