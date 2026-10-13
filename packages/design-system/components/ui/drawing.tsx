import { attributesOf } from "@repo/design-system/lib/attribute";
import type { Shape } from "@repo/mascot/shape";
import { Array as Arr } from "effect";
import { createElement, type ReactElement, type SVGAttributes } from "react";

/** What a mark adds to its element: any SVG attribute, and any `data-` attribute. */
export type MarkAttributes = SVGAttributes<SVGElement> &
  Record<`data-${string}`, string>;

/**
 * One shape of a picture as its SVG element, and a group with its shapes
 * inside. It is the only place where a picture of the identity becomes an
 * element with React: an animal, Nina, and each of her things are drawn through
 * it. `attributesOf` says which fields of a shape are attributes, and the same
 * module tells her life how to write them without React.
 *
 * `marked` gives the attributes of a shape that carries a mark, such as the
 * class of an eye, the motion of a thing, or the `data-` name of a limb. The
 * shapes of a group are passed as arguments and never as a list, so a picture
 * needs no keys.
 */
export function Drawing<Mark>({
  marked,
  shape,
}: {
  marked: (mark: Mark) => MarkAttributes;
  shape: Shape<Mark>;
}): ReactElement {
  const attributes = {
    ...attributesOf(shape),
    ...(shape.mark === undefined ? undefined : marked(shape.mark)),
  };
  if (shape._tag === "g") {
    return createElement(
      shape._tag,
      attributes,
      ...Arr.map(shape.children, (child) =>
        createElement(Drawing<Mark>, { marked, shape: child })
      )
    );
  }
  return createElement(shape._tag, attributes);
}
