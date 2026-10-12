import type { Shape } from "@repo/mascot/shape";
import { Array as Arr } from "effect";
import { createElement, type ReactElement, type SVGAttributes } from "react";

/**
 * One shape of a picture as its SVG element, and a group with its shapes
 * inside. It is the only place where a picture of the identity becomes SVG: an
 * animal, Nina, and each of her things are drawn through it.
 *
 * `marked` gives the attributes of a shape that carries a mark, such as the
 * class of an eye or the motion of a thing. The shapes of a group are passed
 * as arguments and never as a list, so a picture needs no keys, and an element
 * keeps its place while its numbers change from one frame to the next.
 */
export function Drawing<Mark>({
  marked,
  shape,
}: {
  marked: (mark: Mark) => SVGAttributes<SVGElement>;
  shape: Shape<Mark>;
}): ReactElement {
  const attributes = shape.mark === undefined ? undefined : marked(shape.mark);

  if (shape._tag === "g") {
    const { _tag, children, mark, ...paint } = shape;
    return createElement(
      _tag,
      { ...paint, ...attributes },
      ...Arr.map(children, (child) =>
        createElement(Drawing<Mark>, { marked, shape: child })
      )
    );
  }

  const { _tag, mark, ...drawn } = shape;
  return createElement(_tag, { ...drawn, ...attributes });
}
