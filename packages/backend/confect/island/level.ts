import { Array as Arr, Option } from "effect";

/**
 * The island's levels in order: the lifetime Stars that open each one (ADR
 * 0042, D10) and the side of the footprint the learner builds on, in blocks
 * (ADR 0047, D7). Level 1 is the first entry.
 */
const LEVELS = Arr.make(
  { from: 0, size: 16 },
  { from: 150, size: 24 },
  { from: 400, size: 32 },
  { from: 900, size: 40 },
  { from: 1800, size: 48 },
  { from: 3500, size: 56 },
  { from: 6000, size: 64 }
);

/**
 * How far an island has grown with these lifetime Stars: its level from 1, the
 * lifetime Stars that opened it, the side of its footprint, and the lifetime
 * Stars that open the next level, none at the last one.
 */
export function growthOf(lifetime: number) {
  const reached = Arr.reduce(
    LEVELS,
    { from: 0, level: 1, size: LEVELS[0].size },
    (current, entry, index) =>
      lifetime >= entry.from
        ? { from: entry.from, level: index + 1, size: entry.size }
        : current
  );
  return {
    ...reached,
    next: Option.map(Arr.get(LEVELS, reached.level), (entry) => entry.from),
  };
}
