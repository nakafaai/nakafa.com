import type { MouseEvent } from "react";

/**
 * The elements of a row that do their own thing when pressed, so pressing them opens no row. A popup the row opened,
 * such as its menu or the dialog that menu opens, renders inside the row in the top layer (`[popover]`), so every press
 * in it reaches the row too.
 */
const ROW_CONTROLS =
  "a, button, input, label, select, textarea, [role=menuitem], [popover]";

/**
 * Whether a press landed on the row itself: not on a control of its own, and not in a popup the row opened, which
 * stands inside the row or, drawn by a portal, elsewhere on the page while React carries its press through the row.
 */
export const pressesRow = (
  event: Pick<MouseEvent<HTMLTableRowElement>, "currentTarget" | "target">
) =>
  event.target instanceof Element &&
  event.currentTarget.contains(event.target) &&
  event.target.closest(ROW_CONTROLS) === null;
