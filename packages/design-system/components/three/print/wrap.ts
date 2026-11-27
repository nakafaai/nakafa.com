/**
 * How a flat sheet wraps onto a round part: the arc of a cylinder a print
 * of a given width covers, how many segments build it, and the sheet that
 * covers a whole ball.
 */

/** A full turn, in radians. */
const TURN = Math.PI * 2;

/** The fewest segments an arc is built from, so even a narrow label bends. */
const FEWEST = 6;

/**
 * The arc of a cylinder of `radius` that a sheet `width` metres wide wraps:
 * its length in radians, never more than a full turn, and where it starts
 * so its middle faces the cylinder's front, the +z side.
 */
export function sleeveArc(width: number, radius: number) {
  const length = radius > 0 ? Math.min(TURN, Math.abs(width) / radius) : 0;
  return { length, start: -length / 2 };
}

/**
 * How many segments build an arc `length` radians long, when a full circle
 * takes `around`: enough that the print follows the part's own curve.
 */
export function arcSegments(length: number, around: number): number {
  return Math.max(FEWEST, Math.ceil((Math.abs(length) / TURN) * around));
}

/**
 * The size of the sheet that covers a whole ball of `radius`, in metres:
 * once round its equator across, and from pole to pole up.
 */
export function ballSheet(radius: number) {
  return { height: Math.PI * radius, width: TURN * radius };
}
