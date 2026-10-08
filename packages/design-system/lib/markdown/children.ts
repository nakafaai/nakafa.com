import { Array as Arr } from "effect";
import { Children, type ReactNode } from "react";

/** Removes whitespace-only text nodes that would destabilize MDX hydration. */
export function filterWhitespaceNodes(children: ReactNode) {
  return Arr.filter(
    Children.toArray(children),
    (child) => !(typeof child === "string" && child.trim() === "")
  );
}
