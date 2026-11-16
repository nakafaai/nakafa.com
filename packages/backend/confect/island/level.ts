import { Array as Arr, Option } from "effect";

/**
 * The island's levels in order: the lifetime Stars that open each one, the
 * side of its square in cells (ADR 0042, D10), and the side of the game's
 * footprint in blocks (ADR 0047, D7). Level 1 is the first entry.
 */
const LEVELS = Arr.make(
  { from: 0, size: 6, world: 16 },
  { from: 150, size: 8, world: 24 },
  { from: 400, size: 10, world: 32 },
  { from: 900, size: 12, world: 40 },
  { from: 1800, size: 16, world: 48 },
  { from: 3500, size: 20, world: 56 },
  { from: 6000, size: 24, world: 64 }
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
    { level: 1, size: LEVELS[0].size, world: LEVELS[0].world },
    (current, entry, index) =>
      lifetime >= entry.from
        ? { level: index + 1, size: entry.size, world: entry.world }
        : current
  );
  return {
    ...reached,
    next: Option.map(Arr.get(LEVELS, reached.level), (entry) => entry.from),
  };
}
