import { cva } from "class-variance-authority";

/**
 * A message's action button: with a mouse it shows on the message's hover or focus, and while its menu or popover is
 * open; a touch screen always shows it.
 */
export const messageActionVariants = cva(
  "shrink-0 pointer-fine:opacity-0 pointer-fine:group-focus-within/row:opacity-100 pointer-fine:group-hover/row:opacity-100 pointer-fine:data-popup-open:opacity-100"
);
