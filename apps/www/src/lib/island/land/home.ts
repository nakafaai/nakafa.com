import { pointOf } from "@/lib/island/land/relief";

/** How far from the origin a home is looked for, and how far apart the rings of the search lie, in blocks. */
const SEARCH = { reach: 280, step: 7 } as const;

/** How far from a candidate its surroundings are read, in blocks, at eight bearings. */
const AROUND = 16;

/** What a candidate scores from its surroundings: water within a walk counts up to three bearings, rough ground, distance, trees and height off the first terrace count against it. */
function scoreOf(seed: number, x: number, z: number, distance: number) {
  const here = pointOf(seed, x, z);
  let water = 0;
  let rough = 0;
  let trees = here.forest;
  for (let bearing = 0; bearing < 8; bearing += 1) {
    const turn = (bearing * Math.PI) / 4;
    const near = pointOf(
      seed,
      x + Math.cos(turn) * AROUND,
      z + Math.sin(turn) * AROUND
    );
    water += near.wet > 0 || near.elevation < 0 ? 1 : 0;
    rough += Math.abs(near.height - here.height);
    trees += near.forest;
  }
  return (
    Math.min(water, 3) * 4 -
    rough * 1.5 -
    distance * 0.02 -
    trees * 2.4 -
    Math.abs(here.elevation - 4) * 0.35
  );
}

/**
 * Where a world opens (ADR 0050, W1): the best place within reach of the
 * origin to live, a flat, dry, open first terrace with water a short walk
 * away, found from the seed alone so every device opens the same world at the
 * same camp. A seed with no such place opens at the origin.
 */
export function homeOf(seed: number) {
  let bestX = 0;
  let bestZ = 0;
  let bestScore = Number.NEGATIVE_INFINITY;
  for (let ring = 0; ring < SEARCH.reach; ring += SEARCH.step) {
    const turn = SEARCH.step / Math.max(SEARCH.step, ring);
    for (let angle = 0; angle < Math.PI * 2; angle += turn) {
      const x = Math.round(Math.cos(angle) * ring);
      const z = Math.round(Math.sin(angle) * ring);
      const point = pointOf(seed, x, z);
      const livable =
        point.elevation >= 1.8 && point.elevation <= 16 && point.wet <= -1.2;
      const score = livable
        ? scoreOf(seed, x, z, ring)
        : Number.NEGATIVE_INFINITY;
      if (score > bestScore) {
        bestScore = score;
        bestX = x;
        bestZ = z;
      }
    }
  }
  return [bestX, bestZ] as const;
}
