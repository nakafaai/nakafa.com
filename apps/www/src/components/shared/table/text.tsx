import { Array as Arr } from "effect";
import type { PointerEvent, ReactNode } from "react";

/**
 * Shows the whole of a cell's words on hover once a line cuts them: the cell itself, or a badge's name inside it. The
 * title is read at the hover, so a cell whose words fit carries none and the rows draw no title they do not need.
 */
function showWhole(event: PointerEvent<HTMLElement>) {
  const box = event.currentTarget;
  const cut = Arr.some(
    [box, ...box.querySelectorAll<HTMLElement>(".truncate")],
    (part) => part.scrollWidth > part.clientWidth
  );
  box.title = cut ? box.textContent.trim() : "";
}

/**
 * A long value in a later column of text, such as an address or a competency: one line in the width its column holds,
 * cut with an ellipsis past it and whole on hover, so a row never grows past one line and never moves a head.
 */
export function TableText({ children }: { children: ReactNode }) {
  return (
    <span
      className="block w-0 min-w-full truncate"
      dir="auto"
      onPointerEnter={showWhole}
    >
      {children}
    </span>
  );
}

/**
 * A known value in a table, such as a status, a role or a unit's name: one line in the width its column holds. A badge
 * keeps its one compact size and cuts its name inside that width, whole on hover, so a long state never grows a bubble.
 */
export function TableValue({ children }: { children: ReactNode }) {
  return (
    <span
      className="block w-0 min-w-full whitespace-nowrap [&_[data-slot=badge]]:max-w-full"
      dir="auto"
      onPointerEnter={showWhole}
    >
      {children}
    </span>
  );
}

/**
 * What the first column of text holds: it takes the width the column has and adds none, so the column keeps its floor
 * and whatever the others leave, a long name ends in an ellipsis on its one line and reads whole on hover, and the
 * heads stand where the first frame drew them.
 */
export function TableLead({ children }: { children: ReactNode }) {
  return (
    <span className="block w-0 min-w-full truncate" onPointerEnter={showWhole}>
      {children}
    </span>
  );
}
