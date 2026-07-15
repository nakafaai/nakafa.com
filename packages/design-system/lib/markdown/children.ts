import { Children, type ReactNode } from "react";

/** Removes whitespace-only text nodes that would destabilize MDX hydration. */
export function filterWhitespaceNodes(children: ReactNode) {
  return Children.toArray(children).filter(
    (child) => !(typeof child === "string" && child.trim() === "")
  );
}
