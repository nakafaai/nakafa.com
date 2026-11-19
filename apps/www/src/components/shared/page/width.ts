import { cva } from "class-variance-authority";

/**
 * The page's frame and its body's width. Every page's header row, tab row and frame stand at the one page width, so
 * the sidebar's button and the path stand at the same place on every page and a press between pages moves nothing.
 * A page's body reads its width from the page (`Page`): the full frame for a working surface, or the reading column
 * (3xl) for a lesson, an article, the Quran and a settings page, starting on the header's first letter. The page
 * fills the height its shell leaves and never grows past the width beside the sidebar.
 */
export const pageFrameVariants = cva("flex min-h-0 w-full min-w-0 flex-col", {
  defaultVariants: { height: "content", width: "page" },
  variants: {
    /** A page as tall as its content, or as tall as the screen under the shell's bar, which a list fills and scrolls inside. */
    height: {
      content: "flex-1",
      screen:
        "h-[calc(100svh-var(--app-header-top,4rem))] flex-none overflow-clip lg:h-svh",
    },
    /** How wide the page's body reads: the whole frame, or the reading column under the frame's header. */
    width: {
      column: "[--body-width:var(--container-3xl)]",
      page: "",
    },
  },
});

/** A box as wide as the page's frame, centred, for what draws its own gutter inside, such as two panes. */
export const pageBoxVariants = cva("mx-auto w-full max-w-(--page-width)");

/**
 * The page's gutter, which draws the line every column of a page starts on: the header's first letter, the first
 * tab, a rail's search and rows, and a table's card. The right edge mirrors it.
 */
export const pageGutterVariants = cva("px-4 sm:px-6");

/**
 * The page's one rhythm: the room between its header, or the tab row under it, and its body's first block, and the
 * same room under the body's last block. Every body reads it, a stack of sections, a list's card, a state or a grid of
 * cards, so no two pages of a family start their body at a different height and a press between them moves nothing.
 */
export const pageRhythmVariants = cva("py-6");

/** The space from a list's view switcher to the content it changes. */
export const pageViewSpacingVariants = cva("gap-3");

/** One row of a page's frame, its header's or its tab row's, or a working surface's: the page's width and gutter, centred. */
export const pageRowVariants = cva(
  `mx-auto w-full max-w-(--page-width) ${pageGutterVariants()}`
);

/**
 * One row of a page's body: it starts on the frame's first letter, its margin on each side the room the frame leaves
 * beside it, and it reads as wide as the page lets its body (`--body-width`), the reading column or, unset, the whole
 * frame. A row as wide as its parent is a block whose width is its parent's less those margins, so it never needs a
 * wrapper: the frame's row and the body's row share one start edge, in either direction of writing.
 */
export const pageBodyVariants = cva(
  `mx-[max(0px,calc((100%_-_var(--page-width))/2))] max-w-[var(--body-width,none)] min-w-0 ${pageGutterVariants()}`
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
