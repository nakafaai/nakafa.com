import { cva } from "class-variance-authority";

/**
 * The pane docked at the screen's right, which steps aside below the width its page gives it. Its header, body and
 * footer keep the inset a page's panes give them, wherever the pane stands, so every pane reads alike. `PaneSide`
 * draws it, and a page that holds the pane's place before it arrives draws the same box.
 */
export const paneSideVariants = cva(
  "bg-background fixed inset-y-0 end-0 z-30 flex w-(--pane-width) flex-col border-s [--pane-end:1.5rem]",
  {
    variants: {
      from: {
        lg: "max-lg:hidden",
        md: "max-md:hidden",
        xl: "max-xl:hidden",
      },
    },
  }
);
