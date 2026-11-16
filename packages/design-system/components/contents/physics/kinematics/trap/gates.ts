import { Schema } from "effect";

/**
 * A speed trap on a test track: two light gates a gap apart, centred on one
 * spot, time a car that speeds up steadily from rest. The trap reads the
 * average speed across its gap; as the gap shrinks the reading closes in on
 * the car's speed at the centre, its instantaneous speed.
 */

/** The car's steady acceleration from rest, in m/s². */
export const TRAP_ACCELERATION = 4;

/** Where the trap is centred along the track, in metres. */
export const TRAP_CENTRE = 50;

/** The gaps between the two gates a learner can set, in metres. */
export const TrapGapSchema = Schema.Literals([40, 20, 10, 2]);
export type TrapGap = typeof TrapGapSchema.Type;

/** How far the car has gone after `time` seconds, in metres. */
export function trapPosition(time: number) {
  return 0.5 * TRAP_ACCELERATION * Math.max(time, 0) ** 2;
}

/** The moment the car reaches a point of the track, in seconds. */
export function trapArrival(metres: number) {
  return Math.sqrt((2 * metres) / TRAP_ACCELERATION);
}

/**
 * What the trap reads for one gap: when the car breaks each beam, the time
 * between them, the average speed across the gap, and the true speed at the
 * centre for comparison.
 */
export function trapReading(gap: TrapGap) {
  const enter = trapArrival(TRAP_CENTRE - gap / 2);
  const leave = trapArrival(TRAP_CENTRE + gap / 2);
  const elapsed = leave - enter;
  return {
    average: gap / elapsed,
    elapsed,
    enter,
    instant: TRAP_ACCELERATION * trapArrival(TRAP_CENTRE),
    leave,
  };
}
