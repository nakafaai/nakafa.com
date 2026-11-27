import { valueNoise } from "@repo/design-system/components/contents/simulation/grain";

/**
 * The swirl of a hand-gathered glass marble as a tileable field: ribbons of
 * white glass twisted through the coloured glass while it was still molten,
 * so they wind round the marble from pole to pole. Each value says how much
 * white glass shows at that texel, from 0, the marble's own colour, to 1, a
 * ribbon's middle. One field swirls every colour of marble.
 */

/** How many ribbons wind round a marble, and how many turns each makes from pole to pole. */
const RIBBONS = 3;
const TURNS = 0.75;

/** How far the molten glass dragged the ribbons out of true, as a share of a ribbon's spacing. */
const DRAG = 0.22;

/** The part of the wave a ribbon fills: above `edge` white glass starts, at `core` it is solid. */
const RIBBON = { core: 0.93, edge: 0.7 } as const;

/** How many patches of noise drag the ribbons, round and along the marble. */
const PATCHES = 4;

/**
 * How much white glass shows at each texel of a `width` by `height` field,
 * row by row: the width runs once round the marble and the height from one
 * pole to the other.
 */
export function swirlShares(width: number, height: number) {
  const field = new Float32Array(width * height);
  for (let row = 0; row < height; row += 1) {
    const along = row / height;
    for (let column = 0; column < width; column += 1) {
      const round = column / width;
      const drag = valueNoise(round * PATCHES, along * PATCHES, PATCHES) - 0.5;
      const wave = Math.sin(
        2 * Math.PI * (RIBBONS * round + TURNS * along + DRAG * drag)
      );
      const share = (wave - RIBBON.edge) / (RIBBON.core - RIBBON.edge);
      const clamped = Math.min(1, Math.max(0, share));
      field[row * width + column] = clamped * clamped * (3 - 2 * clamped);
    }
  }
  return field;
}
