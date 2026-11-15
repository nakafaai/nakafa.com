import { cva } from "class-variance-authority";

/**
 * The page's one width, which its header, its tab row, its body and its footer all read, so they cannot disagree: the
 * column of articles, lessons and settings, or the app's page width of a working surface. The page (`Page`) sets it,
 * and the root's value, the page width, is the widest any page may be. The page fills the height its shell leaves and
 * never grows past the width beside the sidebar.
 */
export const pageFrameVariants = cva(
  "flex min-h-0 w-full min-w-0 flex-1 flex-col",
  {
    defaultVariants: { height: "content", width: "page" },
    variants: {
      /** A page as tall as its content, or as tall as the screen under the shell's bar, which a list fills and scrolls inside. */
      height: {
        content: "",
        screen:
          "h-[calc(100svh-var(--app-header-top,4rem))] overflow-clip lg:h-svh",
      },
      width: {
        column: "[--page-width:var(--container-3xl)]",
        page: "[--page-width:var(--container-7xl)]",
      },
    },
  }
);

/** A box as wide as the page's frame, centred, for what draws its own gutter inside, such as two panes. */
export const pageBoxVariants = cva("mx-auto w-full max-w-(--page-width)");

/**
 * The page's gutter, which draws the line every column of a page starts on: the header's first letter, the first
 * tab, a rail's search and rows, and a table's card. The right edge mirrors it.
 */
export const pageGutterVariants = cva("px-4 sm:px-6");

/** One row of a page, its header's, its tab row's or its body's: the page's width and gutter, centred. */
export const pageRowVariants = cva(
  `mx-auto w-full max-w-(--page-width) ${pageGutterVariants()}`
);

/**
 * A page header's row, which every header of the app and of School reads: its gap keeps the sidebar's button a full
 * gutter step from the path after it, so the two never read as one control. The row names the `header` container that
 * its controls fold by.
 */
export const pageHeaderRowVariants = cva(
  `${pageRowVariants()} @container/header flex min-w-0 items-center gap-4`
);

/** A readable measure inside a wider page, such as the questions beside a navigator or the messages of a chat. */
export const readingMeasureVariants = cva("mx-auto w-full max-w-3xl");
