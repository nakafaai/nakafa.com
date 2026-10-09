/**
 * Keeps a value between min and max. NaN stays NaN, where Effect's Number.clamp
 * would return min.
 */
export function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}
