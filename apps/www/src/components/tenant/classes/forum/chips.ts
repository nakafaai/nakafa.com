import { cva } from "class-variance-authority";

/** One emoji of a message and its count, on the secondary surface when the viewer gave it. */
export const reactionChip = cva("gap-1.5 rounded-full px-3 tabular-nums", {
  variants: {
    mine: {
      false: "bg-muted/60 border-transparent",
      true: "border-border bg-accent text-accent-foreground",
    },
  },
});

/**
 * A document of a message: one width for every document, so a column of them lines up, with the same inset on all
 * four sides, its name breaking anywhere, and the whole card one press.
 */
export const documentCard = cva(
  "w-72 max-w-full gap-3 rounded-xl has-data-[slot=attachment-content]:p-3 has-data-[slot=attachment-media]:p-3"
);
