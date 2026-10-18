import { cva } from "class-variance-authority";

/**
 * The classes of a paragraph in a published article, whose lines stop at about 75
 * characters. The editor of a question's prompt draws its paragraphs with the same
 * classes, so a question reads the same in both.
 */
export const paragraphVariants = cva(
  "my-4 max-w-xl text-pretty tabular-nums leading-relaxed first:mt-0 last:mb-0"
);
