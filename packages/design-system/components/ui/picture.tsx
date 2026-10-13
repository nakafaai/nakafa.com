import {
  Drawing,
  type MarkAttributes,
} from "@repo/design-system/components/ui/drawing";
import { type Box, pictureHeight } from "@repo/design-system/lib/picture";
import type { Shape } from "@repo/mascot/shape";
import { Array as Arr } from "effect";
import { type ComponentProps, createElement } from "react";

type PictureProps<Mark> = Omit<
  ComponentProps<"svg">,
  | "aria-hidden"
  | "aria-label"
  | "children"
  | "height"
  | "role"
  | "viewBox"
  | "width"
> & {
  /** The window on the picture. */
  box: Box;
  /**
   * What a screen reader says. Left out or empty, the picture only decorates
   * what is already said, and a screen reader skips it.
   */
  label?: string;
  /** What each mark of a shape adds to its element. */
  marked: (mark: Mark) => MarkAttributes;
  /** What it is drawn from, in the order it is drawn. */
  shapes: readonly Shape<Mark>[];
  /** Its width in pixels, and its height in the proportion of the window. Left out, the page's styles size it. */
  size?: number | undefined;
};

/**
 * A picture of the identity: the one `svg` that an animal, Nina and each of her
 * things are drawn in, with its window, its size and its accessible name. Every
 * other attribute is the svg's own: a class, a `ref`, a `data-` name.
 */
export function Picture<Mark>({
  box,
  label = "",
  marked,
  shapes,
  size,
  ...props
}: PictureProps<Mark>) {
  const named = label !== "";
  return createElement(
    "svg",
    {
      ...props,
      "aria-hidden": named ? undefined : true,
      "aria-label": named ? label : undefined,
      height: size === undefined ? undefined : pictureHeight(size, box),
      role: named ? "img" : undefined,
      viewBox: `${box[0]} ${box[1]} ${box[2]} ${box[3]}`,
      width: size,
    },
    ...Arr.map(shapes, (shape) =>
      createElement(Drawing<Mark>, { marked, shape })
    )
  );
}
