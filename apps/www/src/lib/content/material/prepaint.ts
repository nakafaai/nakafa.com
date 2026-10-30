/** The attribute that the root element carries while a lesson's placement is not yet known. */
export const PLACEMENT_PENDING_ATTRIBUTE = "data-placement";

/**
 * Marks the root element before the first paint when the address carries a
 * curriculum hint (`?ctx=program~node`), so a lesson keeps its breadcrumb path
 * hidden in its row until the browser knows the placement. The static page
 * cannot see the query, and without the mark it would paint the lesson's own
 * path first and swap it when the placement arrives.
 */
export const PLACEMENT_PREPAINT_SCRIPT = `(function () {
  try {
    var hint = new URLSearchParams(window.location.search).get("ctx");
    if (hint && /^[^~]+~[^~]+$/.test(hint)) {
      document.documentElement.setAttribute("${PLACEMENT_PENDING_ATTRIBUTE}", "pending");
    }
  } catch (error) {}
})();`;

/** Shows the lesson's breadcrumb path: its placement is known, or the lesson has left the page. */
export function settlePlacementPaint() {
  document.documentElement.removeAttribute(PLACEMENT_PENDING_ATTRIBUTE);
}
