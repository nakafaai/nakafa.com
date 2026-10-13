import { Array as Arr, Option } from "effect";

/**
 * Distance from the top of the viewport to the reading line: the 80 px that a
 * question keeps clear for the 64 px header when it scrolls into view, and
 * 8 px into the question.
 */
export const PLAYER_READING_LINE = 88;

/**
 * Root margin that shrinks the viewport to a band one pixel high at the reading
 * line, so an observer reports the question under that line and nothing else.
 */
export function readingBand(viewportHeight: number) {
  const bottom = Math.max(0, viewportHeight - PLAYER_READING_LINE - 1);
  return `-${PLAYER_READING_LINE}px 0px -${bottom}px 0px`;
}

/**
 * The question under the reading line after one batch of observer entries: the
 * last question that entered the line wins, and the previous one stays while
 * the line sits in a gap between questions.
 */
export function nextBand(previous: string | null, entered: readonly string[]) {
  return Option.getOrElse(Arr.last(entered), () => previous);
}

/** The question to mark current: the last one at the end of the list, else the one under the line. */
export function spyCandidate(
  spy: { band: string | null; end: boolean },
  lastKey: string | null
) {
  return spy.end ? lastKey : spy.band;
}
