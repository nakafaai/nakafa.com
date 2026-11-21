import type { AnyRouter } from "@tanstack/react-router";

/** The class of a later box, the box of a part under the first screen (`LaterSection`). */
const LATER_BOX = "later-section";

/** The attribute on a later box that lays out, which `later-section` reads. */
const LAID_OUT = "data-laid-out";

/**
 * Lays out every later box (`later-section` in globals.css) from the top of a long
 * page down to the one that holds the element `id` names, and lets every other box
 * skip again, so the one scroll to that element lands on real heights with its
 * scroll margin. An empty id, or one the page lacks, lets every box skip.
 *
 * The boxes carry an attribute rather than matching the target with `:has()`:
 * Chrome checks a `:has()` rule on each box at every change of the document and
 * then restyles the whole page, twice in a phone's first second (ADR 0039 D17).
 */
export function layOutDownTo(root: Document, id: string) {
  const target = id === "" ? null : root.querySelector(`#${CSS.escape(id)}`);
  for (const box of root.querySelectorAll(`.${LATER_BOX}`)) {
    const reaches =
      target !== null &&
      (box.contains(target) ||
        box.compareDocumentPosition(target) ===
          Node.DOCUMENT_POSITION_FOLLOWING);
    box.toggleAttribute(LAID_OUT, reaches);
  }
}

/**
 * `layOutDownTo` for a loaded `#part` address, before React takes the page over.
 * It runs at the end of the body, once every box is in the document and before the
 * browser scrolls to the part, which it does once the document has parsed. The
 * browser matches a fragment both as written and decoded, and so does this.
 */
export const LOADED_JUMP_SCRIPT = `(function () {
  var id = location.hash.slice(1);
  try {
    id = decodeURIComponent(id);
  } catch (error) {}
  var target = id === "" ? null : document.querySelector("#" + CSS.escape(id));
  document.querySelectorAll(".${LATER_BOX}").forEach(function (box) {
    var reaches = target !== null && (box.contains(target) || box.compareDocumentPosition(target) === Node.DOCUMENT_POSITION_FOLLOWING);
    box.toggleAttribute("${LAID_OUT}", reaches);
  });
})();`;

/**
 * Owns the jumps to a part of a long page. The router moves by history and scrolls
 * to the hash once the page has rendered (`onRendered`). Each resolved navigation
 * comes first, with the page committed, so laying out the boxes above its target
 * there lands that one scroll right under the header.
 */
export function followHashJumps(router: AnyRouter) {
  return router.subscribe("onResolved", (event) => {
    layOutDownTo(document, event.toLocation.hash);
  });
}
