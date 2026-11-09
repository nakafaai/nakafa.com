import { Option, Schema } from "effect";

/** The four numbers of an SVG viewBox: the x and y of its origin, then its width and height. */
const ViewBox = Schema.Tuple([
  Schema.FiniteFromString,
  Schema.FiniteFromString,
  Schema.FiniteFromString,
  Schema.FiniteFromString,
]);
const decodeViewBox = Schema.decodeUnknownOption(ViewBox);
const VIEW_BOX_SEPARATOR = /[\s,]+/u;

/**
 * The smallest scale a diagram is drawn at. Mermaid writes its labels at 16
 * pixels, so a label never reads smaller than 12 pixels.
 */
const LEGIBLE_SCALE = 0.75;

/** Reads the width and height that a viewBox names, or nothing when it is not four numbers. */
function viewBoxSize(viewBox: string | null | undefined) {
  return Option.map(
    decodeViewBox((viewBox ?? "").trim().split(VIEW_BOX_SEPARATOR)),
    ([, , width, height]) => ({ height, width })
  );
}

/**
 * Sizes a Mermaid SVG to fit its box without ever turning illegible. Its width
 * and height are its viewBox in CSS pixels, so it never grows past its natural
 * size; it shrinks to fit the box's width and height; and it never shrinks
 * below `LEGIBLE_SCALE`, where a larger diagram overflows its box, which then
 * scrolls. Mermaid writes a width of 100 percent and a maximum width instead,
 * which shrinks a wide diagram until its labels cannot be read. The markup is
 * read as HTML, the way the page reads it, and written back the same way.
 */
export function legibleSvg(svg: string) {
  const root = new DOMParser().parseFromString(svg, "text/html").body
    .firstElementChild;
  const size = viewBoxSize(root?.getAttribute("viewBox"));

  if (!(root && Option.isSome(size))) {
    return svg;
  }

  const { height, width } = size.value;
  root.setAttribute("width", String(width));
  root.setAttribute("height", String(height));
  // Mermaid writes nothing else into the style of the root but its maximum
  // width. A minimum wins over a maximum, so the floor holds in a small box.
  root.setAttribute(
    "style",
    `max-width: 100%; max-height: 100%; min-width: ${width * LEGIBLE_SCALE}px; min-height: ${height * LEGIBLE_SCALE}px;`
  );
  return root.outerHTML;
}
