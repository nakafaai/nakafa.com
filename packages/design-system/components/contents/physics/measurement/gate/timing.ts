/**
 * A trolley rolling at a steady speed along a level track through two light
 * gates. Each gate's beam starts or stops a timer as the trolley's card cuts
 * it, so the timer measures the time between the gates. The ruler gives the
 * distance between them. Both are base quantities; their ratio, the speed,
 * is derived.
 */

/** The trolley's speed, in metres per second. */
export const TROLLEY_SPEED = 0.48;

/** The closest and farthest the gates stand, in metres. */
export const GATE_RANGE = { max: 1.2, min: 0.2 } as const;

/** The timer's resolution, in seconds. */
export const TIMER_STEP = 0.001;

/**
 * The timer's reading for gates `distance` metres apart, to the
 * millisecond, and the speed it and the distance give.
 */
export function gateReading(distance: number) {
  const time =
    Math.round(distance / TROLLEY_SPEED / TIMER_STEP) /
    Math.round(1 / TIMER_STEP);
  return { speed: distance / time, time };
}
