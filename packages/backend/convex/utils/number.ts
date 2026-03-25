/** Clamp a number within an inclusive range. */
export function clampNumber({
  value,
  min,
  max,
}: {
  value: number;
  min: number;
  max: number;
}) {
  const low = Math.min(min, max);
  const high = Math.max(min, max);

  return Math.min(Math.max(value, low), high);
}
