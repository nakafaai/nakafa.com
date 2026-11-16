import { ATLAS_SIZE, ATLAS_TILES } from "@/lib/island/atlas";
import { LOOK } from "@/lib/island/look";
import { TILE } from "@/lib/island/tiles/paint";

/**
 * The color of what flies off a block when the learner places or digs it
 * (ADR 0047, D38): the mean of the opaque pixels of the block's side tile in
 * the painted atlas, as linear RGB from 0 to 1, so a dug block throws chips of
 * its own color and the season's paint is kept.
 */
export function dustOf(pixels: Uint8ClampedArray, block: number) {
  const slot = LOOK.sides[block];
  const left = (slot % ATLAS_TILES) * TILE;
  const top = Math.floor(slot / ATLAS_TILES) * TILE;
  let red = 0;
  let green = 0;
  let blue = 0;
  let count = 0;
  for (let row = 0; row < TILE; row += 1) {
    for (let column = 0; column < TILE; column += 1) {
      const at = ((top + row) * ATLAS_SIZE + left + column) * 4;
      if (pixels[at + 3] > 127) {
        red += pixels[at];
        green += pixels[at + 1];
        blue += pixels[at + 2];
        count += 1;
      }
    }
  }
  if (count === 0) {
    return [0.8, 0.78, 0.72] as const;
  }
  return [red / count / 255, green / count / 255, blue / count / 255] as const;
}
