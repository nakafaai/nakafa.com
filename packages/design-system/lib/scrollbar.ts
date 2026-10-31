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
