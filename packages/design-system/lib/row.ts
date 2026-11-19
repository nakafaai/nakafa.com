import { cva } from "class-variance-authority";

/** A divided list's link. Its text can shrink beside the fixed leading tile and any trailing action. */
export const rowLinkVariants = cva(
  "group hover:bg-accent hover:text-accent-foreground flex min-w-0 items-start gap-3 p-4 transition-colors ease-out"
);

/**
 * The two lines of a list row: its name, and the line under it that says one fact about it, such as who wrote it
 * and when. Both are the page's 14px text, so the fact reads as easily as the name, and the colour carries the
 * hierarchy: the foreground for the name, the muted foreground for the fact. Each keeps one line.
 */
export const rowLineVariants = cva("truncate text-sm", {
  variants: {
    line: {
      fact: "text-muted-foreground",
      name: "",
    },
  },
  defaultVariants: {
    line: "name",
  },
});
