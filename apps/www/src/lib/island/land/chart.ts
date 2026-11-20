import { Array as Arr } from "effect";
import { CHUNK, placeOf } from "@/lib/island/land/chunk";
import type { Land } from "@/lib/island/land/ground";
import { pointOf, SEA } from "@/lib/island/land/relief";

/** A color as red, green and blue from 0 to 255. */
type Ink = readonly [number, number, number];

/** The inks of the chart: the sea from its shoals to its deep, fresh water, the beach, open grass, a meadow, forest, a cliff's line, and what the learner built. */
const INK = {
  beach: [234, 217, 168],
  built: [240, 96, 72],
  cliff: [112, 108, 116],
  deep: [38, 92, 150],
  forest: [58, 128, 84],
  fresh: [86, 170, 214],
  grass: [112, 176, 92],
  meadow: [150, 198, 104],
  sea: [70, 134, 190],
  shoal: [128, 196, 208],
} as const;

/** How much lighter each terrace above the first is drawn, so the highland reads as higher. */
const RISE = 0.07;

/** The height between two neighbouring samples from which the chart draws a cliff's line, in blocks. */
const CLIFF = 2.5;

/** The ink of one sampled place of the land. */
function inkOf(point: ReturnType<typeof pointOf>): Ink {
  const deep = point.surface - point.height;
  if (deep > 0) {
    if (point.surface > SEA + 0.02) {
      return INK.fresh;
    }
    if (deep < 1.2) {
      return INK.shoal;
    }
    return deep < 4 ? INK.sea : INK.deep;
  }
  if (point.sand > 0.5) {
    return INK.beach;
  }
  if (point.forest > 0.55) {
    return INK.forest;
  }
  return point.meadow > 0.5 ? INK.meadow : INK.grass;
}

/**
 * The chart of the land about a place (ADR 0050, W7): `side` by `side`
 * pixels over `reach` blocks either way of `centre`, north up, as red, green,
 * blue and alpha. Water shows by its depth, land by what covers it, lighter
 * with each terrace, a cliff as a line, and every thing the learner set down
 * as a dot. It reads the seed's own land, so opening it costs the same
 * however far the learner walked.
 */
export function chartOf(
  land: Land,
  centre: readonly [number, number],
  reach: number,
  side: number
) {
  const step = (reach * 2) / side;
  const pixels = new Uint8ClampedArray(side * side * 4);
  const heights = new Float32Array(side * side);
  for (let row = 0; row < side; row += 1) {
    for (let column = 0; column < side; column += 1) {
      const point = pointOf(
        land.seed,
        centre[0] - reach + (column + 0.5) * step,
        centre[1] - reach + (row + 0.5) * step
      );
      const at = row * side + column;
      heights[at] = Math.max(point.height, point.surface);
      const lift =
        point.surface > point.height
          ? 1
          : 1 + RISE * Math.max(0, Math.floor((point.height - SEA) / 6));
      const ink = inkOf(point);
      pixels[at * 4] = ink[0] * lift;
      pixels[at * 4 + 1] = ink[1] * lift;
      pixels[at * 4 + 2] = ink[2] * lift;
      pixels[at * 4 + 3] = 255;
    }
  }
  // A cliff's line falls on the lower side of a step between two samples.
  for (let at = 0; at < side * side; at += 1) {
    const east = at % side < side - 1 ? heights[at + 1] : heights[at];
    const south = at + side < side * side ? heights[at + side] : heights[at];
    if (Math.max(east, south) - heights[at] > CLIFF) {
      pixels.set(INK.cliff, at * 4);
    }
  }
  const dots = Arr.flatMap(Arr.fromIterable(land.things), ([key, things]) => {
    const [cx, cz] = placeOf(key);
    return Arr.map(
      things,
      (thing) =>
        [
          cx * CHUNK + (thing.at % (CHUNK * 2)) / 2,
          cz * CHUNK + Math.floor(thing.at / (CHUNK * 2)) / 2,
        ] as const
    );
  });
  for (const [x, z] of dots) {
    const column = Math.floor((x - centre[0] + reach) / step);
    const row = Math.floor((z - centre[1] + reach) / step);
    if (column >= 0 && column < side && row >= 0 && row < side) {
      pixels.set(INK.built, (row * side + column) * 4);
    }
  }
  return pixels;
}
