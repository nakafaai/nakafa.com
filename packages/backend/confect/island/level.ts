import { Array as Arr, Option } from "effect";

/**
 * The island's levels in order: the lifetime Stars that open each one and the
 * side of its square in cells (ADR 0042, D10). Level 1 is the first entry.
 */
const LEVELS = Arr.make(
  { from: 0, size: 6 },
  { from: 150, size: 8 },
  { from: 400, size: 10 },
  { from: 900, size: 12 },
  { from: 1800, size: 16 },
  { from: 3500, size: 20 },
  { from: 6000, size: 24 }
);

/** The widest island, which bounds every coordinate a layout may store. */
export const MAX_SIZE = Arr.lastNonEmpty(LEVELS).size;

/**
 * How far an island has grown with these lifetime Stars: its level from 1, the
 * side of its square in cells, and the lifetime Stars that open the next level,
 * none at the last one.
 */
export function growthOf(lifetime: number) {
  const reached = Arr.reduce(
    LEVELS,
    { level: 1, size: LEVELS[0].size },
    (current, entry, index) =>
      lifetime >= entry.from ? { level: index + 1, size: entry.size } : current
  );
  return {
    ...reached,
    next: Option.map(Arr.get(LEVELS, reached.level), (entry) => entry.from),
  };
}
