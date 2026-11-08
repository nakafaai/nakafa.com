import { cva } from "class-variance-authority";

/**
 * The toolbar of a message: one bordered row of square buttons floating over the message's top corner on the bubble's
 * inner side, the end for another member's message and the start for the viewer's own. It shows on the row's hover
 * or focus, which a tap gives on a touch screen, and stays while one of its popups is open. On a touch screen it takes
 * no press while out of sight, so a tap on a message never hits a button it cannot see. With no button to show it draws
 * nothing.
 */
export const messageToolbarVariants = cva(
  "bg-popover text-popover-foreground absolute top-1 z-10 flex items-center gap-0.5 rounded-lg border p-0.5 opacity-0 shadow-xs transition-opacity group-focus-within/row:opacity-100 group-hover/row:opacity-100 empty:hidden has-data-popup-open:opacity-100 motion-reduce:transition-none pointer-coarse:pointer-events-none pointer-coarse:group-focus-within/row:pointer-events-auto pointer-coarse:has-data-popup-open:pointer-events-auto",
  { variants: { mine: { false: "end-2", true: "start-2" } } }
);
