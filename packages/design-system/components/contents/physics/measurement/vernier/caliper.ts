/**
 * A vernier caliper with a tenth-millimetre vernier: ten vernier divisions
 * span nine millimetres of the main scale, so each one falls 0.1 mm short of
 * a main mark. When the jaws close on an object, the vernier zero stands at
 * the object's width, and the one vernier line that meets a main mark counts
 * the tenths past the last whole millimetre.
 */

/** How many divisions the vernier scale has. */
export const VERNIER_DIVISIONS = 10;

/** The smallest change the caliper resolves, in millimetres. */
export const VERNIER_RESOLUTION = 1 / VERNIER_DIVISIONS;

/** The length of one vernier division, in millimetres: one main division less one resolution. */
export const VERNIER_STEP = (VERNIER_DIVISIONS - 1) / VERNIER_DIVISIONS;

/** The narrowest and widest objects the lab measures, in millimetres. */
export const CALIPER_RANGE = { max: 45, min: 5 } as const;

/**
 * The reading of the caliper closed on an object `width` millimetres wide:
 * the last whole millimetre the vernier zero has passed, the vernier line that
 * meets a main mark, and the reading they make together, in millimetres.
 */
export function vernierReading(width: number) {
  const tenths = Math.round(width / VERNIER_RESOLUTION);
  const main = Math.floor(tenths / VERNIER_DIVISIONS);
  const line = tenths - main * VERNIER_DIVISIONS;
  return {
    line,
    main,
    reading: tenths / VERNIER_DIVISIONS,
  };
}

/**
 * Where vernier line `index` stands on the main scale, in millimetres, with
 * the vernier zero at `zero`.
 */
export function vernierMark(zero: number, index: number) {
  return zero + index * VERNIER_STEP;
}

/**
 * How far vernier line `index` misses the nearest main mark, in millimetres.
 * Only the line the reading names meets a mark exactly.
 */
export function vernierMiss(zero: number, index: number) {
  const mark = vernierMark(zero, index);
  return Math.abs(mark - Math.round(mark));
}
