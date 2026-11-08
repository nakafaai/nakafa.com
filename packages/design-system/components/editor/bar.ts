import { cva } from "class-variance-authority";

/*
 * The bars of an editor's controls: the toolbar above the text, and the bar an object of the document
 * carries beside it, such as a table's or a picture's. Each class string lives here and nowhere else.
 */

/** The line that sets one group of controls off from the next, in the toolbar and in an object's bar. */
export const barLine = cva("bg-border h-5 w-px shrink-0", {
  defaultVariants: { space: false },
  variants: { space: { false: "", true: "mx-0.5" } },
});

/**
 * The bar of an object of the document, such as a table, which floats beside the object over the text:
 * the popover's surface, one row of the toolbar's controls, and above the text it covers.
 */
export const objectBar = cva(
  "bg-popover text-popover-foreground z-10 flex items-center gap-0.5 rounded-md border p-1 shadow-md"
);
