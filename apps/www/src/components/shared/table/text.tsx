import type { ReactNode } from "react";

/**
 * A long value in a table, such as an address or a competency: one line up to the width a usual value reads in, and more
 * lines past that, so the longest one a school holds reads whole and never pushes the columns after it out of view.
 */
export function TableText({ children }: { children: ReactNode }) {
  return (
    <span
      className="block max-w-64 min-w-48 wrap-anywhere whitespace-normal"
      dir="auto"
    >
      {children}
    </span>
  );
}
