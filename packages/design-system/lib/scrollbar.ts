import { cva } from "class-variance-authority";

/**
 * The overlay bar of every scroller, the page's and each ScrollArea's. Its track is as wide as a pointer needs to
 * take the thumb, and shows on hover and while its scroller moves, without a fade where motion is reduced.
 */
export const scrollTrackVariants = cva(
  "group/scrollbar flex touch-none opacity-0 transition-opacity delay-300 select-none hover:opacity-100 hover:delay-0 hover:duration-100 data-hovering:opacity-100 data-hovering:delay-0 data-hovering:duration-100 data-scrolling:opacity-100 data-scrolling:delay-0 data-scrolling:duration-100 motion-reduce:transition-none",
  {
    variants: {
      orientation: {
        horizontal: "h-2.5 flex-col",
        vertical: "w-2.5",
      },
    },
  }
);

/**
 * The thumb inside a track. The element fills the track across, so a press anywhere on its band takes it, and it
 * draws a thin, quiet line at the track's outer edge that grows and darkens while the pointer is on the track.
 */
export const scrollThumbVariants = cva(
  "before:bg-foreground/20 group-hover/scrollbar:before:bg-foreground/40 group-active/scrollbar:before:bg-foreground/40 relative flex-1 before:absolute before:rounded-full before:transition-[width,height,background-color] before:duration-100 motion-reduce:before:transition-none",
  {
    variants: {
      orientation: {
        horizontal:
          "before:inset-x-0.5 before:bottom-0.5 before:h-1 group-hover/scrollbar:before:h-1.5",
        vertical:
          "before:inset-y-0.5 before:end-0.5 before:w-1 group-hover/scrollbar:before:w-1.5",
      },
    },
  }
);

/**
 * The fade at an edge of a scroller where more content is, which says the scroller moves: it grows from nothing with
 * the distance left to scroll, up to `--fade-size`, so a scroller at its end shows a whole edge. It reads the overflow
 * that Base UI's scroll viewport measures, so it stands on that viewport. `start` also fades the near edges, for a
 * scroller whose first row is not kept in place.
 */
export const scrollFadeVariants = cva(
  "mask-r-from-[calc(100%-min(var(--fade-size),var(--scroll-area-overflow-x-end)))] mask-b-from-[calc(100%-min(var(--fade-size),var(--scroll-area-overflow-y-end)))] [--fade-size:1.5rem]",
  {
    variants: {
      start: {
        false: "",
        true: "mask-t-from-[calc(100%-min(var(--fade-size),var(--scroll-area-overflow-y-start)))] mask-l-from-[calc(100%-min(var(--fade-size),var(--scroll-area-overflow-x-start)))]",
      },
    },
  }
);
