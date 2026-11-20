import { cva } from "class-variance-authority";

/**
 * Every row a reader chooses from a list, in a select, a picker or the command palette alike: the row under the pointer
 * or the keys takes the accent, an unavailable row fades, and a row whose action runs reads as waiting until it ends. A
 * row on a phone's sheet stands taller, for a thumb. A choice keeps room on its end for the tick of the chosen one, and
 * a row of the command palette stands as tall as a thumb on every screen, since it is the palette's whole content.
 */
export const optionRowVariants = cva(
  "data-highlighted:bg-accent data-highlighted:text-accent-foreground relative flex w-full items-center gap-2 rounded-sm text-sm outline-hidden select-none data-disabled:pointer-events-none data-disabled:opacity-50 data-pending:cursor-progress data-pending:opacity-70 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='opacity-'])]:opacity-80 [&_svg:not([class*='size-'])]:size-4 [[data-presentation=sheet]_&]:text-base",
  {
    defaultVariants: { mark: "none", size: "default" },
    variants: {
      mark: { none: "", tick: "pe-8" },
      size: {
        default:
          "min-h-8 px-2 py-1.5 [[data-presentation=sheet]_&]:min-h-11 [[data-presentation=sheet]_&]:py-3",
        roomy: "min-h-11 px-3 py-3",
      },
    },
  }
);

/** The tick on the end of the chosen row, which stands in the room `optionRowVariants` keeps for it. */
export const optionTickVariants = cva(
  "pointer-events-none absolute end-2 flex items-center justify-center"
);
