import { elementById } from "@repo/design-system/lib/element";
import {
  MISSING,
  type Place,
  placed,
  WAITING,
} from "@repo/design-system/lib/toy/scatter";
import { Schema } from "effect";

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
 * Whether the browser skips drawing what a part holds, as it does for a part with `content-visibility: auto` far
 * from the screen: such a part stands at the height it holds for it, not at its own, until the reader nears it. A
 * browser without `checkVisibility` draws every part.
 */
function skipped(element: Element) {
  const inside = element.firstElementChild ?? element;
  return (
    "checkVisibility" in inside &&
    !inside.checkVisibility({ contentVisibilityAuto: true })
  );
}

/**
 * The place of a toy beside the part with the element id `part`. The place reads
 * the live layout, so the toy follows its part when the page changes width, and
 * it has none while the part is not drawn. While the browser skips drawing the
 * part, its size is not its own yet, so the toy waits instead of standing where
 * the part will not be once the reader comes near.
 */
export function within(part: string, anchor: Anchor): Place {
  return (width, box) => {
    if (
      width < (anchor.minWidth ?? 0) ||
      width > (anchor.maxWidth ?? Number.POSITIVE_INFINITY)
    ) {
      return MISSING;
    }
    const element = elementById(part);
    if (element === null) {
      return MISSING;
    }
    if (skipped(element)) {
      return WAITING;
    }
    const rect = box(element);
    // A part the page does not draw at this width, such as one hidden on a
    // phone, has no box, and a toy beside it would land at the page's corner.
    if (rect.width === 0 && rect.height === 0) {
      return MISSING;
    }
    return placed({
      x: rect.left + anchor.x * rect.width + (anchor.dx ?? 0),
      y: rect.top + anchor.y * rect.height + (anchor.dy ?? 0),
    });
  };
}
