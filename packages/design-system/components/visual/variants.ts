import { cva } from "class-variance-authority";

/**
 * Off-screen cards skip rendering, and both full screen presentations fill
 * the screen. The browser's top layer places and sizes a Fullscreen API
 * element. The immersive card covers the dynamic viewport itself: in the top
 * layer where the browser has popovers, and above the page's own sticky bars
 * where it does not. Presentation classes come last, so a card's own classes
 * never undo them.
 *
 * The card is never a scroll anchor. WebKit can anchor the page to content
 * inside the card while it sits in the page, and keeps following that anchor
 * once the card fills the screen, so the page behind scrolls whenever a chart
 * or scene in the card resizes.
 */
export const visualCardVariants = cva(
  "group/visual content-auto-card @container/visual [overflow-anchor:none]",
  {
    compoundVariants: [
      // The screen-filling surface that both full screen presentations share.
      // The card's own margins stay with its slot in the page, and its bands
      // keep their spacing inside the safe area.
      {
        className:
          "m-0 overflow-y-auto overscroll-contain rounded-none pt-[env(safe-area-inset-top,0px)] pr-[env(safe-area-inset-right,0px)] pb-[env(safe-area-inset-bottom,0px)] pl-[env(safe-area-inset-left,0px)] shadow-none ring-0",
        presentation: ["fullscreen", "immersive"],
      },
    ],
    variants: {
      presentation: {
        fullscreen: "",
        immersive: "fixed inset-0 z-60 h-dvh w-auto border-0",
        inline: "",
      },
    },
  }
);

/**
 * The bands of a visual card, top to bottom: the header, an optional toolbar,
 * the body that holds only the visual, optional actions, and the footer with
 * what the visual shows. A line divides each band from the one above it, and
 * every band keeps the card's inset, so every visual reads the same way.
 */
export const visualBandVariants = cva(
  "border-t px-(--card-spacing) group-data-fullscreen/visual:shrink-0 first:border-t-0",
  {
    variants: {
      kind: {
        // Rows of controls or buttons: as tall as a button and its breath.
        controls: "flex flex-wrap items-center gap-2 py-3",
        // The visual's own controls: a choice made of joined buttons spans the
        // band, its options sharing the width, as the grid-column groups do.
        toolbar:
          "flex flex-wrap items-center gap-2 py-3 [&>[data-slot=button-group]]:w-full [&>[data-slot=button-group]>*]:flex-1 [&>[data-slot=toggle-group]]:w-full [&>[data-slot=toggle-group]:not([data-grid-columns]):not([data-orientation=vertical])>*]:flex-1",
        // Text: the card's own spacing above and below.
        text: "flex flex-col gap-3 py-(--card-spacing) text-sm",
      },
    },
  }
);

/**
 * The body holds the visual alone, edge to edge. In full screen the body of the
 * card takes the free height and drops its aspect ratio, and size containment
 * keeps a chart's own aspect ratio from claiming more than the screen has. The
 * body is then a column, so a chart or a scene that grows into the free space
 * fills it, or keeps its minimum while the card scrolls. A body laid out as a
 * grid says so for full screen too (`[[data-fullscreen]>&]:grid`). A body inside
 * another body, such as a scene loaded into its frame, fills that body and adds
 * no line.
 */
export const visualBodyVariants = cva(
  "relative border-t first:border-t-0 [[data-fullscreen]>&]:flex [[data-fullscreen]>&]:aspect-auto [[data-fullscreen]>&]:min-h-64 [[data-fullscreen]>&]:flex-1 [[data-fullscreen]>&]:flex-col [[data-fullscreen]>&]:contain-size [[data-slot=visual-card-body]>&]:size-full [[data-slot=visual-card-body]>&]:border-t-0"
);
