/**
 * While the card plays, the panel counts up by one at a steady pace, slow
 * enough to watch every lamp that changes: a carry turns a run of lamps off
 * and the next one on.
 */

/** How long the panel shows each number while it counts, in seconds. */
export const COUNT_SECONDS = 0.9;

/**
 * The counter's clock `seconds` later, and how many whole counts it passed:
 * the clock keeps the time since the last count.
 */
export function advanceCounter(clock: number, seconds: number) {
  const elapsed = clock + Math.max(0, seconds);
  const counts = Math.floor(elapsed / COUNT_SECONDS);
  return { clock: elapsed - counts * COUNT_SECONDS, counts };
}
