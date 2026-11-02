import type { ReactNode } from "react";

/**
 * A long value in a table, such as an address or a competency: one line up to the width a usual value reads in, and more
 * lines past that, so the longest one a school holds reads whole and never pushes the columns after it out of view.
 */
export function TableText({ children }: { children: ReactNode }) {
  return (
    <span
      className="block max-w-64 min-w-56 wrap-anywhere whitespace-normal"
      dir="auto"
    >
      {children}
    </span>
  );
}

/**
 * A known value in a table, such as a status, a role or a unit's name: its words wrap inside the width its column holds,
 * a badge's too, so the longest one a school holds never moves the column heads when its rows arrive.
 */
export function TableValue({ children }: { children: ReactNode }) {
  return (
    <span
      className="block whitespace-normal [&_[data-slot=badge]]:h-auto [&_[data-slot=badge]]:whitespace-normal"
      dir="auto"
    >
      {children}
    </span>
  );
}
