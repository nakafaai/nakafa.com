import type { StageBudget } from "@repo/design-system/components/three/stage/tier";

/** How many pixels across one reach of a lab is planned to span. */
const VIEW = 1280;

/**
 * How far a drawn curve may stand off the true one on each tier, in those
 * pixels: a fifth of one on a desktop, where a reader zooms in, and coarser
 * on a phone, whose screen shows the same lab a third as wide and where
 * every triangle costs a frame. A lab is framed tighter than its reach, so
 * on a screen these come to about a tenth of a pixel.
 */
const TOLERANCE = {
  full: 0.2,
  light: 0.5,
  low: 0.7,
  plain: 1,
} as const satisfies Record<StageBudget["tier"], number>;

/** The fewest sides a round section keeps, so a thin wire still reads as round. */
const FEWEST = 8;

/** The most sides a round section takes, however large it is. */
const MOST = 96;

/** The finest and the coarsest step along an arc, in radians. */
const FINEST = Math.PI / 90;
const COARSEST = Math.PI / 4;

/**
 * The grain of a lab's shapes: the farthest a facet may stand off the true
 * curve, in scene units. It follows the stage's tier and the lab's reach, so
 * a shape that is large on screen takes more segments than a small one, and
 * a phone takes fewer than a desktop.
 *
 * @param tier - The stage's rendering tier
 * @param reach - How far the lab reaches from its middle, in scene units
 */
export function grainOf(tier: StageBudget["tier"], reach: number) {
  return (TOLERANCE[tier] * reach) / VIEW;
}

/**
 * The widest step along an arc of one radius that keeps its chords within
 * the grain, in radians.
 */
export function stepFor(grain: number, radius: number) {
  const depth = Math.min(1, grain / Math.max(radius, grain));
  return Math.min(COARSEST, Math.max(FINEST, 2 * Math.acos(1 - depth)));
}

/**
 * How many sides a round section of one radius takes to stay within the
 * grain: a multiple of four, so its silhouette is the same from the front
 * and from the side.
 */
export function sidesFor(grain: number, radius: number) {
  const sides = Math.ceil((2 * Math.PI) / stepFor(grain, radius) / 4) * 4;
  return Math.min(MOST, Math.max(FEWEST, sides));
}
