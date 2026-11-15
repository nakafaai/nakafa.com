import { cva } from "class-variance-authority";

/**
 * The toolbar of a message: one `ButtonGroup` of small square buttons floating across the row's top edge on the bubble's
 * inner side, the end for another member's message and the start for the viewer's own, as Slack and Discord hang
 * theirs. Half of it stands in the room above the row, so it never covers the message's file, photo or first line: a
 * row that opens a run keeps it wholly beside the author's name. It shows on the row's hover
 * or focus, which a tap gives on a touch screen, and stays while one of its popups is open. On a touch screen it takes
 * no press while out of sight, so a tap on a message never hits a button it cannot see. With no button to show it draws
 * nothing.
 */
export const messageToolbarVariants = cva(
  "absolute -top-4 z-10 rounded-md opacity-0 shadow-xs transition-opacity group-focus-within/row:opacity-100 group-hover/row:opacity-100 empty:hidden has-data-popup-open:opacity-100 motion-reduce:transition-none pointer-coarse:pointer-events-none pointer-coarse:group-focus-within/row:pointer-events-auto pointer-coarse:has-data-popup-open:pointer-events-auto",
  { variants: { mine: { false: "end-2", true: "start-2" } } }
);
