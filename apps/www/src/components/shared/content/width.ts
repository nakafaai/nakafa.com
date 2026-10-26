import { cva } from "class-variance-authority";

/**
 * The two widths of a page's content, centred: the column of articles, lessons and settings (their
 * cards and their tables alike), and the app's page width of a working surface, such as a home, a
 * class, or the tables of exams, rooms and results. No page's content is unbounded.
 */
export const contentWidthVariants = cva("mx-auto", {
  defaultVariants: { width: "column" },
  variants: {
    width: {
      column: "max-w-3xl",
      page: "max-w-7xl",
    },
  },
});
