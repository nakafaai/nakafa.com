"use client";

import { ScrollArea as ScrollAreaPrimitive } from "@base-ui/react/scroll-area";
import {
  scrollThumbVariants,
  scrollTrackVariants,
} from "@repo/design-system/lib/scrollbar";
import { cn } from "cn";
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
}: ScrollAreaPrimitive.Root.Props & {
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
    <ScrollAreaPrimitive.Root
      className={cn("relative flex size-full min-h-0 flex-col", className)}
      data-slot="scroll-area"
      {...props}
    >
      <ScrollAreaPrimitive.Viewport
        className={cn(
          "focus-visible:ring-ring focus-visible:ring-offset-background min-h-0 flex-1 rounded-[inherit] transition-shadow outline-none focus-visible:ring-2 focus-visible:ring-offset-1 data-has-overflow-x:overscroll-x-contain data-has-overflow-y:overscroll-y-contain",
          scrollFade &&
            "mask-r-from-[calc(100%-min(var(--fade-size),var(--scroll-area-overflow-x-end)))] mask-b-from-[calc(100%-min(var(--fade-size),var(--scroll-area-overflow-y-end)))] [--fade-size:1.5rem]",
          scrollFade === true &&
            "mask-t-from-[calc(100%-min(var(--fade-size),var(--scroll-area-overflow-y-start)))] mask-l-from-[calc(100%-min(var(--fade-size),var(--scroll-area-overflow-x-start)))]",
          axis === "vertical" && "overflow-x-hidden!",
          viewportClassName
        )}
        data-slot="scroll-area-viewport"
        onScroll={onViewportScroll}
        ref={viewportRef}
      >
        {children}
      </ScrollAreaPrimitive.Viewport>
      <ScrollBar />
      {axis === "both" ? (
        <>
          <ScrollBar orientation="horizontal" />
          <ScrollAreaPrimitive.Corner />
        </>
      ) : null}
    </ScrollAreaPrimitive.Root>
  );
}

function ScrollBar({
  className,
  orientation = "vertical",
  ...props
}: ScrollAreaPrimitive.Scrollbar.Props) {
  return (
    <ScrollAreaPrimitive.Scrollbar
      className={cn(scrollTrackVariants({ orientation }), className)}
      data-orientation={orientation}
      data-slot="scroll-area-scrollbar"
      orientation={orientation}
      {...props}
    >
      <ScrollAreaPrimitive.Thumb
        className={scrollThumbVariants({ orientation })}
        data-slot="scroll-area-thumb"
      />
    </ScrollAreaPrimitive.Scrollbar>
  );
}

export { ScrollArea, ScrollBar };
