import { cva } from "class-variance-authority";

/**
 * The page's one width, which its header, its tab row and its body all read, so they cannot disagree: the column of
 * articles, lessons and settings, or the app's page width of a working surface. A frame around the page sets it
 * (`PageFrame`), and the root's value, the page width, is the widest any page may be.
 */
export const pageFrameVariants = cva("contents", {
  variants: {
    width: {
      column: "[--page-width:var(--container-3xl)]",
      page: "[--page-width:var(--container-7xl)]",
    },
  },
});

/** A box as wide as the page's frame, centred, for what draws its own gutter inside, such as two panes. */
export const pageBoxVariants = cva("mx-auto w-full max-w-(--page-width)");

/** One row of a page, its header's, its tab row's or its body's: the page's width and gutter, centred. */
export const pageRowVariants = cva(
  "mx-auto w-full max-w-(--page-width) px-4 sm:px-6"
);

/** A readable measure inside a wider page, such as the questions beside a navigator or the messages of a chat. */
export const readingMeasureVariants = cva("mx-auto w-full max-w-3xl");
