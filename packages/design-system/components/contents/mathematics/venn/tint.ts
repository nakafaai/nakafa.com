import {
  MAT,
  type Place,
  regionAt,
} from "@repo/design-system/components/contents/mathematics/venn/layout";
import {
  selects,
  type VennOperation,
} from "@repo/design-system/components/contents/mathematics/venn/sets";

/** How many pixels the tint image has across the mat's width, about 5 mm each. */
export const TINT_WIDTH = 360;

/** How many pixels the tint image has across the mat's depth. */
export const TINT_DEPTH = Math.round((TINT_WIDTH * MAT.depth) / MAT.width);

/** Where each pixel is tested, as fractions of the pixel, so the region's edges come out smooth. */
const SAMPLES = [0.25, 0.75] as const;

/**
 * The tint of an operation's region, as the opacity of each pixel of an
 * image laid over the mat, four bytes a pixel: a grey whose brightness is
 * the opacity, as an alpha map reads it, and a solid fourth byte. Row 0 is
 * the mat's front edge, as a texture's first row lies at
 * the bottom of a plane turned to face up. Each pixel is tested at four
 * points, so a pixel the hoop's edge crosses is partly tinted.
 */
export function tintImage(
  operation: VennOperation,
  centres: readonly Place[]
): Uint8ClampedArray<ArrayBuffer> {
  const image = new Uint8ClampedArray(TINT_WIDTH * TINT_DEPTH * 4);
  for (let row = 0; row < TINT_DEPTH; row += 1) {
    for (let column = 0; column < TINT_WIDTH; column += 1) {
      let covered = 0;
      for (const down of SAMPLES) {
        for (const across of SAMPLES) {
          const place = {
            x: ((column + across) / TINT_WIDTH - 0.5) * MAT.width,
            z: (0.5 - (row + down) / TINT_DEPTH) * MAT.depth,
          };
          covered += Number(selects(operation, regionAt(place, centres)));
        }
      }
      const at = (row * TINT_WIDTH + column) * 4;
      const opacity = (covered / (SAMPLES.length * SAMPLES.length)) * 255;
      image[at] = opacity;
      image[at + 1] = opacity;
      image[at + 2] = opacity;
      image[at + 3] = 255;
    }
  }
  return image;
}
