import { Schema } from "effect";

/** The space in pixels between the line that holds the query and the slash menu beside it. */
export const MENU_GAP = 8;

/** The tallest the slash menu draws in pixels, which is its `max-h-72` height. */
export const MENU_MAX_HEIGHT = 288;

/**
 * Where the slash menu's fixed box sits: `top` when the menu hangs under the query, `bottom` when it
 * stands over the query, and `null` on the side it does not use.
 */
const MenuPlacement = Schema.Struct({
  bottom: Schema.NullOr(Schema.Finite),
  top: Schema.NullOr(Schema.Finite),
});

/**
 * Where the slash menu sits in the window. It hangs under the query when its tallest height fits
 * below the query, and stands over the query otherwise, so a query near the bottom of the window
 * keeps every block in view.
 */
export function menuPlacement(
  query: Pick<DOMRect, "bottom" | "top">,
  windowHeight: number
): typeof MenuPlacement.Type {
  if (query.bottom + MENU_GAP + MENU_MAX_HEIGHT <= windowHeight) {
    return { bottom: null, top: query.bottom + MENU_GAP };
  }
  return { bottom: windowHeight - query.top + MENU_GAP, top: null };
}
