/**
 * Registers the overflow properties of Base UI's scroll area from the head of the
 * page. Base UI registers them when its first scroll area mounts, and registering
 * a property restyles the whole document, so on a slow phone that one call held
 * the main thread during hydration. Here the document has no elements yet, and
 * Base UI's own call finds them registered and moves on. WebKit is left out, as
 * Base UI leaves it out, because `inherit` fails there on a property that does not
 * inherit.
 */
export const SCROLL_AREA_PROPERTIES_SCRIPT = `(function () {
  if (typeof CSS === "undefined" || !CSS.registerProperty || CSS.supports("-webkit-backdrop-filter:none")) {
    return;
  }
  ["x-start", "x-end", "y-start", "y-end"].forEach(function (edge) {
    try {
      CSS.registerProperty({ name: "--scroll-area-overflow-" + edge, syntax: "<length>", inherits: false, initialValue: "0px" });
    } catch (error) {}
  });
})();`;
