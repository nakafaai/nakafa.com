import { cva } from "class-variance-authority";

/**
 * The circle of an answer sheet: a radio or a check box that holds its option's letter, so the row beside it
 * holds the answer alone. A chosen circle fills and keeps its letter, a radio and a check box draw the same,
 * and a paper that can no longer be changed keeps its letters readable.
 */
export const letterBubble = cva(
  "bg-background text-foreground dark:bg-input/32 data-checked:border-primary data-checked:bg-primary data-checked:text-primary-foreground dark:data-checked:bg-primary inline-flex size-6 items-center justify-center rounded-full text-sm leading-none font-medium data-disabled:opacity-100"
);
