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

/** Reads the width and height that a viewBox names, or nothing when it is not four numbers. */
function viewBoxSize(viewBox: string | null | undefined) {
  return Option.map(
    decodeViewBox((viewBox ?? "").trim().split(VIEW_BOX_SEPARATOR)),
    ([, , width, height]) => ({ height, width })
  );
}

/**
 * Sizes a Mermaid SVG for its box, which is a size container. Without a scale
 * it opens fitted to the box: its width and height are its viewBox in CSS
 * pixels, so it never grows past its natural size, and its maximum width and
 * height are the box's, in container units, which resolve however the box got
 * its height, so it shrinks until the whole diagram shows, however wide or tall
 * it is. The viewBox keeps the drawing's proportions inside that box. With a
 * scale, which a reader zooms to, it is drawn at that multiple of its natural
 * size and pans in its box. Mermaid writes a width of 100 percent and a maximum
 * width instead, which fits the width alone, so a tall diagram runs past the
 * box. The markup is read as HTML, the way the page reads it, and written back
 * the same way.
 */
export function sizeSvg(svg: string, scale?: number) {
  const root = new DOMParser().parseFromString(svg, "text/html").body
    .firstElementChild;
  const size = viewBoxSize(root?.getAttribute("viewBox"));

  if (!(root && Option.isSome(size))) {
    return svg;
  }

  const { height, width } = size.value;
  const multiple = scale ?? 1;
  root.setAttribute("width", String(width * multiple));
  root.setAttribute("height", String(height * multiple));
  if (scale === undefined) {
    // Mermaid writes nothing else into the style of the root but its maximum width.
    root.setAttribute("style", "max-width: 100cqw; max-height: 100cqh;");
  } else {
    root.removeAttribute("style");
  }
  return root.outerHTML;
}
