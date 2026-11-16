import { Schema } from "effect";

/**
 * The quality ladder (ADR 0047, D44 and D47): what the painter draws on
 * each rung, from the full picture down to the least a slow device can keep
 * smooth: the tufts go first, then the shadows, then the art pixel stops
 * following the zoom and keeps the screen's own.
 * The ladder only steps down within a game: a device that ran slow keeps the
 * rung it reached, so the picture never flickers between two.
 */
export const RUNGS = [
  { coarse: false, shadows: true, tufts: true },
  { coarse: false, shadows: true, tufts: false },
  { coarse: false, shadows: false, tufts: false },
  { coarse: true, shadows: false, tufts: false },
] as const;

/** What the ladder holds: its rung, a running average of a frame's seconds, and how long frames have run over budget. */
const Ladder = Schema.Struct({
  average: Schema.Finite,
  rung: Schema.Int,
  slow: Schema.Finite,
});
type Ladder = typeof Ladder.Type;

/** The ladder a game opens on: the full picture, at sixty frames a second. */
export const TOP_RUNG: Ladder = { average: 1 / 60, rung: 0, slow: 0 };

/** The slowest a frame may run on average: forty frames a second. */
const BUDGET = 1 / 40;

/** How many seconds of frames must run over budget before the ladder steps down. */
const PATIENCE = 2;

/** The longest gap between two frames that still measures a frame: a longer one followed a pause. */
const LONGEST_FRAME = 0.25;

/**
 * The ladder after a frame drawn `seconds` after the one before it: a frame
 * after a pause says nothing; frames over budget for `PATIENCE` seconds step
 * it down a rung, and one frame back under budget forgives them.
 */
export function stepLadder(ladder: Ladder, seconds: number): Ladder {
  if (seconds <= 0 || seconds > LONGEST_FRAME) {
    return ladder;
  }
  const average = ladder.average * 0.9 + seconds * 0.1;
  const slow = average > BUDGET ? ladder.slow + seconds : 0;
  const lowest = ladder.rung >= RUNGS.length - 1;
  if (slow < PATIENCE || lowest) {
    return { average, rung: ladder.rung, slow: Math.min(slow, PATIENCE) };
  }
  return { average, rung: ladder.rung + 1, slow: 0 };
}
