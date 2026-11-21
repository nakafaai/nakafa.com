"use client";

import {
  scrollFadeVariants,
  scrollThumbVariants,
  scrollTrackVariants,
} from "@repo/design-system/lib/scrollbar";
import {
  ScrollAreaContent,
  ScrollAreaCorner,
  ScrollArea as ScrollAreaPrimitive,
  ScrollAreaScrollbar,
  ScrollAreaThumb,
  ScrollAreaViewport,
} from "@ui-sdk/react/scroll-area";
import { cn } from "cn";
import type * as React from "react";
import type { Ref, UIEventHandler } from "react";

/**
 * A scroller whose bars never take room: the viewport hides the native bar, and a thin overlay bar shows on
 * hover and while scrolling. The root is a column and the viewport fills it, so a root that a parent only caps,
 * such as a bottom sheet with a largest height, still scrolls. The viewport is the element that scrolls, so a caller that reads or writes its
 * scroll, observes it, or listens to it reaches it through `viewportRef` and `onViewportScroll`. A scroller of rows
 * that only ever scrolls down, such as a sidebar, sets `axis` to `"vertical"`: it draws no bar across and never moves
 * sideways.
 */
function ScrollArea({
  axis = "both",
  className,
  children,
  onViewportScroll,
  scrollFade = false,
  viewportClassName,
  viewportRef,
  ...props
}: React.ComponentProps<typeof ScrollAreaPrimitive> & {
  /** The directions the viewport scrolls in. */
  axis?: "both" | "vertical";
  /** Runs as the viewport scrolls. */
  onViewportScroll?: UIEventHandler<HTMLDivElement> | undefined;
  /**
   * Fades the edges where more content is. `true` fades both ends of each
   * axis. `"end"` fades only the far end, for a list that keeps its first row
   * in place, such as a sticky heading that a fade at the start would dim.
   */
  scrollFade?: boolean | "end";
  /** Classes of the scrolling viewport itself, such as a cap on its height. */
  viewportClassName?: string;
  /** The element that scrolls, for a caller that reads, writes or observes its scroll. */
  viewportRef?: Ref<HTMLDivElement> | undefined;
}) {
  return (
    <ScrollAreaPrimitive
      className={cn("flex size-full min-h-0 flex-col", className)}
      {...props}
    >
      <ScrollAreaViewport
        className={cn(
          "focus-visible:ring-ring focus-visible:ring-offset-background min-h-0 flex-1 overscroll-contain rounded-[inherit] transition-shadow outline-none focus-visible:ring-2 focus-visible:ring-offset-1",
          scrollFade && scrollFadeVariants({ start: scrollFade === true }),
          axis === "vertical" && "overflow-x-hidden!",
          viewportClassName
        )}
        onScroll={onViewportScroll}
        ref={viewportRef}
      >
        <ScrollAreaContent>{children}</ScrollAreaContent>
      </ScrollAreaViewport>
      <ScrollBar />
      {axis === "both" ? (
        <>
          <ScrollBar orientation="horizontal" />
          <ScrollAreaCorner />
        </>
      ) : null}
    </ScrollAreaPrimitive>
  );
}

function ScrollBar({
  className,
  orientation = "vertical",
  ...props
}: React.ComponentProps<typeof ScrollAreaScrollbar>) {
  return (
    <ScrollAreaScrollbar
      className={cn(scrollTrackVariants({ orientation }), className)}
      orientation={orientation}
      {...props}
    >
      <ScrollAreaThumb className={scrollThumbVariants({ orientation })} />
    </ScrollAreaScrollbar>
  );
}

export { ScrollArea, ScrollBar };
