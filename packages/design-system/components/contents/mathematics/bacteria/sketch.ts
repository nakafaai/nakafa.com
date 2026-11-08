import { Schema } from "effect";

/**
 * Where a dish stands in its division: the generation it shows and how far
 * that generation has grown and divided, from 0 to 1.
 */
const DivisionSchema = Schema.Struct({
  generation: Schema.Int,
  phase: Schema.Finite,
});
type Division = typeof DivisionSchema.Type;

/** What one frame of the sketch knows about time and the lesson. */
const DivisionClockSchema = Schema.Struct({
  elapsed: Schema.Finite,
  generation: Schema.Int,
  interval: Schema.Finite,
  maxGenerations: Schema.Int,
  playing: Schema.Boolean,
});
type DivisionClock = typeof DivisionClockSchema.Type;

/** A dish that has drawn no generation yet. */
export const NO_DIVISION: Division = { generation: -1, phase: 0 };

/**
 * Moves a dish's division on by one frame. A generation the learner newly
 * chose starts from its growth. While the card plays, a generation grows and
 * divides over one interval and then reports once that it has ended, so the
 * lesson moves on; a paused card and the last generation hold still.
 */
export function stepDivision(division: Division, clock: DivisionClock) {
  const start =
    clock.generation === division.generation
      ? division
      : { generation: clock.generation, phase: 0 };
  if (
    !clock.playing ||
    clock.generation >= clock.maxGenerations ||
    start.phase >= 1
  ) {
    return { division: start, ended: false };
  }
  const phase = Math.min(1, start.phase + clock.elapsed / clock.interval);
  return {
    division: { generation: start.generation, phase },
    ended: phase >= 1,
  };
}
