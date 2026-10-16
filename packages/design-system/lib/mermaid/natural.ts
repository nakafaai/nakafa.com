import { Option, Schema } from "effect";

/** The four numbers of an SVG viewBox: the x and y of its origin, then its width and height. */
const ViewBox = Schema.Tuple([
  Schema.FiniteFromString,
  Schema.FiniteFromString,
  Schema.FiniteFromString,
  Schema.FiniteFromString,
]);
const decodeViewBox = Schema.decodeUnknownOption(ViewBox);
const VIEW_BOX_SEPARATOR = /[\s,]+/;

/** Reads the width and height that a viewBox names, or nothing when it is not four numbers. */
function viewBoxSize(viewBox: string | null | undefined) {
  return Option.map(
    decodeViewBox((viewBox ?? "").trim().split(VIEW_BOX_SEPARATOR)),
    ([, , width, height]) => ({ height, width })
  );
}

/**
 * Gives a Mermaid SVG its natural size: its viewBox in CSS pixels, so one unit
 * of the diagram is one pixel of the page. Mermaid writes a width of 100
 * percent and a maximum width instead, which fits the diagram to its column and
 * never grows it past its own width. The markup is read as HTML, the way the
 * page reads it, and written back the same way.
 */
export function naturalSizeSvg(svg: string) {
  const root = new DOMParser().parseFromString(svg, "text/html").body
    .firstElementChild;
  const size = viewBoxSize(root?.getAttribute("viewBox"));

  if (!(root && Option.isSome(size))) {
    return svg;
  }

  root.setAttribute("width", String(size.value.width));
  root.setAttribute("height", String(size.value.height));
  // Mermaid writes nothing else into the style of the root but its maximum width.
  root.removeAttribute("style");
  return root.outerHTML;
}
