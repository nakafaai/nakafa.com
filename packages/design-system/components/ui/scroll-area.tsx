"use client";

import { ScrollArea as ScrollAreaPrimitive } from "@base-ui/react/scroll-area";

import { cn } from "cn";
import type { Ref, UIEventHandler } from "react";

/**
 * A scroller whose bars never take room: the viewport hides the native bar, and a thin overlay bar shows on
 * hover and while scrolling. The root is a column and the viewport fills it, so a root that a parent only caps,
 * such as a bottom sheet with a largest height, still scrolls. The viewport is the element that scrolls, so a caller that reads or writes its
 * scroll, observes it, or listens to it reaches it through `viewportRef` and `onViewportScroll`.
 */
function ScrollArea({
  className,
  children,
  onViewportScroll,
  scrollFade = false,
  viewportClassName,
  viewportRef,
  ...props
}: ScrollAreaPrimitive.Root.Props & {
  /** Runs as the viewport scrolls. */
  onViewportScroll?: UIEventHandler<HTMLDivElement>;
  /**
   * Fades the edges where more content is. `true` fades both ends of each
   * axis. `"end"` fades only the far end, for a list that keeps its first row
   * in place, such as a sticky heading that a fade at the start would dim.
   */
  scrollFade?: boolean | "end";
  /** Classes of the scrolling viewport itself, such as a cap on its height. */
  viewportClassName?: string;
  /** The element that scrolls, for a caller that reads, writes or observes its scroll. */
  viewportRef?: Ref<HTMLDivElement>;
}) {
  return (
    <ScrollAreaPrimitive.Root
      className={cn("relative flex size-full min-h-0 flex-col", className)}
      data-slot="scroll-area"
      {...props}
    >
      <ScrollAreaPrimitive.Viewport
        className={cn(
          "min-h-0 flex-1 rounded-[inherit] outline-none transition-shadow focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background data-has-overflow-y:overscroll-y-contain data-has-overflow-x:overscroll-x-contain",
          scrollFade &&
            "mask-b-from-[calc(100%-min(var(--fade-size),var(--scroll-area-overflow-y-end)))] mask-r-from-[calc(100%-min(var(--fade-size),var(--scroll-area-overflow-x-end)))] [--fade-size:1.5rem]",
          scrollFade === true &&
            "mask-t-from-[calc(100%-min(var(--fade-size),var(--scroll-area-overflow-y-start)))] mask-l-from-[calc(100%-min(var(--fade-size),var(--scroll-area-overflow-x-start)))]",
          viewportClassName
        )}
        data-slot="scroll-area-viewport"
        onScroll={onViewportScroll}
        ref={viewportRef}
      >
        {children}
      </ScrollAreaPrimitive.Viewport>
      <ScrollBar />
      <ScrollBar orientation="horizontal" />
      <ScrollAreaPrimitive.Corner />
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
      className={cn(
        "m-1 flex touch-none select-none opacity-0 transition-opacity delay-300 data-[orientation=horizontal]:h-1.5 data-[orientation=vertical]:w-1.5 data-[orientation=horizontal]:flex-col data-hovering:opacity-100 data-scrolling:opacity-100 data-hovering:delay-0 data-scrolling:delay-0 data-hovering:duration-100 data-scrolling:duration-100",
        className
      )}
      data-orientation={orientation}
      data-slot="scroll-area-scrollbar"
      orientation={orientation}
      {...props}
    >
      <ScrollAreaPrimitive.Thumb
        className="relative flex-1 rounded-full bg-muted-foreground"
        data-slot="scroll-area-thumb"
      />
    </ScrollAreaPrimitive.Scrollbar>
  );
}

export { ScrollArea, ScrollBar };
