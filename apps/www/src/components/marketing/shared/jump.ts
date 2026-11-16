import type { AnyRouter } from "@tanstack/react-router";
import { Option } from "effect";

/** The attribute on the element a navigation jumps to, which `later-section` reads. */
const JUMP = "data-jump";

/**
 * Marks the element that a navigation's hash names, and only that one, so the
 * boxes of a long page lay out down to it (`later-section` in globals.css). A
 * navigation without a hash marks nothing.
 */
export function markJump(root: ParentNode, hash: string) {
  for (const marked of root.querySelectorAll(`[${JUMP}]`)) {
    marked.removeAttribute(JUMP);
  }
  if (hash === "") {
    return;
  }
  Option.map(
    Option.fromNullishOr(root.querySelector(`#${CSS.escape(hash)}`)),
    (target) => target.setAttribute(JUMP, "")
  );
}

/**
 * Owns the jumps to a part of a long page. The router moves by history, so the
 * browser's `:target` never follows a navigation to a hash, and the router scrolls
 * to the hash once the page has rendered (`onRendered`). Each resolved navigation
 * comes first, with the page committed, so marking its target there lays out the
 * boxes above it before that one scroll, which then lands the part right under the
 * header. A loaded `#part` address needs nothing here: the browser's own `:target`
 * does the same before it scrolls.
 */
export function followHashJumps(router: AnyRouter) {
  return router.subscribe("onResolved", (event) => {
    markJump(document, event.toLocation.hash);
  });
}
