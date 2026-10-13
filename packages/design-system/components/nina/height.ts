import { pictureHeight } from "@repo/design-system/lib/picture";
import { WHOLE_BOX } from "@repo/mascot/nina/box";

/**
 * The height Nina takes when she is whole, at a width in pixels: a little
 * taller than wide, in the window her whole figure is drawn in. A page that
 * reserves her place before she is drawn asks for it, so she moves nothing when
 * she arrives. It reads only her window and not her outlines, so a page can ask
 * without loading her.
 */
export function wholeHeight(width: number) {
  return pictureHeight(width, WHOLE_BOX);
}
