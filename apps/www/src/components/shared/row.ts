import type { MouseEvent, PointerEvent } from "react";
import { useRef } from "react";

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

/**
 * The press that opens a row, as the row's `onPointerDown` and `onClick`. A click opens the row only when its press
 * began on the row too. A press that begins on a control and ends elsewhere, such as on the sheet that a menu raises
 * over its trigger as the pointer goes down, reaches the row as a click on the nearest element both ends share, often
 * the row's cell, and that click is the control's. A click with no press before it, such as one an assistive technology
 * sends, opens the row when it lands on the row.
 */
export function useRowPress(open: (row: HTMLTableRowElement) => void) {
  const began = useRef<boolean>(undefined);

  return {
    onClick: (event: MouseEvent<HTMLTableRowElement>) => {
      const fromRow = began.current ?? true;
      began.current = undefined;
      if (fromRow && pressesRow(event)) {
        open(event.currentTarget);
      }
    },
    onPointerDown: (event: PointerEvent<HTMLTableRowElement>) => {
      began.current = pressesRow(event);
    },
  };
}
