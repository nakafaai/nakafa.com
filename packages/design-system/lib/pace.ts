/**
 * How long a decorative loop rests for each millisecond it works, which leaves it
 * an eighth of the main thread at most.
 */
const REST_PER_WORK = 7;

/**
 * Keeps one decorative loop to its share of the main thread on any device. A
 * fast device draws a frame in under two milliseconds, so it draws every frame.
 * A slow phone takes twenty, so it draws about six times a second, and the
 * reader's scroll and press find the thread free. The pace is measured and never
 * guessed from a device's name: a phone that is busy with something else slows
 * the loop down too. A page whose loops took every frame never went idle on a
 * slow phone at all.
 */
export function createFramePace() {
  let nextAt = 0;
  return {
    /** Whether the loop may draw at this moment. */
    isDue: (now: number) => now >= nextAt,
    /** Records what a drawing took, which sets how long the loop rests. */
    rest: (startedAt: number, endedAt: number) => {
      nextAt = endedAt + (endedAt - startedAt) * REST_PER_WORK;
    },
  };
}
