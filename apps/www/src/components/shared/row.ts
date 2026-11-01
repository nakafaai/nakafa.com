import type { MouseEvent } from "react";

/** The elements of a row that do their own thing when pressed, so pressing them opens no row. */
const ROW_CONTROLS =
  "a, button, input, label, select, textarea, [role=menuitem]";

/**
 * Whether a press landed on the row itself: not on a control of its own, and not on a menu or a dialog the row opened,
 * whose press React carries through the row although it stands elsewhere on the page.
 */
export const pressesRow = (
  event: Pick<MouseEvent<HTMLTableRowElement>, "currentTarget" | "target">
) =>
  event.target instanceof Element &&
  event.currentTarget.contains(event.target) &&
  event.target.closest(ROW_CONTROLS) === null;
