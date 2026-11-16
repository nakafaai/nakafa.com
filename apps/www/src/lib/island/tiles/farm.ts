import type { Ramp, Tone } from "@/lib/island/palette";
import { blankTile, put, speckle, TILE } from "@/lib/island/tiles/paint";
import {
  box,
  emptyShape,
  line,
  PART,
  paintShape,
} from "@/lib/island/tiles/shape";

/**
 * Tilled soil seen from above (ADR 0047, D16): ridges and furrows across the
 * tile, darker and glossier once watered, so a learner sees at a glance which
 * rows still need water.
 */
export function farmlandTile(seed: number, wet: boolean) {
  const pixels = blankTile();
  const [ridge, furrow, grain]: readonly [Tone, Tone, Tone] = wet
    ? [1, 0, 2]
    : [2, 1, 3];
  speckle(pixels, seed, "soil", [
    [ridge, 0.7],
    [grain, 0.3],
  ]);
  for (let y = 0; y < TILE; y += 4) {
    for (let x = 0; x < TILE; x += 1) {
      put(pixels, x, y + 2, "soil", furrow);
      put(pixels, x, y + 3, "soil", furrow);
    }
  }
  if (wet) {
    for (let x = 1; x < TILE; x += 5) {
      put(pixels, x, 3, "water", 2);
      put(pixels, x + 2, 11, "water", 2);
    }
  }
  return pixels;
}

/** A sprout of a field crop: a short stem with two leaves, and a bud in its crop's color. */
export function sproutTile(leaf: Ramp, bud: Ramp) {
  const shape = emptyShape();
  line(shape, [8, 15], [8, 10], PART.accent);
  line(shape, [7, 11], [5, 9], PART.accent, 2);
  line(shape, [9, 11], [11, 9], PART.accent, 2);
  box(shape, 8, 8, 8, 9, PART.body);
  return paintShape(shape, { accent: leaf, belly: bud, body: bud, mark: bud });
}
