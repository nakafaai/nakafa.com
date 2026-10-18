import type { Place } from "@repo/design-system/lib/toy/scatter";
import { Option, Schema } from "effect";

/**
 * Where a toy belongs beside one part of the page. `x` and `y` are fractions of
 * the part's box, from its left and top edges, and `dx` and `dy` move the spot
 * by pixels. A toy is only placed between `minWidth` and `maxWidth` wide, so a
 * phone and a desktop each get the room they have.
 */
export const AnchorSchema = Schema.Struct({
  dx: Schema.optionalKey(Schema.Finite),
  dy: Schema.optionalKey(Schema.Finite),
  maxWidth: Schema.optionalKey(Schema.Finite),
  minWidth: Schema.optionalKey(Schema.Finite),
  x: Schema.Finite,
  y: Schema.Finite,
});

/** Where a toy belongs beside one part of the page. */
type Anchor = typeof AnchorSchema.Type;

/**
 * The place of a toy beside the part with the element id `part`. The place reads
 * the live layout, so the toy follows its part when the page changes width, and
 * it has none while the part is not drawn.
 */
export function within(part: string, anchor: Anchor): Place {
  return (width, box) => {
    if (
      width < (anchor.minWidth ?? 0) ||
      width > (anchor.maxWidth ?? Number.POSITIVE_INFINITY)
    ) {
      return Option.none();
    }
    const element = document.getElementById(part);
    if (element === null) {
      return Option.none();
    }
    const rect = box(element);
    // A part the page does not draw at this width, such as one hidden on a
    // phone, has no box, and a toy beside it would land at the page's corner.
    if (rect.width === 0 && rect.height === 0) {
      return Option.none();
    }
    return Option.some({
      x: rect.left + anchor.x * rect.width + (anchor.dx ?? 0),
      y: rect.top + anchor.y * rect.height + (anchor.dy ?? 0),
    });
  };
}
