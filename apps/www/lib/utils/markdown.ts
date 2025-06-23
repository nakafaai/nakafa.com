import type { ReactNode } from "react";
import { Children } from "react";

/**
 * Filters whitespace text nodes from the given children to prevent hydration errors.
 * @param children - The children to filter.
 * @returns The filtered children.
 */
export function filterWhitespaceNodes(children: ReactNode) {
  return Children.toArray(children).filter(
    (child) => !(typeof child === "string" && child.trim() === "")
  );
}
